import type { BaseSettings, DeviceModel, DksSlot, KeyAction, KeyboardSession, KeyTrigger, Macro, MtSlot } from '../../core/types';
import { invalidate, loadTable } from '../state/cache';
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
  const all = <T>(arr: T[]) => arr.map((v, index) => ({ index, v }));
  const steps: (() => Promise<unknown>)[] = [() => s.writeSettings(profile, b.settings)];
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

const isByte = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 255;
const isAction = (a: unknown): a is KeyAction => {
  const o = a as KeyAction;
  return !!o && isByte(o.type) && isByte(o.code1) && isByte(o.code2);
};
const isNumObj = (o: unknown, keys: string[]) =>
  !!o && typeof o === 'object' && keys.every((k) => typeof (o as Record<string, unknown>)[k] === 'number');
const arrOf = (v: unknown, len: number, ok: (x: unknown) => boolean) => Array.isArray(v) && v.length === len && v.every(ok);

const TRIGGER_KEYS = ['switchType', 'mode', 'priority', 'actuation', 'pressPrecision', 'releasePrecision', 'rtPress', 'rtRelease', 'pressDeadzone', 'releaseDeadzone'];

export type ParseResult = { ok: true; backup: ProfileBackup } | { ok: false; error: string };

/** Validates a backup file for the connected model before anything is written. */
export function parseBackup(text: string, model: DeviceModel): ParseResult {
  let b: ProfileBackup;
  try {
    b = JSON.parse(text) as ProfileBackup;
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (b?.app !== 'better-magger' || b.format !== 1) return { ok: false, error: 'This is not a Better Magger profile backup.' };
  if (b.model?.type !== model.type) {
    return { ok: false, error: `This backup is for a ${b.model?.name ?? 'different keyboard'}; you have a ${model.name} connected. Backups only work on the same model.` };
  }
  const problems: string[] = [];
  if (!b.settings || typeof b.settings !== 'object' || !b.settings.lighting) problems.push('settings');
  if (!Array.isArray(b.keymaps) || !b.keymaps.length || b.keymaps.length > model.features.layers || !b.keymaps.every((m) => arrOf(m, 128, isAction))) problems.push('keymap');
  if (!arrOf(b.triggers, 128, (t) => isNumObj(t, TRIGGER_KEYS))) problems.push('key travel');
  if (b.colors && !arrOf(b.colors, 128, (c) => Array.isArray(c) && c.length === 3 && c.every(isByte))) problems.push('colours');
  if (b.macros && !arrOf(b.macros, 16, (m) => Array.isArray((m as Macro)?.steps))) problems.push('macros');
  if (b.dks && !arrOf(b.dks, 32, (d) => Array.isArray((d as DksSlot)?.points) && Array.isArray((d as DksSlot).actions))) problems.push('DKS');
  if (b.mt && !arrOf(b.mt, 32, (m) => isAction((m as MtSlot)?.tap) && isAction((m as MtSlot).hold))) problems.push('mod-tap');
  if (b.tgl && !arrOf(b.tgl, 32, isAction)) problems.push('toggle');
  if (problems.length) return { ok: false, error: `The backup is damaged (${problems.join(', ')}).` };
  return { ok: true, backup: b };
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
