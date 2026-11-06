/**
 * Pure encoders/decoders for the LUMINKEY 0x55 command protocol (research/PROTOCOL.md).
 * No I/O here: everything takes and returns plain bytes / contract types.
 */
import type {
  BaseSettings,
  DksSlot,
  FirmwareInfo,
  KeyAction,
  KeyMode,
  KeyTrigger,
  LightingSettings,
  Macro,
  MacroStep,
  MtSlot,
} from './types';

export const REPORT_SIZE = 64;
export const CHUNK_SIZE = 56;
export const FRAME_HEADER = 0x55;
const DATA_OFFSET = 8;

export const CMD = {
  FIRMWARE: 0x03,
  LIVE_COLORS: 0xde,
  ACTIVE_PROFILE: 0x04,
  SELECT_PROFILE: 0x0e,
  CALIBRATION_START: 0xa8,
  CALIBRATION_END: 0xa9,
  FACTORY_RESET: 0xee,
} as const;

/** A per-profile table: read/write command, per-profile stride and used size in bytes. */
export interface TableSpec {
  read: number;
  write?: number;
  stride: number;
  size: number;
}

export const TABLES = {
  func: { read: 0x05, write: 0x06, stride: 64, size: 64 },
  defaultKeymap: { read: 0x07, stride: 2048, size: 2048 },
  keymap: { read: 0x08, write: 0x09, stride: 2048, size: 2048 },
  colors: { read: 0x0a, write: 0x0b, stride: 512, size: 384 },
  macros: { read: 0x0c, write: 0x0d, stride: 2048, size: 2048 },
  triggers: { read: 0xa0, write: 0xa1, stride: 1024, size: 1024 },
  dks: { read: 0xa2, write: 0xa3, stride: 768, size: 768 },
  mt: { read: 0xa4, write: 0xa5, stride: 256, size: 192 },
  tgl: { read: 0xa6, write: 0xa7, stride: 128, size: 96 },
} satisfies Record<string, TableSpec>;

export const LAYER_STRIDE = 512;
export const KEY_SLOTS = 128;
export const ADV_SLOTS = 32;
export const MACRO_COUNT = 16;
export const TRIGGER_SIZE = 8;
export const DKS_SIZE = 24;
export const MT_SIZE = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

// ------------------------------------------------------------------ frames

/**
 * One 64-byte command report: 55 CMD 00 CHK LEN OFF_LO OFF_HI 00 DATA…
 * CHK = (LEN + OFF_LO + OFF_HI + sum(DATA)) & 0xFF. Reads pass `length` and no data.
 */
export function encodeFrame(cmd: number, offset: number, length: number, data: ArrayLike<number> = []): Uint8Array<ArrayBuffer> {
  if (length > CHUNK_SIZE || data.length > length) throw new RangeError(`Bad frame length ${length}`);
  if (offset < 0 || offset > 0xffff) throw new RangeError(`Bad frame offset ${offset}`);
  const f = new Uint8Array(REPORT_SIZE);
  const lo = offset & 0xff;
  const hi = offset >> 8;
  let sum = length + lo + hi;
  for (let i = 0; i < data.length; i++) {
    f[DATA_OFFSET + i] = data[i];
    sum += data[i] & 0xff;
  }
  f.set([FRAME_HEADER, cmd, 0, sum & 0xff, length, lo, hi, 0]);
  return f;
}

/** Read requests covering `length` bytes from `offset`, in 56-byte chunks. */
export function readFrames(cmd: number, offset: number, length: number): Uint8Array<ArrayBuffer>[] {
  const frames = [];
  for (let pos = 0; pos < length; pos += CHUNK_SIZE) frames.push(encodeFrame(cmd, offset + pos, Math.min(CHUNK_SIZE, length - pos)));
  return frames;
}

/** Write requests for `data` at `offset`, in 56-byte chunks. */
export function writeFrames(cmd: number, offset: number, data: Uint8Array): Uint8Array<ArrayBuffer>[] {
  const frames = [];
  for (let pos = 0; pos < data.length; pos += CHUNK_SIZE) {
    const chunk = data.subarray(pos, pos + CHUNK_SIZE);
    frames.push(encodeFrame(cmd, offset + pos, chunk.length, chunk));
  }
  return frames;
}

