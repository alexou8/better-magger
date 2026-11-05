import { describe, expect, it } from 'vitest';
import {
  classifyReport,
  consecutiveRuns,
  decodeDks,
  decodeFirmware,
  decodeMacros,
  decodeMt,
  decodeSettings,
  decodeTrigger,
  encodeDks,
  encodeFrame,
  encodeMacros,
  encodeMt,
  encodeTrigger,
  patchSettings,
  readFrames,
  withLiveTravel,
  writeFrames,
} from './protocol';
import type { KeyTrigger, Macro } from './types';

const head = (f: Uint8Array, n = 10) => [...f.subarray(0, n)];

describe('frames', () => {
  it('encodes the factory reset frame from PROTOCOL.md §4.12', () => {
    const f = encodeFrame(0xee, 0, 1, [0xff]);
    expect(f.length).toBe(64);
    expect(head(f, 9)).toEqual([0x55, 0xee, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0xff]);
    expect(f.subarray(9).every((b) => b === 0)).toBe(true);
  });

  it('encodes setConfigMode(profile 2, mode 1) like the official app', () => {
    // [14, 0, 2+e+o, 2, 0, 0, 0, e, o]
    expect(head(encodeFrame(0x0e, 0, 2, [2, 1]))).toEqual([0x55, 0x0e, 0, 5, 2, 0, 0, 0, 2, 1]);
  });

  it('uses (LEN + OFF_LO + OFF_HI) as read checksum', () => {
    expect(head(encodeFrame(0x03, 0, 32), 8)).toEqual([0x55, 0x03, 0, 32, 32, 0, 0, 0]);
    // keymap profile 1 layer 2: OFF = 2048 + 1024 = 0x0C00
    expect(head(encodeFrame(0x08, 0x0c00, 56), 8)).toEqual([0x55, 0x08, 0, (56 + 0x0c) & 0xff, 56, 0x00, 0x0c, 0]);
    expect(encodeFrame(0x08, 0x01f0, 56)[3]).toBe((56 + 0xf0 + 0x01) & 0xff);
  });

  it('chunks reads and writes at 56 bytes with absolute offsets', () => {
    const reads = readFrames(0x05, 64, 64);
    expect(reads.map((f) => [f[4], f[5] | (f[6] << 8)])).toEqual([
      [56, 64],
      [8, 120],
    ]);
    const data = Uint8Array.from({ length: 64 }, (_, i) => i);
    const writes = writeFrames(0x06, 128, data);
    expect(writes.map((f) => [f[4], f[5] | (f[6] << 8), f[8]])).toEqual([
      [56, 128, 0],
      [8, 184, 56],
    ]);
    const sum = (f: Uint8Array) => (f[4] + f[5] + f[6] + f.subarray(8, 8 + f[4]).reduce((a, b) => a + b, 0)) & 0xff;
    for (const f of writes) expect(f[3]).toBe(sum(f));
  });

  it('rejects oversized frames', () => {
    expect(() => encodeFrame(0x09, 0, 57)).toThrow(RangeError);
    expect(() => encodeFrame(0x09, 0x10000, 1)).toThrow(RangeError);
  });
});

describe('input report classification', () => {
  const r = (...bytes: number[]) => Uint8Array.from({ length: 64 }, (_, i) => bytes[i] ?? 0);
  it('routes unsolicited reports to events and the rest to replies', () => {
    expect(classifyReport(r(0xa0, 16, 0, 4))).toBe('travel');
    expect(classifyReport(r(0xa1, 0, 2))).toBe('profile');
    expect(classifyReport(r(0xa2, 0, 1))).toBe('reset');
    expect(classifyReport(r(0xa3, 0, 2))).toBe('osMode');
    expect(classifyReport(r(0xaa, 0xfa))).toBe('lighting');
    expect(classifyReport(r(0x00, 0x00, 0xfa, 0xfb, 0x06, 0x01))).toBe('link');
    expect(classifyReport(r(0xaa, 0x08, 0, 0, 56, 0, 0, 0, 0xfa, 0xfb, 0x06, 0x00))).toBe('reply');
    expect(classifyReport(r(0x55, 0x05))).toBe('reply');
    expect(classifyReport(r(0x00, 0x05))).toBe('reply');
  });

  it('prefers the dongle link marker over the AA FA lighting header', () => {
    expect(classifyReport(r(0xaa, 0xfa, 0xfb, 0x06, 0x00))).toBe('link');
    expect(classifyReport(r(0xaa, 0xfa, 0xfb, 0x06, 0x01))).toBe('link');
    expect(classifyReport(r(0xaa, 0xfa, 0x01))).toBe('lighting');
  });
});

