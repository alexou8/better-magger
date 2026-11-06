/** KeyboardSession over a HidTransport: table I/O, func-block read-modify-write, event mapping. */
import { actionCode, actionsEqual } from '../data/keycodes';
import { buildLayout, type LayoutDef } from '../data/layouts';
import {
  ADV_SLOTS,
  CHUNK_SIZE,
  CMD,
  DKS_SIZE,
  KEY_SLOTS,
  LAYER_STRIDE,
  MACRO_COUNT,
  TABLES,
  TRIGGER_SIZE,
  concatBytes,
  consecutiveRuns,
  decodeActions,
  decodeColors,
  decodeDksTable,
  decodeFirmware,
  decodeMacros,
  decodeMt,
  decodeSettings,
  decodeTravelReport,
  decodeTriggers,
  encodeActions,
  encodeColors,
  encodeDks,
  encodeFrame,
  encodeMacros,
  encodeMt,
  encodeTrigger,
  findLinkMarker,
  patchSettings,
  readFrames,
  replyPayload,
  withLiveTravel,
  writeFrames,
  type SettingsPatch,
  type TableSpec,
} from './protocol';
import type {
  BaseSettings,
  DeviceModel,
  DksSlot,
  FirmwareInfo,
  KeyAction,
  KeyTrigger,
  KeyboardSession,
  Layout,
  Macro,
  MtSlot,
  SessionEvent,
} from './types';
import type { HidTransport, TransportEvent } from '../hid/transport';

/** How long a func block read is trusted for read-modify-write without re-reading. */
const FUNC_CACHE_TTL_MS = 2000;
const POLLING_RATE_BYTE = 4;

export interface SessionInit {
  transport: HidTransport;
  model: DeviceModel;
  layout: LayoutDef;
  productName: string;
  isDemo: boolean;
}

/**
 * Binds layout keys to protocol slots like the official app: for each key in layout order,
 * the first not-yet-used slot whose N() code equals the key's code. Unresolved keys stay -1;
 * synthetic simulator positions can be enabled explicitly for demo data.
 */
export function resolveIndices(def: LayoutDef, defaults: KeyAction[], demoFallback = false): number[] {
  const used = new Set<number>();
  const codes = defaults.map(actionCode);
  const indices = def.keys.map((k) => {
    const slot = codes.findIndex((c, i) => c === k.code && !used.has(i));
    if (slot >= 0) used.add(slot);
    return slot;
  });
  return indices.map((slot, i) => {
    if (slot >= 0 || !demoFallback) return slot;
    const demo = def.keys[i].demoIndex;
    if (used.has(demo)) return -1;
    used.add(demo);
    return demo;
  });
}

/** Serialises async critical sections. */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export async function openSession(init: SessionInit): Promise<KeyboardSession> {
  const session = new Session(init);
  try {
    await session.bindLayout();
    return session;
  } catch (e) {
    await session.close();
    throw e;
  }
}

class Session implements KeyboardSession {
  readonly model: DeviceModel;
  readonly productName: string;
  readonly isDemo: boolean;
  layout: Layout;

  private readonly transport: HidTransport;
  private readonly def: LayoutDef;
  private readonly listeners = new Set<(e: SessionEvent) => void>();
  private readonly funcLock = new Mutex();
  private readonly funcCache = new Map<number, { bytes: Uint8Array; at: number }>();
  private defaultLayer0: KeyAction[] = [];
  private readonly unsubscribeTransport: () => void;

  constructor(init: SessionInit) {
    this.transport = init.transport;
    this.model = init.model;
    this.productName = init.productName;
    this.isDemo = init.isDemo;
    this.def = init.layout;
    this.layout = buildLayout(init.layout);
    this.unsubscribeTransport = this.transport.onEvent(this.onTransportEvent);
  }

  async bindLayout(): Promise<void> {
    try {
      this.defaultLayer0 = await this.readDefaultKeymap(0, 0);
    } catch (e) {
      if (!this.isDemo) throw new Error(`Could not read the keyboard's physical key positions. Reconnect and try again. ${e instanceof Error ? e.message : String(e)}`);
      console.warn('Could not read the default keymap; using built-in key positions', e);
      this.layout = buildLayout(this.def, this.def.keys.map((k) => k.demoIndex));
      return;
    }
    const indices = resolveIndices(this.def, this.defaultLayer0, this.isDemo);
    if (!this.isDemo && !indices.some((index) => index >= 0)) {
      throw new Error('The keyboard returned an unrecognised default keymap. Reconnect or check its firmware with the official driver.');
    }
    this.layout = buildLayout(this.def, indices);
  }