export interface ParsedFrame {
  header: number;
  cmd: number;
  length: number;
  offset: number;
  data: Uint8Array;
  checksumOk: boolean;
}

/** Parses a request frame (used by the simulator and tests). */
export function parseFrame(f: Uint8Array): ParsedFrame {
  const length = Math.min(f[4], CHUNK_SIZE);
  const data = f.slice(DATA_OFFSET, DATA_OFFSET + length);
  let sum = f[4] + f[5] + f[6];
  data.forEach((b) => (sum += b));
  return { header: f[0], cmd: f[1], length, offset: f[5] | (f[6] << 8), data, checksumOk: (sum & 0xff) === f[3] };
}

/** Payload of a reply: bytes 8..8+length. */
export function replyPayload(reply: Uint8Array, length: number): Uint8Array {
  if (reply.length < DATA_OFFSET + length) throw new Error(`Short reply (${reply.length} bytes)`);
  return reply.slice(DATA_OFFSET, DATA_OFFSET + length);
}

// ------------------------------------------------------------------ input report routing

export type InputKind = 'reply' | 'travel' | 'profile' | 'reset' | 'osMode' | 'lighting' | 'link';

const EVENT_HEADERS: Record<number, InputKind> = { 0xa0: 'travel', 0xa1: 'profile', 0xa2: 'reset', 0xa3: 'osMode' };

/** Index of the dongle link marker FA FB 06 (00|01), or -1. */
export function findLinkMarker(r: Uint8Array): number {
  for (let i = 0; i + 3 < r.length; i++) {
    if (r[i] === 0xfa && r[i + 1] === 0xfb && r[i + 2] === 0x06 && r[i + 3] <= 1) return i;
  }
  return -1;
}

/** Classifies an input report as a command reply or an unsolicited event (PROTOCOL.md §5). */
export function classifyReport(r: Uint8Array): InputKind {
  const event = EVENT_HEADERS[r[0]];
  if (event) return event;
  // A dongle link report may itself start AA FA (FB 06 xx); the marker is the more specific match.
  if (r[0] === 0xaa && r[1] === 0xfa) return findLinkMarker(r) >= 0 ? 'link' : 'lighting';
  if (r[0] === 0xaa || r[0] === FRAME_HEADER) return 'reply';
  return findLinkMarker(r) >= 0 ? 'link' : 'reply';
}

export interface TravelSample {
  action: KeyAction;
  raw: number;
  calibrationStatus: number;
}

/** 0xA0 report: the key's default action in [1..3], big-endian travel in [6..7], calibration in [10]. */
export function decodeTravelReport(r: Uint8Array): TravelSample {
  return { action: { type: r[1], code1: r[2], code2: r[3] }, raw: (r[6] << 8) | r[7], calibrationStatus: r[10] };
}

export function encodeTravelReport(s: TravelSample): Uint8Array<ArrayBuffer> {
  const r = new Uint8Array(REPORT_SIZE);
  r.set([0xa0, s.action.type, s.action.code1, s.action.code2, 0, 0, (s.raw >> 8) & 0xff, s.raw & 0xff, 0, 0, s.calibrationStatus]);
  return r;
}

// ------------------------------------------------------------------ firmware / info

/** Firmware version from cmd 0x03: LE u16 whose hex digits read as decimal ("07 01" -> 107 = v1.07). */
export function decodeFirmware(payload: Uint8Array, latestFw: number): FirmwareInfo {
  const raw = payload[0] | (payload[1] << 8);
  const digits = raw.toString(16);
  const version = /^\d+$/.test(digits) ? parseInt(digits, 10) : raw;
  const display = version >= 100 ? `${Math.floor(version / 100)}.${String(version % 100).padStart(2, '0')}` : String(version);
  // 0x4148 is the official app's "needs update" marker.
  return { version, display, updateAvailable: raw === 0x4148 || version < latestFw };
}

/** Inverse of decodeFirmware's digit trick: 107 -> [0x07, 0x01]. */
export function encodeFirmware(version: number): [number, number] {
  const raw = parseInt(String(version), 16);
  return [raw & 0xff, (raw >> 8) & 0xff];
}

// ------------------------------------------------------------------ func block (§3)

const bit = (v: number, n: number) => (v >> n) & 1;
const setBit = (v: number, n: number, on: boolean) => (on ? v | (1 << n) : v & ~(1 << n));

