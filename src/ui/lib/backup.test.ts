import { describe, expect, it, vi } from 'vitest';
import { ALL_MODELS } from '../../data/models';
import type { KeyboardSession } from '../../core/types';
import { defaultTrigger } from '../../core/units';
import { applyProfile, parseBackup, type ProfileBackup } from './backup';

const model = ALL_MODELS.find((m) => m.pid === 0xfc67)!;
const action = () => ({ type: 0, code1: 4, code2: 0 });
function backup(): ProfileBackup {
  return {
    app: 'better-magger', format: 1, exportedAt: '2026-01-01T00:00:00Z',
    model: { name: model.name, pid: model.pid, type: model.type }, profile: 0,
    settings: {
      pollingRate: 1, debounce: 0, bottomOutActuation: false, tachyonMode: false,
      lockWin: false, lockAltTab: false, lockAltF4: false,
      lighting: { effect: 6, brightness: 80, speed: 2, direction: 0, multicolor: true, r: 0, g: 160, b: 255, sleepMinutes: 10 },
    },
    keymaps: Array.from({ length: model.features.layers }, () => Array.from({ length: 128 }, action)),
    triggers: Array.from({ length: 128 }, () => defaultTrigger(model)),
    colors: Array.from({ length: 128 }, () => [0, 0, 0]),
    macros: Array.from({ length: 16 }, () => ({ steps: [] })),
    dks: Array.from({ length: 32 }, () => ({ points: [0, 0, 0, 0], actions: Array.from({ length: 4 }, () => ({ action: action(), mask: 0 })) })),
    mt: Array.from({ length: 32 }, () => ({ tap: action(), hold: action() })),
    tgl: Array.from({ length: 32 }, action),
  };
}

function fakeSession() {
  const names = ['writeSettings', 'writeKeys', 'writeTriggers', 'writeKeyColors', 'writeMacros', 'writeDks', 'writeMt', 'writeTgl'];
  const methods = Object.fromEntries(names.map((name) => [name, vi.fn().mockResolvedValue(undefined)]));
  return { s: { model, ...methods } as unknown as KeyboardSession, methods };
}

describe('profile backup validation', () => {
  it('accepts a complete profile, including zero-filled unused DKS slots', () => {
    expect(parseBackup(JSON.stringify(backup()), model).ok).toBe(true);
  });

  it.each([
    ['missing lighting field', (b: ProfileBackup) => { delete (b.settings.lighting as Partial<typeof b.settings.lighting>).brightness; }],
    ['unexpected OS setting', (b: ProfileBackup) => { Object.assign(b.settings, { osMode: 'mac' }); }],
    ['invalid boolean', (b: ProfileBackup) => { Object.assign(b.settings, { lockWin: 'false' }); }],
    ['out of range brightness', (b: ProfileBackup) => { b.settings.lighting.brightness = 101; }],
    ['missing keymap layer', (b: ProfileBackup) => { b.keymaps.pop(); }],
    ['bad action byte', (b: ProfileBackup) => { b.keymaps[0][0].code1 = -1; }],
    ['fractional travel', (b: ProfileBackup) => { b.triggers[0].actuation = 1.5; }],
    ['invalid precision', (b: ProfileBackup) => { b.triggers[0].pressPrecision = 4; }],
    ['negative travel', (b: ProfileBackup) => { b.triggers[0].rtPress = -1; }],
    ['null colours', (b: ProfileBackup) => { Object.assign(b, { colors: null }); }],
    ['missing macro table', (b: ProfileBackup) => { delete b.macros; }],
    ['malformed macro step', (b: ProfileBackup) => { b.macros![0].steps = [null as never]; }],
    ['invalid modifier usage', (b: ProfileBackup) => { b.macros![0].steps = [{ kind: 'modifier', code: 4, pressed: true, delayMs: 0 }]; }],
    ['oversized macro table', (b: ProfileBackup) => { b.macros![0].steps = Array.from({ length: 496 }, () => ({ kind: 'key', code: 4, pressed: true, delayMs: 0 })); }],
    ['oversized DKS points', (b: ProfileBackup) => { Object.assign(b.dks![0], { points: [1, 2, 3, 4, 5] }); }],
    ['missing DKS action', (b: ProfileBackup) => { b.dks![0].actions.pop(); }],
    ['invalid DKS mask', (b: ProfileBackup) => { b.dks![0].actions[0].mask = 1024; }],
    ['invalid MT action', (b: ProfileBackup) => { b.mt![0].tap.type = 256; }],
  ])('rejects %s before any write, for imports and programmatic restore', async (_label, mutate) => {
    const b = backup();
    mutate(b);
    expect(parseBackup(JSON.stringify(b), model).ok).toBe(false);
    const { s, methods } = fakeSession();
    await expect(applyProfile(s, 0, b)).rejects.toThrow();
    Object.values(methods).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it('rejects non-finite numbers supplied programmatically', async () => {
    const b = backup();
    b.settings.lighting.sleepMinutes = Infinity;
    const { s, methods } = fakeSession();
    await expect(applyProfile(s, 0, b)).rejects.toThrow();
    expect(methods.writeSettings).not.toHaveBeenCalled();
  });

  it('rejects unsupported target profiles before writes', async () => {
    const { s, methods } = fakeSession();
    await expect(applyProfile(s, model.features.profiles, backup())).rejects.toThrow('Invalid target profile');
    expect(methods.writeSettings).not.toHaveBeenCalled();
  });

  it('checks connected model identity', () => {
    const b = backup(); b.model.type++;
    expect(parseBackup(JSON.stringify(b), model)).toMatchObject({ ok: false });
  });

  it('writes every validated table of a valid profile', async () => {
    const { s, methods } = fakeSession();
    await applyProfile(s, 0, backup());
    expect(methods.writeSettings).toHaveBeenCalledTimes(1);
    expect(methods.writeKeys).toHaveBeenCalledTimes(model.features.layers);
    expect(methods.writeMacros).toHaveBeenCalledTimes(1);
    expect(methods.writeDks).toHaveBeenCalledTimes(32);
    const settingsOrder = methods.writeSettings.mock.invocationCallOrder[0];
    for (const [name, method] of Object.entries(methods)) {
      if (name !== 'writeSettings') expect(Math.max(...method.mock.invocationCallOrder)).toBeLessThan(settingsOrder);
    }
  });
});
