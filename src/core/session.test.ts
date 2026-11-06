import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeToAction } from '../data/keycodes';
import { getLayoutDef } from '../data/layouts';
import { ALL_MODELS, findModel } from '../data/models';
import { HidTransport } from '../hid/transport';
import { MockHidDevice } from './mock';
import { decodeSettings } from './protocol';
import { openSession, resolveIndices } from './session';
import type { KeyAction, KeyboardSession, SessionEvent } from './types';
import { defaultTrigger } from './units';

const open: KeyboardSession[] = [];

async function demo(pid = 0xfc67, timeoutMs?: number) {
  const model = findModel(pid)!;
  const layout = getLayoutDef(model.layoutId);
  const device = new MockHidDevice(model, layout, { latencyMs: [0, 1] });
  const transport = new HidTransport(device.asHidDevice(), { hid: null, timeoutMs });
  await transport.open();
  const session = await openSession({ transport, model, layout, productName: device.productName, isDemo: true });
  open.push(session);
  const events: SessionEvent[] = [];
  session.on((e) => events.push(e));
  return { session, kb: device.keyboard, events, model, layout, device };
}

afterEach(async () => {
  for (const s of open.splice(0)) await s.close();
  vi.restoreAllMocks();
});

const waitFor = async (cond: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 10));
  }
};

const MAGGER = ALL_MODELS.filter((m) => m.family !== 'Other');