export const FUNC_LIVE_TRAVEL_BIT = 3;

export function decodeSettings(f: Uint8Array): BaseSettings {
  return {
    osMode: f[1] & 0x02 ? 'mac' : 'windows',
    pollingRate: f[4] & 0x0f,
    debounce: (f[7] >> 5) & 0x07,
    bottomOutActuation: bit(f[7], 1) === 1,
    tachyonMode: bit(f[7], 0) === 1,
    lockWin: bit(f[6], 0) === 1,
    lockAltTab: bit(f[6], 1) === 1,
    lockAltF4: bit(f[6], 2) === 1,
    lighting: decodeLighting(f),
  };
}

function decodeLighting(f: Uint8Array): LightingSettings {
  return {
    effect: f[8],
    brightness: f[9],
    speed: clamp(4 - f[10], 0, 4),
    direction: f[11],
    multicolor: f[12] !== 0,
    r: f[14],
    g: f[15],
    b: f[16],
    sleepMinutes: f[36] === 1 ? 0 : f[35] / 2,
  };
}

export type SettingsPatch = Partial<Omit<BaseSettings, 'lighting'>> & { lighting?: Partial<LightingSettings> };

/** Returns a copy of the func block with only the patched fields changed; all other bits are kept. */
export function patchSettings(func: Uint8Array, patch: SettingsPatch): Uint8Array {
  const f = func.slice();
  if (patch.osMode !== undefined) f[1] = setBit(f[1], 1, patch.osMode === 'mac');
  if (patch.pollingRate !== undefined) f[4] = (f[4] & 0xf0) | (patch.pollingRate & 0x0f);
  if (patch.lockWin !== undefined) f[6] = setBit(f[6], 0, patch.lockWin);
  if (patch.lockAltTab !== undefined) f[6] = setBit(f[6], 1, patch.lockAltTab);
  if (patch.lockAltF4 !== undefined) f[6] = setBit(f[6], 2, patch.lockAltF4);
  if (patch.tachyonMode !== undefined) f[7] = setBit(f[7], 0, patch.tachyonMode);
  if (patch.bottomOutActuation !== undefined) f[7] = setBit(f[7], 1, patch.bottomOutActuation);
  if (patch.debounce !== undefined) f[7] = (f[7] & 0x1f) | ((patch.debounce & 0x07) << 5);
  if (patch.lighting) patchLighting(f, patch.lighting);
  return f;
}

function patchLighting(f: Uint8Array, l: Partial<LightingSettings>): void {
  if (l.effect !== undefined) f[8] = clamp(l.effect, 0, 255);
  if (l.brightness !== undefined) f[9] = clamp(l.brightness, 0, 100);
  if (l.speed !== undefined) f[10] = 4 - clamp(l.speed, 0, 4);
  if (l.direction !== undefined) f[11] = clamp(l.direction, 0, 255);
  if (l.multicolor !== undefined) f[12] = l.multicolor ? 1 : 0;
  if (l.r !== undefined) f[14] = clamp(l.r, 0, 255);
  if (l.g !== undefined) f[15] = clamp(l.g, 0, 255);
  if (l.b !== undefined) f[16] = clamp(l.b, 0, 255);
  if (l.sleepMinutes !== undefined) {
    const never = l.sleepMinutes <= 0;
    f[35] = never ? 0 : clamp(l.sleepMinutes * 2, 2, 255); // 30 s units
    f[36] = never ? 1 : 0;
  }
}

export function withLiveTravel(func: Uint8Array, on: boolean): Uint8Array {
  const f = func.slice();
  f[7] = setBit(f[7], FUNC_LIVE_TRAVEL_BIT, on);
  return f;
}

// ------------------------------------------------------------------ key actions / colours

export function decodeActions(bytes: Uint8Array, count: number): KeyAction[] {
  return Array.from({ length: count }, (_, i) => ({ type: bytes[3 * i], code1: bytes[3 * i + 1], code2: bytes[3 * i + 2] }));
}

export function encodeActions(actions: KeyAction[]): Uint8Array {
  const out = new Uint8Array(actions.length * 3);
  actions.forEach((a, i) => out.set([a.type & 0xff, a.code1 & 0xff, a.code2 & 0xff], 3 * i));
  return out;
}

