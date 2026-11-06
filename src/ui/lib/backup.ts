import type { BaseSettings, DeviceModel, DksSlot, KeyAction, KeyboardSession, KeyTrigger, Macro, MtSlot } from '../../core/types';
import { invalidate, loadTable } from '../state/cache';
import { encodeMacros } from '../../core/protocol';
import type { Rgb } from './color';

export interface ProfileBackup {
  app: 'better-magger';
  format: 1;
  exportedAt: string;
  model: { name: string; type: number; pid: number };
  profile: number;
  settings: Omit<BaseSettings, 'osMode'>;
  keymaps: KeyAction[][];
  triggers: KeyTrigger[];
  colors?: Rgb[];
  macros?: Macro[];
  dks?: DksSlot[];
  mt?: MtSlot[];
  tgl?: KeyAction[];
}

type Progress = (done: number, total: number) => void;

/** Reads everything that belongs to one profile. */
export async function gatherProfile(s: KeyboardSession, profile: number, onProgress?: Progress): Promise<ProfileBackup> {
  const f = s.model.features;
  const steps: (() => Promise<void>)[] = [];
  const keymaps: KeyAction[][] = [];
  const out: Partial<ProfileBackup> = {};
  steps.push(async () => {
    const { osMode: _os, ...rest } = await loadTable(s, profile, 'settings');
    out.settings = rest;
  });
  for (let l = 0; l < f.layers; l++) steps.push(async () => void (keymaps[l] = await loadTable(s, profile, 'keymap', l)));
  steps.push(async () => void (out.triggers = await loadTable(s, profile, 'triggers')));
  if (f.perKeyRgb) steps.push(async () => void (out.colors = await loadTable(s, profile, 'colors')));
  if (f.macros) steps.push(async () => void (out.macros = await loadTable(s, profile, 'macros')));
  if (f.advanced.includes('dks')) steps.push(async () => void (out.dks = await loadTable(s, profile, 'dks')));
  if (f.advanced.some((k) => k !== 'dks' && k !== 'tgl')) steps.push(async () => void (out.mt = await loadTable(s, profile, 'mt')));
  if (f.advanced.includes('tgl')) steps.push(async () => void (out.tgl = await loadTable(s, profile, 'tgl')));
  for (let i = 0; i < steps.length; i++) {
    onProgress?.(i, steps.length);
    await steps[i]();
  }
  onProgress?.(steps.length, steps.length);
  return {
    app: 'better-magger',
    format: 1,
    exportedAt: new Date().toISOString(),
    model: { name: s.model.name, type: s.model.type, pid: s.model.pid },
    profile,
    ...out,
    keymaps,
  } as ProfileBackup;
}