  // ---------------------------------------------------------------- info / profiles

  async getFirmware(): Promise<FirmwareInfo> {
    return decodeFirmware(await this.readBytes(CMD.FIRMWARE, 0, 32), this.model.latestFw);
  }

  async getActiveProfile(): Promise<number> {
    const [profile] = await this.readBytes(CMD.ACTIVE_PROFILE, 0, 32);
    this.checkProfile(profile);
    return profile;
  }

  /** Profiles the model does not offer fall back to 0, like the official getBase(). */
  private clampProfile(profile: number): number {
    return profile < this.model.features.profiles ? profile : 0;
  }

  async selectProfile(profile: number): Promise<void> {
    this.checkProfile(profile);
    const mode = this.model.type === 122 || this.model.type === 124 ? 4 : 1;
    await this.transport.request(encodeFrame(CMD.SELECT_PROFILE, 0, 2, [profile, mode]));
  }

  // ---------------------------------------------------------------- func block

  readSettings(profile: number): Promise<BaseSettings> {
    this.checkProfile(profile);
    return this.funcLock.run(async () => decodeSettings(await this.loadFunc(profile, true)));
  }

  writeSettings(profile: number, patch: SettingsPatch): Promise<BaseSettings> {
    this.checkProfile(profile);
    return this.funcLock.run(async () => {
      const before = await this.loadFunc(profile, false);
      const after = patchSettings(before, patch);
      await this.storeFunc(profile, before, after);
      return decodeSettings(after);
    });
  }

  async setLiveTravel(profile: number, on: boolean): Promise<void> {
    this.checkProfile(profile);
    if (!this.model.features.liveTravel) return;
    await this.funcLock.run(async () => {
      const before = await this.loadFunc(profile, false);
      await this.storeFunc(profile, before, withLiveTravel(before, on));
    });
  }

  private async loadFunc(profile: number, fresh: boolean): Promise<Uint8Array> {
    const cached = this.funcCache.get(profile);
    if (!fresh && cached && Date.now() - cached.at < FUNC_CACHE_TTL_MS) return cached.bytes;
    const bytes = await this.readTable(TABLES.func, profile, 0, TABLES.func.size);
    this.funcCache.set(profile, { bytes, at: Date.now() });
    return bytes;
  }

  /**
   * Writes only the 56-byte chunks that changed. A polling-rate change can make the keyboard
   * re-enumerate, so that chunk goes last and a missing reply to it is not an error.
   */
  private async storeFunc(profile: number, before: Uint8Array, after: Uint8Array): Promise<void> {
    const base = TABLES.func.stride * profile;
    const rateChanged = (before[POLLING_RATE_BYTE] & 0x0f) !== (after[POLLING_RATE_BYTE] & 0x0f);
    const chunks = writeFrames(TABLES.func.write, base, after)
      .map((frame, i) => ({ frame, start: i * CHUNK_SIZE }))
      .filter(({ start }) => after.subarray(start, start + CHUNK_SIZE).some((b, j) => b !== before[start + j]))
      .sort((a, b) => Number(a.start === 0 && rateChanged) - Number(b.start === 0 && rateChanged));
    try {
      for (const { frame, start } of chunks) {
        if (!(rateChanged && start === 0)) {
          await this.transport.request(frame);
          continue;
        }
        try {
          await this.transport.request(frame, { replyOptional: true, retries: 0 });
        } catch (e) {
          if (this.transport.isOpen) throw e;
          console.debug('Ignoring error after polling-rate change (keyboard re-enumerates)', e);
        }
      }
    } catch (e) {
      // Some chunks may have been applied: never reuse the cached copy for the next patch.
      this.funcCache.delete(profile);
      throw e;
    }
    this.funcCache.set(profile, { bytes: after, at: Date.now() });
  }

  // ---------------------------------------------------------------- keymaps

  readKeymap(profile: number, layer: number): Promise<KeyAction[]> {
    return this.readLayer(TABLES.keymap, profile, layer);
  }