export function decodeColors(bytes: Uint8Array): [number, number, number][] {
  return Array.from({ length: KEY_SLOTS }, (_, i) => [bytes[3 * i], bytes[3 * i + 1], bytes[3 * i + 2]]);
}

export function encodeColors(colors: [number, number, number][]): Uint8Array {
  const out = new Uint8Array(colors.length * 3);
  colors.forEach((c, i) => out.set(c.map((v) => clamp(v, 0, 255)), 3 * i));
  return out;
}

// ------------------------------------------------------------------ key triggers (§4.5)

const u9 = (lo: number, hi: number) => (lo | ((hi & 1) << 8)) + 1;

export function decodeTrigger(b: Uint8Array, at = 0): KeyTrigger {
  const mode = b[at + 1] & 0x0f;
  return {
    switchType: b[at] & 0x0f,
    mode: (mode <= 2 ? mode : 0) as KeyMode,
    priority: b[at + 1] >> 4,
    actuation: u9(b[at + 2], b[at + 3]),
    pressPrecision: (b[at + 3] >> 3) & 3,
    releasePrecision: (b[at + 3] >> 1) & 3,
    rtPress: u9(b[at + 4], b[at + 5]),
    pressDeadzone: b[at + 5] >> 1,
    rtRelease: u9(b[at + 6], b[at + 7]),
    releaseDeadzone: b[at + 7] >> 1,
  };
}

/** 8-byte record; 9-bit values are stored minus one, dead zones as `dz << 1` (setAllKeyTravel form). */
export function encodeTrigger(t: KeyTrigger): Uint8Array {
  const act = clamp(t.actuation, 1, 512) - 1;
  const press = clamp(t.rtPress, 1, 512) - 1;
  const release = clamp(t.rtRelease, 1, 512) - 1;
  return Uint8Array.of(
    0xa0 | (t.switchType & 0x0f),
    (t.mode & 0x0f) | ((t.priority & 0x0f) << 4),
    act & 0xff,
    (act >> 8) | ((t.pressPrecision & 3) << 3) | ((t.releasePrecision & 3) << 1),
    press & 0xff,
    (press >> 8) | (clamp(t.pressDeadzone, 0, 127) << 1),
    release & 0xff,
    (release >> 8) | (clamp(t.releaseDeadzone, 0, 127) << 1),
  );
}

export function decodeTriggers(table: Uint8Array): KeyTrigger[] {
  return Array.from({ length: KEY_SLOTS }, (_, i) => decodeTrigger(table, TRIGGER_SIZE * i));
}

// ------------------------------------------------------------------ macros (§4.9)

const MACRO_TABLE_SIZE = 2048;
const MACRO_OFFSETS = 32;
const MACRO_DATA_START = MACRO_OFFSETS * 2;
const MACRO_RECORD = 4;
const KIND_MODIFIER = 1;
const KIND_KEY = 2;
const KIND_MOUSE = 3;
const FLAG_PRESS = 0x40;
const FLAG_LAST = 0x80;
/** A no-op "release key 0, last" record that empty macros point at. */
const TERMINATOR = [0, 0, FLAG_LAST | KIND_KEY, 0];

const isModifierUsage = (code: number) => code >= 224 && code <= 231;

function encodeStep(s: MacroStep, last: boolean): number[] {
  const asModifier = s.kind === 'modifier' || (s.kind === 'key' && isModifierUsage(s.code));
  const kind = asModifier ? KIND_MODIFIER : s.kind === 'mouse' ? KIND_MOUSE : KIND_KEY;
  const code = asModifier ? 1 << (s.code & 0x0f) : s.code & 0xff;
  const delay = last ? 0 : clamp(s.delayMs, 0, 0xffff);
  return [delay & 0xff, delay >> 8, kind | (s.pressed ? FLAG_PRESS : 0) | (last ? FLAG_LAST : 0), code];
}

function decodeStep(b: Uint8Array, at: number): MacroStep | null {
  const flags = b[at + 2];
  const kind = flags & 0x3f;
  const code = b[at + 3];
  const base = { pressed: (flags & FLAG_PRESS) !== 0, delayMs: b[at] | (b[at + 1] << 8) };
  if (kind === KIND_MODIFIER) {
    const bitIndex = code ? Math.log2(code & -code) : 0;
    return { kind: 'modifier', code: 224 + bitIndex, ...base };
  }
  if (kind === KIND_KEY && code !== 0) return { kind: 'key', code, ...base };
  if (kind === KIND_MOUSE) return { kind: 'mouse', code, ...base };
  return null;
}