describe('layout index resolution', () => {
  it.each(MAGGER.map((m) => [m.name, m.pid] as const))('binds every key of %s to a unique slot', async (_name, pid) => {
    const { session, layout } = await demo(pid);
    const indices = session.layout.keys.map((k) => k.index);
    expect(indices).toEqual(layout.keys.map((k) => k.demoIndex));
    expect(indices.every((i) => i >= 0 && i < 128)).toBe(true);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('normalises modifiers and Fn, assigns duplicates in order, leaves unknown real positions disabled', () => {
    const def = getLayoutDef('K68_JIS');
    const keymap: KeyAction[] = Array.from({ length: 128 }, () => ({ type: 0, code1: 0, code2: 0 }));
    const spaces = def.keys.filter((k) => k.code === 44);
    expect(spaces.length).toBe(2);
    keymap[100] = codeToAction(44);
    keymap[101] = codeToAction(44);
    keymap[5] = { type: 16, code1: 0x02, code2: 0 }; // LShift as bitmask
    keymap[6] = { type: 16, code1: 0, code2: 229 }; // RShift as usage
    keymap[7] = { type: 240, code1: 255, code2: 1 }; // Fn
    const indices = resolveIndices(def, keymap);
    const at = (code: number) => def.keys.map((k, i) => (k.code === code ? indices[i] : -2)).filter((i) => i !== -2);
    expect(at(44)).toEqual([100, 101]);
    expect(at(225)).toEqual([5]);
    expect(at(229)).toEqual([6]);
    expect(at(255)).toEqual([7]);
    const esc = def.keys.findIndex((k) => k.code === 41);
    expect(indices[esc]).toBe(-1);
    expect(resolveIndices(def, keymap, true)[esc]).toBe(def.keys[esc].demoIndex);
  });

  it('falls back to built-in positions when the default keymap cannot be read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const model = findModel(0xfe24)!;
    const layout = getLayoutDef(model.layoutId);
    const device = new MockHidDevice(model, layout, { latencyMs: [0, 0] });
    device.keyboard.dropNextReplies(2);
    const transport = new HidTransport(device.asHidDevice(), { hid: null, timeoutMs: 20 });
    await transport.open();
    const session = await openSession({ transport, model, layout, productName: 'x', isDemo: true });
    open.push(session);
    expect(session.layout.keys.map((k) => k.index)).toEqual(layout.keys.map((k) => k.demoIndex));
  });

  it('fails a real connection and releases the device when physical key positions cannot be read', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const model = findModel(0xfc67)!;
    const layout = getLayoutDef(model.layoutId);
    const device = new MockHidDevice(model, layout, { latencyMs: [0, 0] });
    device.keyboard.dropNextReplies(2);
    const transport = new HidTransport(device.asHidDevice(), { hid: null, timeoutMs: 20 });
    await transport.open();
    await expect(openSession({ transport, model, layout, productName: 'physical keyboard', isDemo: false }))
      .rejects.toThrow(/Could not read the keyboard's physical key positions/);
    expect(device.opened).toBe(false);
    expect(transport.isOpen).toBe(false);
  });

  it('rejects an unrecognised real keymap instead of enabling guessed demo positions', async () => {
    const model = findModel(0xfc67)!;
    const layout = getLayoutDef(model.layoutId);
    const device = new MockHidDevice(model, layout, { latencyMs: [0, 0] });
    device.keyboard.table('defaultKeymap', 0).fill(0);
    const transport = new HidTransport(device.asHidDevice(), { hid: null });
    await transport.open();
    await expect(openSession({ transport, model, layout, productName: 'physical keyboard', isDemo: false }))
      .rejects.toThrow(/unrecognised default keymap/);
    expect(device.opened).toBe(false);
  });
});

describe('func block read-modify-write', () => {
  it('parallel writeSettings calls do not lose updates', async () => {
    const { session, kb } = await demo();
    await Promise.all([
      session.writeSettings(0, { debounce: 2 }),
      session.writeSettings(0, { lighting: { brightness: 30, effect: 3 } }),
      session.writeSettings(0, { bottomOutActuation: true }),
      session.writeSettings(0, { lockAltF4: true }),
      session.setLiveTravel(0, false),
    ]);
    const s = await session.readSettings(0);
    expect(s).toMatchObject({ debounce: 2, bottomOutActuation: true, lockAltF4: true, lighting: { brightness: 30, effect: 3 } });
    expect(decodeSettings(kb.table('func', 0))).toEqual(s);
    expect(kb.badFrames).toBe(0);
  });

  it('keeps profiles separate', async () => {
    const { session } = await demo();
    await session.writeSettings(1, { lighting: { r: 1, g: 2, b: 3 } });
    expect((await session.readSettings(0)).lighting.r).not.toBe(1);
    expect((await session.readSettings(1)).lighting).toMatchObject({ r: 1, g: 2, b: 3 });
  });

  it('resolves a polling-rate change even if the keyboard drops off before replying', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const { session, kb } = await demo(0xfc67, 30);
    await session.readSettings(0);
    kb.dropNextReplies(1);
    const s = await session.writeSettings(0, { pollingRate: 3 });
    expect(s.pollingRate).toBe(3);
    expect(kb.table('func', 0)[4] & 0x0f).toBe(3);
  });

  it('surfaces a failed polling-rate send when the device has not disconnected', async () => {
    const { session, kb, device } = await demo();
    await session.readSettings(0);
    vi.spyOn(device, 'sendReport').mockRejectedValueOnce(new Error('USB transfer failed'));
    await expect(session.writeSettings(0, { pollingRate: 3 })).rejects.toThrow(/USB transfer failed/);
    expect(kb.table('func', 0)[4] & 0x0f).toBe(1);
    expect((await session.readSettings(0)).pollingRate).toBe(1);
  });

  it('re-reads the func block after a failed write instead of patching a stale copy', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const { session, kb } = await demo(0xfc67, 20);
    expect((await session.readSettings(0)).debounce).toBe(0);
    kb.dropNextReplies(2); // the keyboard applies the write but both replies are lost
    await expect(session.writeSettings(0, { debounce: 2 })).rejects.toThrow(/did not answer/);
    const s = await session.writeSettings(0, { lockWin: true });
    expect(s).toMatchObject({ debounce: 2, lockWin: true });
    expect(decodeSettings(kb.table('func', 0))).toEqual(s);
  });

  it('rejects out-of-range profiles', async () => {
    const { session } = await demo();
    expect(() => session.readSettings(4)).toThrow(RangeError);
  });
});