describe('firmware', () => {
  it('reads hex digits as decimal', () => {
    expect(decodeFirmware(Uint8Array.of(0x07, 0x01), 109)).toEqual({ version: 107, display: '1.07', updateAvailable: true });
    expect(decodeFirmware(Uint8Array.of(0x09, 0x01), 109).updateAvailable).toBe(false);
    expect(decodeFirmware(Uint8Array.of(0x48, 0x41), 109).updateAvailable).toBe(true);
  });
});

describe('func block', () => {
  const block = () => {
    const f = new Uint8Array(64);
    f[4] = 0x31; // tick 3, 8 kHz
    f[6] = 0b101;
    f[7] = (2 << 5) | 0b1101; // debounce high, debug, bit2, tachyon
    f[8] = 6;
    f[10] = 1;
    f[35] = 20;
    f[40] = 0x5a; // unknown byte
    return f;
  };

  it('decodes fields', () => {
    expect(decodeSettings(block())).toMatchObject({
      pollingRate: 1,
      debounce: 2,
      tachyonMode: true,
      bottomOutActuation: false,
      lockWin: true,
      lockAltTab: false,
      lockAltF4: true,
      lighting: { effect: 6, speed: 3, sleepMinutes: 10 },
    });
  });

  it('changing bottom-out actuation keeps debounce (official 0x1D mask bug)', () => {
    const f = patchSettings(block(), { bottomOutActuation: true });
    expect(f[7]).toBe((2 << 5) | 0b1111);
    expect(decodeSettings(f).debounce).toBe(2);
  });

  it('touches only the patched bits', () => {
    const before = block();
    const after = patchSettings(before, { debounce: 1, pollingRate: 4 });
    expect(after[7]).toBe((1 << 5) | 0b1101);
    expect(after[4]).toBe(0x34);
    const changed = [...after].map((b, i) => (b !== before[i] ? i : -1)).filter((i) => i >= 0);
    expect(changed).toEqual([4, 7]);
    expect(before[7]).toBe((2 << 5) | 0b1101); // input not mutated
  });

  it('encodes lighting speed inverted and "never sleep"', () => {
    const f = patchSettings(block(), { lighting: { speed: 4, sleepMinutes: 0, multicolor: false, r: 300 } });
    expect([f[10], f[35], f[36], f[12], f[14]]).toEqual([0, 0, 1, 0, 255]);
    expect(decodeSettings(f).lighting).toMatchObject({ speed: 4, sleepMinutes: 0, multicolor: false });
    const g = patchSettings(f, { lighting: { sleepMinutes: 30 } });
    expect([g[35], g[36]]).toEqual([60, 0]);
  });

  it('toggles live travel (bit 3) only', () => {
    expect(withLiveTravel(block(), false)[7]).toBe((2 << 5) | 0b0101);
  });
});

describe('key triggers', () => {
  const t: KeyTrigger = {
    switchType: 2,
    mode: 1,
    priority: 2,
    actuation: 200,
    pressPrecision: 1,
    releasePrecision: 2,
    rtPress: 300,
    rtRelease: 2,
    pressDeadzone: 10,
    releaseDeadzone: 3,
  };

  it('encodes with the documented masks', () => {
    expect([...encodeTrigger(t)]).toEqual([0xa2, 0x21, 199, 0x0c, 0x2b, 0x01 | (10 << 1), 0x01, 3 << 1]);
  });

  it('roundtrips', () => {
    expect(decodeTrigger(encodeTrigger(t))).toEqual(t);
    const max = { ...t, actuation: 512, rtPress: 512, rtRelease: 1, pressDeadzone: 127, releaseDeadzone: 127 };
    expect(decodeTrigger(encodeTrigger(max))).toEqual(max);
  });

  it('masks priority out of key_mode (official bug 5)', () => {
    const d = decodeTrigger(Uint8Array.of(0xa0, 0x22, 0, 0, 0, 0, 0, 0));
    expect(d.mode).toBe(2);
    expect(d.priority).toBe(2);
  });
});

