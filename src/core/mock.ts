/**
 * A simulated LUMINKEY keyboard: implements the device side of the 0x55 protocol behind an
 * in-memory fake HIDDevice, so demo mode exercises the real transport and codecs.
 */
import { codeToAction, EMPTY_ACTION } from '../data/keycodes';
import type { LayoutDef } from '../data/layouts';
import { VENDOR_ID } from '../data/models';
import {
  CMD,
  FUNC_LIVE_TRAVEL_BIT,
  KEY_SLOTS,
  LAYER_STRIDE,
  REPORT_SIZE,
  TABLES,
  concatBytes,
  encodeActions,
  encodeColors,
  encodeFirmware,
  encodeMacros,
  encodeTravelReport,
  encodeTrigger,
  parseFrame,
} from './protocol';
import type { DeviceModel, KeyAction } from './types';
import { defaultTrigger } from './units';

type TableName = keyof typeof TABLES;

const TABLE_BY_CMD = new Map<number, { name: TableName; write: boolean }>();
for (const [name, spec] of Object.entries(TABLES) as [TableName, (typeof TABLES)[TableName]][]) {
  TABLE_BY_CMD.set(spec.read, { name, write: false });
  if ('write' in spec) TABLE_BY_CMD.set(spec.write, { name, write: true });
}

const TICK_MS = 20;
const PROFILE_EFFECTS = [6, 3, 4, 1];

interface Press {
  slot: number;
  start: number;
  duration: number;
  depth: number;
}

function hueToRgb(hue: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + hue / 60) % 6;
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
}

/** Fn layer of the demo: number row becomes F1..F12. */
function fnLayerAction(code: number): KeyAction {
  const numberRow = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 45, 46];
  const i = numberRow.indexOf(code);
  return i >= 0 ? codeToAction(58 + i) : EMPTY_ACTION;
}

export class SimulatedKeyboard {
  activeProfile = 0;
  /** Frames whose checksum was wrong (tests assert this stays 0). */
  badFrames = 0;
  private readonly memory = new Map<TableName, Uint8Array>();
  private readonly injected: Uint8Array[] = [];
  private dropReplies = 0;
  private calibrating = false;
  private presses: Press[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly defaultLayer0: KeyAction[];

  constructor(
    readonly model: DeviceModel,
    private readonly layout: LayoutDef,
    private readonly send: (report: Uint8Array) => void,
  ) {
    this.defaultLayer0 = Array.from({ length: KEY_SLOTS }, (_, i) => codeToAction(layout.defaults[i] ?? 0));
    this.reset();
  }

  /** Raw access to a table of one profile (tests). */
  table(name: TableName, profile: number): Uint8Array {
    const spec = TABLES[name];
    return this.memory.get(name)!.subarray(spec.stride * profile, spec.stride * (profile + 1));
  }

  /** Delivers `report` right before the next reply (tests: unsolicited report mid-command). */
  injectBeforeNextReply(report: Uint8Array): void {
    this.injected.push(report);
  }

  /** Executes the next `n` requests without replying (tests: timeouts, re-enumeration). */
  dropNextReplies(n: number): void {
    this.dropReplies += n;
  }

  /** Handles one request frame; returns the reports to deliver (unsolicited first, then the reply). */
  handle(frame: Uint8Array): Uint8Array[] {
    const f = parseFrame(frame);
    if (f.header !== 0x55 || !f.checksumOk) this.badFrames++;
    const reply = new Uint8Array(REPORT_SIZE);
    reply.set([0xaa, ...frame.subarray(1, 8)]);
    reply.set(this.execute(f.cmd, f.offset, f.length, f.data), 8);
    if (this.dropReplies > 0) {
      this.dropReplies--;
      return [];
    }
    return [...this.injected.splice(0), reply];
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.presses = [];
  }

  private execute(cmd: number, offset: number, length: number, data: Uint8Array): ArrayLike<number> {
    switch (cmd) {
      case CMD.FIRMWARE:
        return encodeFirmware(this.model.latestFw);
      case CMD.ACTIVE_PROFILE:
        return [this.activeProfile];
      case CMD.SELECT_PROFILE:
        if (data[0] < this.model.features.profiles) this.activeProfile = data[0];
        return [];
      case CMD.CALIBRATION_START:
      case CMD.CALIBRATION_END:
        this.calibrating = cmd === CMD.CALIBRATION_START;
        this.updateSimulation();
        return [];
      case CMD.FACTORY_RESET:
        this.reset();
        setTimeout(() => this.send(Uint8Array.of(0xa2, 0, this.activeProfile)), 50);
        return [];
    }
    const table = TABLE_BY_CMD.get(cmd);
    if (!table) return [];
    const mem = this.memory.get(table.name)!;
    if (offset >= mem.length) return [];
    if (!table.write) return mem.subarray(offset, offset + length);
    mem.set(data.subarray(0, Math.min(length, mem.length - offset)), offset);
    if (table.name === 'func') this.updateSimulation();
    return [];
  }

  private reset(): void {
    const profiles = this.model.features.profiles;
    const alloc = (name: TableName, fill: (profile: number) => Uint8Array) => {
      const spec = TABLES[name];
      const mem = new Uint8Array(spec.stride * Math.max(profiles, 1));
      for (let p = 0; p < profiles; p++) mem.set(fill(p).subarray(0, spec.stride), spec.stride * p);
      this.memory.set(name, mem);
    };
    const keymap = this.defaultKeymap();
    alloc('func', (p) => this.defaultFunc(p));
    alloc('defaultKeymap', () => keymap);
    alloc('keymap', () => keymap);
    alloc('colors', () => this.defaultColors());
    alloc('macros', () => encodeMacros([]));
    alloc('triggers', () => concatBytes(Array.from({ length: KEY_SLOTS }, () => encodeTrigger(defaultTrigger(this.model)))));
    alloc('dks', () => new Uint8Array(0));
    alloc('mt', () => new Uint8Array(0));
    alloc('tgl', () => new Uint8Array(0));
    this.activeProfile = 0;
    this.updateSimulation();
  }

  private defaultFunc(profile: number): Uint8Array {
    const f = new Uint8Array(64);
    f[4] = 0x01; // 8000 Hz
    f[8] = PROFILE_EFFECTS[profile % PROFILE_EFFECTS.length];
    f[9] = 80;
    f[10] = 2; // speed 2 (stored inverted)
    f[12] = 1;
    f.set([0, 160, 255], 14);
    f[35] = 20; // 10 min
    return f;
  }

  private defaultKeymap(): Uint8Array {
    const layer0 = this.defaultLayer0;
    const fn = this.layout.defaults.map(fnLayerAction);
    const layers = [layer0, fn, layer0, []].map((l) => {
      const bytes = new Uint8Array(LAYER_STRIDE);
      bytes.set(encodeActions(l.slice(0, KEY_SLOTS)));
      return bytes;
    });
    return concatBytes(layers);
  }

  private defaultColors(): Uint8Array {
    const colors: [number, number, number][] = Array.from({ length: KEY_SLOTS }, () => [0, 0, 0]);
    for (const k of this.layout.keys) colors[k.demoIndex] = hueToRgb((360 * k.x) / this.layout.width);
    return encodeColors(colors);
  }

  // ------------------------------------------------------------------ live travel

  private get streaming(): boolean {
    const func = this.memory.get('func')!;
    const profiles = this.model.features.profiles;
    for (let p = 0; p < profiles; p++) if ((func[64 * p + 7] >> FUNC_LIVE_TRAVEL_BIT) & 1) return true;
    return this.calibrating;
  }

  private updateSimulation(): void {
    if (this.streaming && !this.timer) {
      this.timer = setInterval(() => this.tick(Date.now()), TICK_MS);
      (this.timer as { unref?: () => void }).unref?.();
    } else if (!this.streaming) {
      this.stop();
    }
  }

  private tick(now: number): void {
    if (this.presses.length < 3 && Math.random() < 0.06) {
      const key = this.layout.keys[Math.floor(Math.random() * this.layout.keys.length)];
      if (!this.presses.some((p) => p.slot === key.demoIndex)) {
        this.presses.push({ slot: key.demoIndex, start: now, duration: 250 + Math.random() * 350, depth: 0.5 + Math.random() / 2 });
      }
    }
    const maxRaw = this.model.features.travel.maxRaw;
    this.presses = this.presses.filter((p) => {
      const t = Math.min(1, (now - p.start) / p.duration);
      const shape = t < 0.3 ? t / 0.3 : t < 0.7 ? 1 : (1 - t) / 0.3;
      const raw = Math.round(maxRaw * p.depth * shape);
      this.send(encodeTravelReport({ action: this.defaultLayer0[p.slot], raw, calibrationStatus: this.calibrating ? 1 : 0 }));
      return t < 1;
    });
  }
}

export interface MockOptions {
  /** Reply latency range in ms (default 2..5). */
  latencyMs?: [number, number];
  productName?: string;
}

/** The subset of HIDDevice the transport uses, backed by a SimulatedKeyboard. */
export class MockHidDevice extends EventTarget {
  opened = false;
  readonly vendorId = VENDOR_ID;
  readonly productId: number;
  readonly productName: string;
  readonly collections: HIDCollectionInfo[] = [];
  oninputreport: ((this: HIDDevice, ev: HIDInputReportEvent) => unknown) | null = null;
  readonly keyboard: SimulatedKeyboard;
  private readonly latency: [number, number];

  constructor(model: DeviceModel, layout: LayoutDef, options: MockOptions = {}) {
    super();
    this.productId = model.pid;
    this.productName = options.productName ?? `${model.name} (demo)`;
    this.latency = options.latencyMs ?? [2, 5];
    this.keyboard = new SimulatedKeyboard(model, layout, (r) => this.deliver(r, 0));
  }

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
    this.keyboard.stop();
  }

  async forget(): Promise<void> {
    await this.close();
  }

  async sendReport(_reportId: number, data: BufferSource): Promise<void> {
    if (!this.opened) throw new Error('Device is not open');
    const frame = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const [min, max] = this.latency;
    const delay = min + Math.random() * (max - min); // one delay per batch keeps report order
    for (const report of this.keyboard.handle(frame.slice())) this.deliver(report, delay);
  }

  async sendFeatureReport(): Promise<void> {
    throw new Error('Feature reports are not used');
  }

  async receiveFeatureReport(): Promise<DataView> {
    throw new Error('Feature reports are not used');
  }

  asHidDevice(): HIDDevice {
    return this as unknown as HIDDevice;
  }

  private deliver(report: Uint8Array, delayMs: number): void {
    const bytes = new Uint8Array(REPORT_SIZE);
    bytes.set(report.subarray(0, REPORT_SIZE));
    setTimeout(() => {
      if (!this.opened) return;
      const event = Object.assign(new Event('inputreport'), { device: this, reportId: 0, data: new DataView(bytes.buffer) });
      this.dispatchEvent(event);
    }, delayMs);
  }
}