/** 2048-byte macro table: 32 u16 start offsets, then 4-byte records ending at a "last" flag. */
export function encodeMacros(macros: Macro[]): Uint8Array {
  if (macros.length > MACRO_OFFSETS) throw new RangeError('Too many macros');
  const out = new Uint8Array(MACRO_TABLE_SIZE);
  let pos = MACRO_DATA_START;
  out.set(TERMINATOR, pos);
  pos += MACRO_RECORD;
  for (let i = 0; i < MACRO_OFFSETS; i++) {
    const steps = macros[i]?.steps ?? [];
    const start = steps.length ? pos : MACRO_DATA_START;
    if (pos + steps.length * MACRO_RECORD > MACRO_TABLE_SIZE) throw new RangeError('Macros exceed the 2 KB macro memory');
    steps.forEach((s, n) => {
      out.set(encodeStep(s, n === steps.length - 1), pos);
      pos += MACRO_RECORD;
    });
    out[2 * i] = start & 0xff;
    out[2 * i + 1] = start >> 8;
  }
  return out;
}

export function decodeMacros(table: Uint8Array, count = MACRO_COUNT): Macro[] {
  return Array.from({ length: count }, (_, i) => {
    const steps: MacroStep[] = [];
    let at = table[2 * i] | (table[2 * i + 1] << 8);
    if (at < MACRO_DATA_START) return { steps };
    for (; at + MACRO_RECORD <= table.length; at += MACRO_RECORD) {
      const step = decodeStep(table, at);
      if (step) steps.push(step);
      if (table[at + 2] & FLAG_LAST) break;
    }
    return { steps };
  });
}

// ------------------------------------------------------------------ DKS / MT / TGL (§4.6–4.8)

export function decodeDks(b: Uint8Array, at = 0): DksSlot {
  const actions = Array.from({ length: 4 }, (_, i) => {
    const p = at + 4 + 5 * i;
    return { action: { type: b[p], code1: b[p + 1], code2: b[p + 2] }, mask: (b[p + 3] | (b[p + 4] << 8)) & 0x3ff };
  });
  return { points: [b[at], b[at + 1], b[at + 2], b[at + 3]], actions };
}

export function encodeDks(d: DksSlot): Uint8Array {
  const out = new Uint8Array(DKS_SIZE);
  out.set(d.points.map((p) => clamp(p, 0, 255)));
  d.actions.slice(0, 4).forEach(({ action, mask }, i) => {
    const m = mask & 0x3ff;
    out.set([action.type, action.code1, action.code2, m & 0xff, m >> 8], 4 + 5 * i);
  });
  return out;
}

export function decodeDksTable(table: Uint8Array): DksSlot[] {
  return Array.from({ length: ADV_SLOTS }, (_, i) => decodeDks(table, DKS_SIZE * i));
}

export function decodeMt(table: Uint8Array): MtSlot[] {
  return Array.from({ length: ADV_SLOTS }, (_, i) => {
    const [tap, hold] = decodeActions(table.subarray(MT_SIZE * i, MT_SIZE * i + MT_SIZE), 2);
    return { tap, hold };
  });
}

export function encodeMt(slots: MtSlot[]): Uint8Array {
  if (slots.length > ADV_SLOTS) throw new RangeError('Too many MT slots');
  return encodeActions(slots.flatMap((s) => [s.tap, s.hold]));
}

// ------------------------------------------------------------------ helpers

/** Groups indexed changes into runs of consecutive indices (last write per index wins). */
export function consecutiveRuns<T>(changes: { index: number; value: T }[]): { start: number; values: T[] }[] {
  const byIndex = new Map<number, T>();
  for (const c of changes) byIndex.set(c.index, c.value);
  const runs: { start: number; values: T[] }[] = [];
  for (const index of [...byIndex.keys()].sort((a, b) => a - b)) {
    const run = runs[runs.length - 1];
    if (run && run.start + run.values.length === index) run.values.push(byIndex.get(index)!);
    else runs.push({ start: index, values: [byIndex.get(index)!] });
  }
  return runs;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