describe('tables', () => {
  it('writes and reads keys, triggers, colours', async () => {
    const { session, model } = await demo();
    await session.writeKeys(1, 2, [
      { index: 20, action: { type: 16, code1: 1, code2: 6 } },
      { index: 21, action: { type: 112, code1: 2, code2: 0 } },
      { index: 90, action: { type: 48, code1: 0xe9, code2: 0 } },
    ]);
    const keys = await session.readKeymap(1, 2);
    expect(keys[20]).toEqual({ type: 16, code1: 1, code2: 6 });
    expect(keys[21]).toEqual({ type: 112, code1: 2, code2: 0 });
    expect(keys[90]).toEqual({ type: 48, code1: 0xe9, code2: 0 });
    expect(await session.readKeymap(0, 2)).not.toEqual(keys);

    const trigger = { ...defaultTrigger(model), mode: 1 as const, actuation: 55, rtPress: 7, rtRelease: 9, pressDeadzone: 4 };
    await session.writeTriggers(2, [10, 11, 12, 40].map((index) => ({ index, trigger })));
    const triggers = await session.readTriggers(2);
    expect(triggers[11]).toEqual(trigger);
    expect(triggers[40]).toEqual(trigger);
    expect(triggers[13]).toEqual(defaultTrigger(model));

    await session.writeKeyColors(0, [{ index: 3, rgb: [1, 2, 3] }]);
    expect((await session.readKeyColors(0))[3]).toEqual([1, 2, 3]);
  });

  it('writes and reads macros, DKS, MT and TGL', async () => {
    const { session } = await demo();
    const macros = [{ steps: [{ kind: 'mouse' as const, code: 2, pressed: true, delayMs: 20 }, { kind: 'mouse' as const, code: 2, pressed: false, delayMs: 0 }] }];
    await session.writeMacros(3, macros);
    const read = await session.readMacros(3);
    expect(read.length).toBe(16);
    expect(read[0]).toEqual(macros[0]);
    expect(read[1].steps).toEqual([]);

    const dks = {
      points: [10, 30, 30, 10] as [number, number, number, number],
      actions: [0, 1, 2, 3].map((i) => ({ action: { type: 16, code1: 0, code2: 4 + i }, mask: 1 << i })),
    };
    await session.writeDks(0, 31, dks);
    expect((await session.readDks(0))[31]).toEqual(dks);

    const mt = [{ tap: { type: 16, code1: 0, code2: 41 }, hold: { type: 16, code1: 1, code2: 0 } }];
    await session.writeMt(0, mt);
    expect((await session.readMt(0))[0]).toEqual(mt[0]);

    await session.writeTgl(1, 5, { type: 16, code1: 0, code2: 57 });
    expect((await session.readTgl(1))[5]).toEqual({ type: 16, code1: 0, code2: 57 });
  });

  it('reports firmware and switches profiles', async () => {
    const { session, model } = await demo(0xfc66);
    expect(await session.getFirmware()).toEqual({ version: model.latestFw, display: '1.09', updateAvailable: false });
    await session.selectProfile(2);
    expect(await session.getActiveProfile()).toBe(2);
  });

  it.each([4, 255])('rejects malformed active profile %i on a real session instead of selecting profile zero', async (profile) => {
    const model = findModel(0xfc67)!;
    const layout = getLayoutDef(model.layoutId);
    const device = new MockHidDevice(model, layout, { latencyMs: [0, 0] });
    const transport = new HidTransport(device.asHidDevice(), { hid: null });
    await transport.open();
    const session = await openSession({ transport, model, layout, productName: 'physical keyboard', isDemo: false });
    open.push(session);
    device.keyboard.activeProfile = profile;
    await expect(session.getActiveProfile()).rejects.toThrow(`Profile ${profile} is not available`);
  });
});

describe('events', () => {
  it('does not take an unsolicited 0xA1 report as the reply of a read', async () => {
    const { session, kb, events } = await demo();
    const expected = await session.readKeymap(0, 0);
    kb.injectBeforeNextReply(Uint8Array.of(0xa1, 0, 2, 0, 0, 0, 0, 0, 9, 9, 9));
    expect(await session.readKeymap(0, 0)).toEqual(expected);
    expect(events).toContainEqual({ kind: 'profileChanged', profile: 2 });
  });

  it('maps profile numbers the model does not have to profile 0', async () => {
    const { session, kb, events, model } = await demo(0xfb3f); // BLA75 (FB3F): single profile
    expect(model.features.profiles).toBe(1);
    kb.injectBeforeNextReply(Uint8Array.of(0xa1, 0, 2));
    await session.getActiveProfile();
    expect(events).toContainEqual({ kind: 'profileChanged', profile: 0 });
  });

  it('streams live travel for layout keys while enabled', async () => {
    const { session, events, kb } = await demo();
    await session.setLiveTravel(0, true);
    expect((kb.table('func', 0)[7] >> 3) & 1).toBe(1);
    await waitFor(() => events.some((e) => e.kind === 'travel' && e.raw > 0));
    const slots = new Set(session.layout.keys.map((k) => k.index));
    const travel = events.filter((e) => e.kind === 'travel');
    expect(travel.every((e) => slots.has(e.index))).toBe(true);
    await session.setLiveTravel(0, false);
  });

  it('announces factory reset completion', async () => {
    const { session, events } = await demo();
    await session.factoryReset();
    await waitFor(() => events.some((e) => e.kind === 'resetDone'));
  });
});
