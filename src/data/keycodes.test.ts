import { describe, expect, it } from 'vitest';
import { actionCode, codeToAction, describeAction, hidUsageFromKeyboardEvent, isModifierAction, pickerCategories } from './keycodes';
import { findModel } from './models';

const plus = findModel(0xfc67)!;
const jis = findModel(0xfc60)!;
const d = (type: number, code1: number, code2: number, model = plus) => describeAction({ type, code1, code2 }, model);

describe('describeAction', () => {
  it('labels keyboard keys, modifiers and combos', () => {
    expect(d(16, 0, 4)).toEqual({ label: 'A', short: 'A', category: 'keyboard' });
    expect(d(16, 1, 6).label).toBe('Ctrl+C');
    expect(d(16, 0x22, 0x3b).label).toBe('Shift+RShift+F2');
    expect(d(16, 2, 0)).toEqual({ label: 'Left Shift', short: 'Shift', category: 'modifier' });
    expect(d(16, 5, 0).short).toBe('Ctrl+Alt');
    expect(d(16, 0, 42).short).toBe('Bksp');
  });

  it('uses JIS legends on JIS models', () => {
    expect(d(16, 0, 53, jis).short).toBe('E/J');
    expect(d(16, 0, 47, jis).short).toBe('@');
    expect(d(16, 0, 47).short).toBe('[');
  });

  it('labels media, mouse, system and layer keys', () => {
    expect(d(48, 0xe9, 0)).toMatchObject({ label: 'Volume Up', short: 'Vol+', category: 'media' });
    expect(d(48, 0x23, 0x02).short).toBe('Web Home');
    expect(d(32, 1, 0)).toMatchObject({ label: 'Mouse Left', category: 'mouse' });
    expect(d(33, 0, 255).label).toBe('Wheel Down');
    expect(d(64, 1, 0).label).toBe('Power');
    expect(d(240, 255, 0).short).toBe('FN');
    expect(d(240, 255, 3)).toMatchObject({ short: 'FN3', category: 'layer' });
    expect(d(240, 46, 0)).toMatchObject({ label: 'RGB Mode+', category: 'lighting' });
    expect(d(240, 6, 0).label).toBe('Win/Mac');
  });

  it('labels macros and advanced keys 1-based', () => {
    expect(d(112, 2, 0)).toMatchObject({ label: 'Macro 3', short: 'M3', category: 'macro' });
    expect(d(144, 1, 0).short).toBe('DKS 2');
    expect(d(146, 0, 20).label).toBe('Mod-tap 1 (hold 200 ms)');
    expect(d(145, 3, 0).short).toBe('TGL 4');
    expect(d(148, 0, 7).short).toBe('SOCD 1');
    expect(d(147, 1, 7).short).toBe('RS 2');
    expect(d(149, 4, 7).short).toBe('OKS 5');
  });

  it('labels empty and unknown actions', () => {
    expect(d(0, 0, 0).category).toBe('none');
    expect(d(255, 255, 255).category).toBe('none');
    expect(d(99, 1, 2)).toMatchObject({ category: 'unknown', label: 'Unknown (63 01 02)' });
  });
});

describe('action codes', () => {
  it('normalises bare modifiers and Fn like the official N()', () => {
    expect(actionCode({ type: 16, code1: 0x20, code2: 0 })).toBe(229);
    expect(actionCode({ type: 16, code1: 0, code2: 224 })).toBe(224);
    expect(actionCode({ type: 240, code1: 255, code2: 7 })).toBe(255);
    expect(actionCode({ type: 16, code1: 1, code2: 6 })).toBeGreaterThan(255);
    for (const code of [4, 44, 224, 231, 255]) expect(actionCode(codeToAction(code))).toBe(code);
    expect(isModifierAction(codeToAction(226))).toBe(true);
  });
});

describe('picker and key events', () => {
  it('offers the basic keys, per-profile Fn keys and macros', () => {
    const cats = pickerCategories(plus, 1);
    expect(cats.map((c) => c.id)).toEqual(['basic', 'modifiers', 'numpad', 'extra', 'media', 'mouse', 'layer', 'lighting', 'special', 'macro']);
    expect(cats.find((c) => c.id === 'layer')!.keys.map((k) => k.action.code2)).toEqual([4, 5, 6, 7]);
    expect(cats.every((c) => c.keys.every((k) => k.label && !k.label.startsWith('Unknown')))).toBe(true);
    const jisBasic = pickerCategories(jis).find((c) => c.id === 'basic')!;
    expect(jisBasic.keys.some((k) => k.action.code2 === 137)).toBe(true);
  });

  it('maps DOM key codes to HID usages', () => {
    const ev = (code: string) => ({ code }) as KeyboardEvent;
    expect(hidUsageFromKeyboardEvent(ev('KeyA'))).toBe(4);
    expect(hidUsageFromKeyboardEvent(ev('Digit0'))).toBe(39);
    expect(hidUsageFromKeyboardEvent(ev('F13'))).toBe(104);
    expect(hidUsageFromKeyboardEvent(ev('Numpad1'))).toBe(89);
    expect(hidUsageFromKeyboardEvent(ev('ShiftRight'))).toBe(229);
    expect(hidUsageFromKeyboardEvent(ev('Unidentified'))).toBeNull();
  });
});