/** Writes a backup into a profile, then drops that profile's cache so it is re-read. */
export async function applyProfile(s: KeyboardSession, profile: number, b: ProfileBackup, onProgress?: Progress): Promise<void> {
  if (!Number.isInteger(profile) || profile < 0 || profile >= s.model.features.profiles) throw new Error('Invalid target profile.');
  const checked = validateBackup(b, s.model);
  if (!checked.ok) throw new Error(checked.error);
  const all = <T>(arr: T[]) => arr.map((v, index) => ({ index, v }));
  const steps: (() => Promise<unknown>)[] = [];
  b.keymaps.forEach((map, layer) =>
    steps.push(() => s.writeKeys(profile, layer, all(map).map(({ index, v }) => ({ index, action: v })))),
  );
  steps.push(() => s.writeTriggers(profile, all(b.triggers).map(({ index, v }) => ({ index, trigger: v }))));
  if (b.colors) {
    const colors = b.colors;
    steps.push(() => s.writeKeyColors(profile, all(colors).map(({ index, v }) => ({ index, rgb: v }))));
  }
  if (b.macros) {
    const macros = b.macros;
    steps.push(() => s.writeMacros(profile, macros));
  }
  b.dks?.forEach((slot, i) => steps.push(() => s.writeDks(profile, i, slot)));
  if (b.mt) {
    const mt = b.mt;
    steps.push(() => s.writeMt(profile, mt));
  }
  b.tgl?.forEach((a, i) => steps.push(() => s.writeTgl(profile, i, a)));
  // A polling-rate change may re-enumerate USB. Finish every data table first.
  steps.push(() => s.writeSettings(profile, b.settings));
  try {
    for (let i = 0; i < steps.length; i++) {
      onProgress?.(i, steps.length);
      await steps[i]();
    }
    onProgress?.(steps.length, steps.length);
  } finally {
    invalidate(profile);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isByte = (v: unknown) => integer(v, 0, 255);
const isAction = (a: unknown): a is KeyAction => isRecord(a) && isByte(a.type) && isByte(a.code1) && isByte(a.code2);
const arrOf = (v: unknown, len: number, ok: (x: unknown) => boolean) => Array.isArray(v) && v.length === len && v.every(ok);

function isSettings(v: unknown): boolean {
  if (!isRecord(v) || !isRecord(v.lighting)) return false;
  const names = ['pollingRate', 'debounce', 'bottomOutActuation', 'tachyonMode', 'lockWin', 'lockAltTab', 'lockAltF4', 'lighting'];
  // In particular, a backup must never change the keyboard's physical OS mode.
  if (Object.keys(v).some((k) => !names.includes(k))) return false;
  if (!integer(v.pollingRate, 0, 15) || !integer(v.debounce, 0, 7)) return false;
  if (!['bottomOutActuation', 'tachyonMode', 'lockWin', 'lockAltTab', 'lockAltF4'].every((k) => typeof v[k] === 'boolean')) return false;
  const l = v.lighting;
  return isByte(l.effect) && integer(l.brightness, 0, 100) && integer(l.speed, 0, 4) && isByte(l.direction) &&
    typeof l.multicolor === 'boolean' && [l.r, l.g, l.b].every(isByte) &&
    typeof l.sleepMinutes === 'number' && Number.isFinite(l.sleepMinutes) && l.sleepMinutes >= 0 &&
    l.sleepMinutes <= 127.5 && Number.isInteger(l.sleepMinutes * 2) && (l.sleepMinutes === 0 || l.sleepMinutes >= 1);
}

function isTrigger(t: unknown): boolean {
  // Check wire ranges rather than UI limits: unused key slots may contain factory values
  // outside the editable model range, and a backup must preserve those losslessly.
  return isRecord(t) && integer(t.switchType, 0, 15) && integer(t.mode, 0, 2) && integer(t.priority, 0, 15) &&
    integer(t.actuation, 1, 512) && integer(t.pressPrecision, 0, 3) && integer(t.releasePrecision, 0, 3) &&
    integer(t.rtPress, 1, 512) && integer(t.rtRelease, 1, 512) &&
    integer(t.pressDeadzone, 0, 127) && integer(t.releaseDeadzone, 0, 127);
}

function isMacro(v: unknown): boolean {
  return isRecord(v) && Array.isArray(v.steps) && v.steps.every((s: unknown) => {
    if (!isRecord(s) || typeof s.pressed !== 'boolean' || !integer(s.delayMs, 0, 65535)) return false;
    if (s.kind === 'modifier') return integer(s.code, 224, 231);
    if (s.kind === 'mouse') return integer(s.code, 0, 31);
    return s.kind === 'key' && integer(s.code, 1, 255);
  });
}

function isDks(v: unknown): boolean {
  return isRecord(v) && arrOf(v.points, 4, isByte) && arrOf(v.actions, 4, (a) =>
    isRecord(a) && isAction(a.action) && integer(a.mask, 0, 1023));
}

export type ParseResult = { ok: true; backup: ProfileBackup } | { ok: false; error: string };

/** Validates every table before any device writes, including calls made by profile copy. */
function validateBackup(value: unknown, model: DeviceModel): ParseResult {
  if (!isRecord(value) || value.app !== 'better-magger' || value.format !== 1) return { ok: false, error: 'This is not a Better Magger profile backup.' };
  const b = value;
  if (!isRecord(b.model) || b.model.type !== model.type) {
    return { ok: false, error: `This backup is for a ${isRecord(b.model) && typeof b.model.name === 'string' ? b.model.name : 'different keyboard'}; you have a ${model.name} connected. Backups only work on the same model.` };
  }
  const problems: string[] = [];
  if (!isSettings(b.settings)) problems.push('settings');
  if (!arrOf(b.keymaps, model.features.layers, (m) => arrOf(m, 128, isAction))) problems.push('keymap');
  if (!arrOf(b.triggers, 128, isTrigger)) problems.push('key travel');
  const checkTable = (name: string, supported: boolean, len: number, check: (v: unknown) => boolean) => {
    if (supported ? !arrOf(b[name], len, check) : b[name] !== undefined) problems.push(name);
  };
  const f = model.features;
  checkTable('colors', f.perKeyRgb, 128, (c) => arrOf(c, 3, isByte));
  checkTable('macros', f.macros, 16, isMacro);
  checkTable('dks', f.advanced.includes('dks'), 32, isDks);
  checkTable('mt', f.advanced.some((k) => k !== 'dks' && k !== 'tgl'), 32, (m) => isRecord(m) && isAction(m.tap) && isAction(m.hold));
  checkTable('tgl', f.advanced.includes('tgl'), 32, isAction);
  if (Array.isArray(b.macros) && b.macros.every(isMacro)) {
    try { encodeMacros(b.macros as Macro[]); } catch { problems.push('macro memory capacity'); }
  }
  if (problems.length) return { ok: false, error: `The backup is damaged or incomplete (${problems.join(', ')}). Nothing was written.` };
  return { ok: true, backup: b as unknown as ProfileBackup };
}

/** Validates a backup file for the connected model before anything is written. */
export function parseBackup(text: string, model: DeviceModel): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  return validateBackup(value, model);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