  readDefaultKeymap(profile: number, layer: number): Promise<KeyAction[]> {
    return this.readLayer(TABLES.defaultKeymap, profile, layer);
  }

  async writeKeys(profile: number, layer: number, changes: { index: number; action: KeyAction }[]): Promise<void> {
    this.checkProfile(profile);
    this.checkLayer(layer);
    const runs = consecutiveRuns(changes.map((c) => ({ index: checkSlot(c.index, KEY_SLOTS), value: c.action })));
    for (const run of runs) {
      await this.writeTable(TABLES.keymap, profile, LAYER_STRIDE * layer + 3 * run.start, encodeActions(run.values));
    }
  }

  private async readLayer(table: TableSpec, profile: number, layer: number): Promise<KeyAction[]> {
    this.checkProfile(profile);
    this.checkLayer(layer);
    const bytes = await this.readTable(table, profile, LAYER_STRIDE * layer, 3 * KEY_SLOTS);
    return decodeActions(bytes, KEY_SLOTS);
  }

  // ---------------------------------------------------------------- triggers / colours

  async readTriggers(profile: number): Promise<KeyTrigger[]> {
    this.checkProfile(profile);
    return decodeTriggers(await this.readTable(TABLES.triggers, profile, 0, TABLES.triggers.size));
  }

  async writeTriggers(profile: number, changes: { index: number; trigger: KeyTrigger }[]): Promise<void> {
    this.checkProfile(profile);
    const runs = consecutiveRuns(changes.map((c) => ({ index: checkSlot(c.index, KEY_SLOTS), value: c.trigger })));
    for (const run of runs) {
      const bytes = concatBytes(run.values.map(encodeTrigger));
      await this.writeTable(TABLES.triggers, profile, TRIGGER_SIZE * run.start, bytes);
    }
  }

  async readKeyColors(profile: number): Promise<[number, number, number][]> {
    this.checkProfile(profile);
    return decodeColors(await this.readTable(TABLES.colors, profile, 0, TABLES.colors.size));
  }

  async writeKeyColors(profile: number, changes: { index: number; rgb: [number, number, number] }[]): Promise<void> {
    this.checkProfile(profile);
    const runs = consecutiveRuns(changes.map((c) => ({ index: checkSlot(c.index, KEY_SLOTS), value: c.rgb })));
    for (const run of runs) await this.writeTable(TABLES.colors, profile, 3 * run.start, encodeColors(run.values));
  }

  // ---------------------------------------------------------------- macros / advanced keys

  async readMacros(profile: number): Promise<Macro[]> {
    this.checkProfile(profile);
    return decodeMacros(await this.readTable(TABLES.macros, profile, 0, TABLES.macros.size), MACRO_COUNT);
  }

  async writeMacros(profile: number, macros: Macro[]): Promise<void> {
    this.checkProfile(profile);
    if (macros.length > MACRO_COUNT) throw new RangeError(`At most ${MACRO_COUNT} macros`);
    await this.writeTable(TABLES.macros, profile, 0, encodeMacros(macros));
  }

  async readDks(profile: number): Promise<DksSlot[]> {
    this.checkProfile(profile);
    return decodeDksTable(await this.readTable(TABLES.dks, profile, 0, TABLES.dks.size));
  }

  async writeDks(profile: number, slot: number, dks: DksSlot): Promise<void> {
    this.checkProfile(profile);
    await this.writeTable(TABLES.dks, profile, DKS_SIZE * checkSlot(slot, ADV_SLOTS), encodeDks(dks));
  }

  async readMt(profile: number): Promise<MtSlot[]> {
    this.checkProfile(profile);
    return decodeMt(await this.readTable(TABLES.mt, profile, 0, TABLES.mt.size));
  }

  async writeMt(profile: number, slots: MtSlot[]): Promise<void> {
    this.checkProfile(profile);
    await this.writeTable(TABLES.mt, profile, 0, encodeMt(slots));
  }

  async readTgl(profile: number): Promise<KeyAction[]> {
    this.checkProfile(profile);
    return decodeActions(await this.readTable(TABLES.tgl, profile, 0, TABLES.tgl.size), ADV_SLOTS);
  }

  async writeTgl(profile: number, slot: number, action: KeyAction): Promise<void> {
    this.checkProfile(profile);
    await this.writeTable(TABLES.tgl, profile, 3 * checkSlot(slot, ADV_SLOTS), encodeActions([action]));
  }

  // ---------------------------------------------------------------- maintenance

  async startCalibration(): Promise<void> {
    await this.command(CMD.CALIBRATION_START);
  }

  async endCalibration(): Promise<void> {
    await this.command(CMD.CALIBRATION_END);
  }

  async factoryReset(): Promise<void> {
    this.funcCache.clear();
    await this.command(CMD.FACTORY_RESET, [0xff]);
  }

  /** Fire-once commands: never retried (not idempotent), and a missing reply is tolerated. */
  private command(cmd: number, data: number[] = []): Promise<Uint8Array | null> {
    return this.transport.request(encodeFrame(cmd, 0, data.length, data), { replyOptional: true, retries: 0 });
  }

  // ---------------------------------------------------------------- events / lifecycle

  on(listener: (e: SessionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    this.unsubscribeTransport();
    this.listeners.clear();
    await this.transport.close();
  }

  private readonly onTransportEvent = (e: TransportEvent): void => {
    const event = this.toSessionEvent(e);
    if (event) this.emit(event);
  };

  private toSessionEvent(e: TransportEvent): SessionEvent | null {
    if (e.kind === 'disconnected') return { kind: 'disconnected' };
    const r = e.report;
    switch (e.kind) {
      case 'travel': {
        const sample = decodeTravelReport(r);
        const index = this.slotForDefaultAction(sample.action);
        return index < 0 ? null : { kind: 'travel', index, raw: sample.raw, calibrationStatus: sample.calibrationStatus };
      }
      case 'profile':
        this.funcCache.clear();
        return { kind: 'profileChanged', profile: this.clampProfile(r[2]) };
      case 'reset':
        this.funcCache.clear();
        return { kind: 'resetDone', profile: this.clampProfile(r[2]) };
      case 'osMode':
        this.funcCache.clear();
        return { kind: 'osModeChanged', mode: r[2] & 0x02 ? 'mac' : 'windows' };
      case 'lighting':
        this.funcCache.clear();
        return { kind: 'lightingChanged' };
      case 'link': {
        return { kind: 'wirelessLink', connected: r[findLinkMarker(r) + 3] === 1 };
      }
    }
  }

  /** Travel reports carry the key's default action; map it back to the slot. */
  private slotForDefaultAction(a: KeyAction): number {
    const exact = this.defaultLayer0.findIndex((d) => actionsEqual(d, a));
    if (exact >= 0) return exact;
    // The official app hard-codes N() == 3809 (type 224, code1 0) to layout key 65 (UNVERIFIED).
    if (a.type === 224 && a.code1 === 0) return this.layout.keys[65]?.index ?? -1;
    const code = actionCode(a);
    return this.layout.keys.find((k) => k.code === code)?.index ?? -1;
  }

  private emit(e: SessionEvent): void {
    for (const l of [...this.listeners]) {
      try {
        l(e);
      } catch (err) {
        console.error('Session listener failed', err);
      }
    }
  }

  // ---------------------------------------------------------------- table I/O

  private async readBytes(cmd: number, offset: number, length: number): Promise<Uint8Array> {
    const parts: Uint8Array[] = [];
    for (const frame of readFrames(cmd, offset, length)) {
      parts.push(replyPayload(await this.transport.request(frame), frame[4]));
    }
    return concatBytes(parts);
  }

  private readTable(table: TableSpec, profile: number, offset: number, length: number): Promise<Uint8Array> {
    return this.readBytes(table.read, table.stride * profile + offset, length);
  }

  private async writeTable(table: TableSpec, profile: number, offset: number, data: Uint8Array): Promise<void> {
    if (table.write === undefined) throw new Error('Table is read-only');
    for (const frame of writeFrames(table.write, table.stride * profile + offset, data)) {
      await this.transport.request(frame);
    }
  }

  private checkProfile(profile: number): void {
    if (!Number.isInteger(profile) || profile < 0 || profile >= this.model.features.profiles) {
      throw new RangeError(`Profile ${profile} is not available on ${this.model.name}`);
    }
  }

  private checkLayer(layer: number): void {
    if (!Number.isInteger(layer) || layer < 0 || layer >= this.model.features.layers) {
      throw new RangeError(`Layer ${layer} does not exist`);
    }
  }
}

function checkSlot(index: number, count: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError(`Slot ${index} out of range`);
  return index;
}

