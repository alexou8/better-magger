/**
 * Shared contract between the protocol/core layer (src/core, src/hid, src/data)
 * and the UI layer (src/ui). See research/PROTOCOL.md for the wire format.
 *
 * Conventions:
 *  - All travel values in this API are RAW device units. Convert with
 *    `model.features.travel.rawPerMm` (actuation/deadzones) or the RT precision
 *    table (rapid-trigger press/release) — helpers live in src/core/units.ts.
 *  - Profiles are 0-based (UI shows 1-based). Layers: 0 Main/Win, 1 FN1, 2 Mac/FN2, 3 FN3.
 *  - Key indices are protocol slots 0..127, bound to physical layout keys at
 *    connect time via the default keymap (see `LayoutKey.index`).
 */

/** 3-byte key action as stored on the device. */
export interface KeyAction {
  type: number;
  code1: number;
  code2: number;
}

export interface TravelLimits {
  rawPerMm: number; // 50 (0.02mm) for types 101/102, else 100 (0.01mm)
  maxRaw: number; // full travel in raw units (default switch)
  minActuationRaw: number;
  deadzoneMaxRaw: number;
}

export interface RtPrecisionMode {
  id: 0 | 1 | 2;
  stepMm: number;
  rawPerMm: number;
  maxRaw: number;
}

export interface SwitchType {
  value: number;
  name: string;
  fullTravelRaw: number;
}

export type AdvancedKind = 'dks' | 'mt' | 'tgl' | 'rs' | 'socd' | 'oks';

export interface Features {
  profiles: number; // usable profiles (1 or 4)
  layers: number; // 4
  travel: TravelLimits;
  /** RT press/release precision modes; only [mode 0] when the model has no precision setting. */
  rtPrecisionModes: RtPrecisionMode[];
  switchTypes: SwitchType[];
  advanced: AdvancedKind[];
  macros: boolean;
  lighting: boolean;
  perKeyRgb: boolean;
  liveTravel: boolean;
  calibration: boolean;
  jis: boolean;
  pollingRates: { value: number; hz: number }[];
}

export interface DeviceModel {
  /** Human-friendly model name, e.g. "Magger68 Plus". */
  name: string;
  family: 'Magger68' | 'Magger 60' | 'Other';
  id: number;
  type: number;
  pid: number;
  bootPid: number;
  layoutId: string;
  /** Latest firmware known to the official site, decimal like 107 (= v1.07). */
  latestFw: number;
  features: Features;
}

export interface LayoutKey {
  /** Stable id within the layout (order in layout file). */
  id: number;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Protocol key slot, resolved at connect time; -1 if unresolved. */
  index: number;
  /** Default action code from the layout (used to resolve index). */
  code: number;
}

export interface Layout {
  id: string;
  width: number; // in key units
  height: number;
  keys: LayoutKey[];
}

export interface LightingSettings {
  effect: number; // 0..22, see src/data/lighting
  brightness: number; // 0..100
  speed: number; // UI value 0..4 (core handles the inversion)
  direction: number; // 0/1
  multicolor: boolean;
  r: number;
  g: number;
  b: number;
  /** Sleep timeout in minutes; 0 = never. */
  sleepMinutes: number;
}

export interface BaseSettings {
  osMode: 'windows' | 'mac';
  pollingRate: number; // 1=8000Hz, 2=4000, 3=2000, 4=1000
  debounce: number; // 0 low, 1 medium, 2 high
  bottomOutActuation: boolean; // func[7] bit1
  tachyonMode: boolean; // func[7] bit0 (lighting locked while on)
  lockWin: boolean;
  lockAltTab: boolean;
  lockAltF4: boolean;
  lighting: LightingSettings;
}

export type KeyMode = 0 | 1 | 2; // 0 normal, 1 rapid trigger, 2 continuous RT

export interface KeyTrigger {
  switchType: number;
  mode: KeyMode;
  priority: number; // SOCD priority nibble, 0 none
  actuation: number; // raw, base unit
  pressPrecision: number; // RT precision mode id
  releasePrecision: number;
  rtPress: number; // raw in the selected precision unit
  rtRelease: number;
  pressDeadzone: number; // raw, base unit (top dead zone)
  releaseDeadzone: number; // raw, base unit (bottom dead zone)
}