describe('macros', () => {
  const macros: Macro[] = [
    {
      steps: [
        { kind: 'modifier', code: 225, pressed: true, delayMs: 10 },
        { kind: 'key', code: 4, pressed: true, delayMs: 30 },
        { kind: 'key', code: 4, pressed: false, delayMs: 5 },
        { kind: 'modifier', code: 225, pressed: false, delayMs: 0 },
      ],
    },
    { steps: [] },
    {
      steps: [
        { kind: 'mouse', code: 1, pressed: true, delayMs: 300 },
        { kind: 'mouse', code: 1, pressed: false, delayMs: 0 },
      ],
    },
  ];

  it('encodes mouse actions as kind 3 and modifiers as bitmasks', () => {
    const table = encodeMacros(macros);
    const m3 = table[4] | (table[5] << 8);
    expect([...table.subarray(m3, m3 + 8)]).toEqual([44, 1, 0x40 | 3, 1, 0, 0, 0x80 | 3, 1]);
    const m1 = table[0] | (table[1] << 8);
    expect([...table.subarray(m1, m1 + 4)]).toEqual([10, 0, 0x40 | 1, 0x02]);
  });

  it('roundtrips, empty macros included', () => {
    const decoded = decodeMacros(encodeMacros(macros), 16);
    expect(decoded.slice(0, 3)).toEqual(macros);
    expect(decoded.slice(3).every((m) => m.steps.length === 0)).toBe(true);
  });

  it('stores a recorded modifier key as a modifier step', () => {
    const [m] = decodeMacros(encodeMacros([{ steps: [{ kind: 'key', code: 224, pressed: true, delayMs: 0 }] }]), 1);
    expect(m.steps[0]).toEqual({ kind: 'modifier', code: 224, pressed: true, delayMs: 0 });
  });

  it('stays within the 2 KB table on garbage data', () => {
    const garbage = new Uint8Array(2048).fill(0x41); // offsets 0x4141, no "last" flags
    garbage[0] = 64;
    garbage[1] = 0;
    const [m] = decodeMacros(garbage, 1);
    expect(m.steps.length).toBe((2048 - 64) / 4);
  });

  it('rejects macros that do not fit', () => {
    const huge: Macro = { steps: Array.from({ length: 500 }, () => ({ kind: 'key', code: 4, pressed: true, delayMs: 0 })) };
    expect(() => encodeMacros([huge])).toThrow(RangeError);
  });
});

describe('advanced keys', () => {
  it('roundtrips DKS slots', () => {
    const dks = {
      points: [10, 30, 30, 10] as [number, number, number, number],
      actions: [
        { action: { type: 16, code1: 0, code2: 4 }, mask: 0x3ff },
        { action: { type: 16, code1: 2, code2: 0 }, mask: 0b0000_000_111 },
        { action: { type: 0, code1: 0, code2: 0 }, mask: 0 },
        { action: { type: 48, code1: 0xe9, code2: 0 }, mask: 0x200 },
      ],
    };
    const bytes = encodeDks(dks);
    expect(bytes.length).toBe(24);
    expect([...bytes.subarray(4, 9)]).toEqual([16, 0, 4, 0xff, 0x03]);
    expect(decodeDks(bytes)).toEqual(dks);
  });

  it('roundtrips MT slots', () => {
    const slots = [{ tap: { type: 16, code1: 0, code2: 41 }, hold: { type: 16, code1: 1, code2: 0 } }];
    const table = new Uint8Array(192);
    table.set(encodeMt(slots));
    expect(decodeMt(table)[0]).toEqual(slots[0]);
  });
});

describe('consecutiveRuns', () => {
  it('groups adjacent indices and keeps the last write', () => {
    const runs = consecutiveRuns([
      { index: 5, value: 'a' },
      { index: 3, value: 'b' },
      { index: 4, value: 'c' },
      { index: 9, value: 'd' },
      { index: 4, value: 'e' },
    ]);
    expect(runs).toEqual([
      { start: 3, values: ['b', 'e', 'a'] },
      { start: 9, values: ['d'] },
    ]);
  });
});