export interface DksSlot {
  /** Depths in 0.1 mm: [first actuation, bottom, release-from-bottom, final release]. */
  points: [number, number, number, number];
  /** Up to 4 actions; each has a 10-bit phase mask (see PROTOCOL.md §4.6). */
  actions: { action: KeyAction; mask: number }[];
}

export interface MtSlot {
  tap: KeyAction;
  hold: KeyAction;
}

export interface MacroStep {
  kind: 'modifier' | 'key' | 'mouse';
  /** HID usage for key/modifier (224..231 for modifiers), mouse button mask for mouse. */
  code: number;
  pressed: boolean;
  delayMs: number;
}

export interface Macro {
  steps: MacroStep[];
}

export interface FirmwareInfo {
  /** Decimal version as the official site shows it, e.g. 107. */
  version: number;
  /** Display string, e.g. "1.07". */
  display: string;
  updateAvailable: boolean;
}

export type SessionEvent =
  | { kind: 'travel'; index: number; raw: number; calibrationStatus?: number }
  | { kind: 'profileChanged'; profile: number }
  | { kind: 'osModeChanged'; mode: 'windows' | 'mac' }
  | { kind: 'resetDone'; profile: number }
  | { kind: 'lightingChanged' }
  | { kind: 'wirelessLink'; connected: boolean }
  | { kind: 'disconnected' }
  | { kind: 'error'; message: string };

/** One connected keyboard. All methods are serialised internally (safe to call concurrently). */
export interface KeyboardSession {
  readonly model: DeviceModel;
  readonly layout: Layout; // with indices resolved
  readonly productName: string;
  readonly isDemo: boolean;

  getFirmware(): Promise<FirmwareInfo>;
  getActiveProfile(): Promise<number>;
  selectProfile(profile: number): Promise<void>;

  readSettings(profile: number): Promise<BaseSettings>;
  /** Read-modify-write of the 64-byte func block; only the given fields change. */
  writeSettings(profile: number, patch: Partial<Omit<BaseSettings, 'lighting'>> & { lighting?: Partial<LightingSettings> }): Promise<BaseSettings>;

  readKeymap(profile: number, layer: number): Promise<KeyAction[]>; // 128 entries
  readDefaultKeymap(profile: number, layer: number): Promise<KeyAction[]>;
  writeKeys(profile: number, layer: number, changes: { index: number; action: KeyAction }[]): Promise<void>;

  readTriggers(profile: number): Promise<KeyTrigger[]>; // 128 entries
  writeTriggers(profile: number, changes: { index: number; trigger: KeyTrigger }[]): Promise<void>;

  readKeyColors(profile: number): Promise<[number, number, number][]>; // 128 entries
  writeKeyColors(profile: number, changes: { index: number; rgb: [number, number, number] }[]): Promise<void>;

  readMacros(profile: number): Promise<Macro[]>; // 16 entries
  writeMacros(profile: number, macros: Macro[]): Promise<void>;

  readDks(profile: number): Promise<DksSlot[]>; // 32
  writeDks(profile: number, slot: number, dks: DksSlot): Promise<void>;
  readMt(profile: number): Promise<MtSlot[]>; // 32 (shared by MT/RS/SOCD/OKS)
  writeMt(profile: number, slots: MtSlot[]): Promise<void>;
  readTgl(profile: number): Promise<KeyAction[]>; // 32
  writeTgl(profile: number, slot: number, action: KeyAction): Promise<void>;

  /** Enables/disables live travel streaming (func[7] bit3). */
  setLiveTravel(profile: number, on: boolean): Promise<void>;
  startCalibration(): Promise<void>;
  endCalibration(): Promise<void>;
  factoryReset(): Promise<void>;

  on(listener: (e: SessionEvent) => void): () => void;
  close(): Promise<void>;
}

export type ConnectResult =
  | { status: 'connected'; session: KeyboardSession }
  | { status: 'bootloader'; modelName: string } // keyboard is in firmware-update mode
  | { status: 'unsupported'; productName: string; pid: number }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };
