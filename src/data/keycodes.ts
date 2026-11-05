import type { DeviceModel, KeyAction } from '../core/types';
import { CONSUMER_LABELS, JIS_LABELS, PICKER_LIGHTING, PICKER_MEDIA, PICKER_SPECIAL, SPECIAL_LABELS } from './gen/keycodes';

/** Action types (byte 0 of a key action). */
export const ACTION = {
  NONE: 0,
  KEYBOARD: 16,
  MOUSE_BUTTON: 32,
  MOUSE_WHEEL: 33,
  CONSUMER: 48,
  SYSTEM: 64,
  MACRO: 112,
  DKS: 144,
  TGL: 145,
  MT: 146,
  RS: 147,
  SOCD: 148,
  OKS: 149,
  TD: 150,
  SPECIAL: 240,
  EMPTY_READBACK: 255,
} as const;

export const MOD_BITS = { LCtrl: 1, LShift: 2, LAlt: 4, LGui: 8, RCtrl: 16, RShift: 32, RAlt: 64, RGui: 128 } as const;

export const EMPTY_ACTION: KeyAction = { type: 0, code1: 0, code2: 0 };

export const FN_CODE = 255;

const act = (type: number, code1: number, code2 = 0): KeyAction => ({ type, code1, code2 });

export function actionsEqual(a: KeyAction, b: KeyAction): boolean {
  return a.type === b.type && a.code1 === b.code1 && a.code2 === b.code2;
}

/** A bare modifier key: {16, bitmask, 0}. */
export function isModifierAction(a: KeyAction): boolean {
  return a.type === ACTION.KEYBOARD && a.code1 !== 0 && a.code2 === 0;
}

const singleBit = (mask: number): number => (mask > 0 && (mask & (mask - 1)) === 0 ? Math.log2(mask) : -1);

/**
 * The official app's N(): the code a default-keymap entry is matched against layout key codes
 * with. Bare modifiers normalise to their HID usage 224..231, any Fn key to 255. Codes of other
 * actions are made unique and >255 so they never match a layout code.
 */
export function actionCode(a: KeyAction): number {
  if (a.type === ACTION.SPECIAL && a.code1 === 0xff) return FN_CODE;
  if (a.type === ACTION.KEYBOARD) {
    if (a.code2 === 0) {
      const bit = singleBit(a.code1);
      return bit >= 0 ? 224 + bit : 0x100 | a.code1;
    }
    const isModUsage = a.code2 >= 224 && a.code2 <= 231;
    return a.code1 === 0 || isModUsage ? a.code2 : (a.code1 << 8) | a.code2;
  }
  return 0x10000 | (a.type << 16) | (a.code1 << 8) | a.code2;
}

/** Inverse of actionCode() for layout codes (0..255). */
export function codeToAction(code: number): KeyAction {
  if (code === 0) return EMPTY_ACTION;
  if (code === FN_CODE) return act(ACTION.SPECIAL, 0xff, 0);
  if (code >= 224 && code <= 231) return act(ACTION.KEYBOARD, 1 << (code - 224), 0);
  return act(ACTION.KEYBOARD, 0, code);
}

// ------------------------------------------------------------------ HID usage names

/** [label, short] per HID keyboard usage (US legends). */
const USAGE: Record<number, [string, string]> = {};
const named = (u: number, label: string, short = label) => (USAGE[u] = [label, short]);
for (let i = 0; i < 26; i++) named(4 + i, String.fromCharCode(65 + i));
for (let i = 0; i < 9; i++) named(30 + i, String(i + 1));
named(39, '0');
[
  [40, 'Enter'], [41, 'Esc'], [42, 'Backspace', 'Bksp'], [43, 'Tab'], [44, 'Space'], [45, '-'], [46, '='],
  [47, '['], [48, ']'], [49, '\\'], [50, 'ISO #', '#'], [51, ';'], [52, "'"], [53, '`'], [54, ','], [55, '.'],
  [56, '/'], [57, 'Caps Lock', 'Caps'], [70, 'Print Screen', 'PrtSc'], [71, 'Scroll Lock', 'ScrLk'],
  [72, 'Pause'], [73, 'Insert', 'Ins'], [74, 'Home'], [75, 'Page Up', 'PgUp'], [76, 'Delete', 'Del'],
  [77, 'End'], [78, 'Page Down', 'PgDn'], [79, 'Right', '→'], [80, 'Left', '←'], [81, 'Down', '↓'],
  [82, 'Up', '↑'], [83, 'Num Lock', 'NumLk'], [84, 'Num /'], [85, 'Num *'], [86, 'Num -'], [87, 'Num +'],
  [88, 'Num Enter', 'NEnt'], [98, 'Num 0'], [99, 'Num .'], [100, 'ISO \\', '\\'], [101, 'Menu'],
  [102, 'Power'], [103, 'Num ='], [116, 'Execute', 'Exec'], [117, 'Help'], [127, 'Mute'],
  [128, 'Volume Up', 'Vol+'], [129, 'Volume Down', 'Vol-'], [133, 'Num ,'], [135, 'Ro'], [136, 'Kana'],
  [137, 'Yen', '¥'], [138, 'Henkan', '変換'], [139, 'Muhenkan', '無変換'], [144, 'Lang 1', 'Lang1'],
  [145, 'Lang 2', 'Lang2'],
].forEach(([u, l, s]) => named(u as number, l as string, s as string | undefined));
for (let i = 0; i < 12; i++) named(58 + i, `F${i + 1}`);
for (let i = 0; i < 12; i++) named(104 + i, `F${i + 13}`);
for (let i = 0; i < 9; i++) named(89 + i, `Num ${i + 1}`);

const MODIFIERS: [label: string, short: string][] = [
  ['Left Ctrl', 'Ctrl'], ['Left Shift', 'Shift'], ['Left Alt', 'Alt'], ['Left Win', 'Win'],
  ['Right Ctrl', 'RCtrl'], ['Right Shift', 'RShift'], ['Right Alt', 'RAlt'], ['Right Win', 'RWin'],
];
MODIFIERS.forEach(([l, s], bit) => named(224 + bit, l, s));

/** Primary JIS legend where it differs from the US one. */
const JIS_SHORT: Record<number, string> = {
  45: '-', 46: '^', 47: '@', 48: '[', 49: ']', 50: ']', 51: ';', 52: ':', 53: 'E/J', 135: '\\', 136: 'かな', 137: '¥',
};

function usageName(usage: number, jis: boolean): [string, string] {
  const us = USAGE[usage] ?? [`Key 0x${usage.toString(16).toUpperCase().padStart(2, '0')}`, `0x${usage.toString(16)}`];
  if (!jis || !(usage in JIS_SHORT)) return us;
  return [JIS_LABELS[usage] ?? us[0], JIS_SHORT[usage]];
}

function modifierNames(mask: number): string[] {
  return MODIFIERS.filter((_, bit) => mask & (1 << bit)).map(([, s]) => s);
}

// ------------------------------------------------------------------ describeAction

export interface ActionDescription {
  label: string;
  short: string;
  category: string;
}

const CONSUMER_LONG: Record<number, string> = {
  0xe9: 'Volume Up', 0xea: 'Volume Down', 0xe2: 'Mute', 0xcd: 'Play / Pause', 0xb7: 'Stop',
  0xb6: 'Previous Track', 0xb5: 'Next Track', 0x6f: 'Screen Brightness Up', 0x70: 'Screen Brightness Down',
  0x192: 'Calculator', 0x194: 'My Computer', 0x18a: 'Email', 0x183: 'Media Player',
};
const MOUSE_BUTTONS: Record<number, string> = { 1: 'Left', 2: 'Right', 4: 'Middle', 8: 'Forward', 16: 'Back' };
const SYSTEM: Record<number, string> = { 1: 'Power', 2: 'Sleep', 4: 'Wake Up' };
const ADVANCED: Record<number, [string, string]> = {
  [ACTION.DKS]: ['Dynamic keystroke', 'DKS'],
  [ACTION.TGL]: ['Toggle', 'TGL'],
  [ACTION.MT]: ['Mod-tap', 'MT'],
  [ACTION.RS]: ['Rappy Snappy', 'RS'],
  [ACTION.SOCD]: ['SOCD', 'SOCD'],
  [ACTION.OKS]: ['One-key switch', 'OKS'],
  [ACTION.TD]: ['Tap dance', 'TD'],
};
const isLightingSpecial = (code1: number) => (code1 >= 16 && code1 <= 21) || (code1 >= 46 && code1 <= 61);

const desc = (label: string, short: string, category: string): ActionDescription => ({ label, short, category });

function describeKeyboard(a: KeyAction, jis: boolean): ActionDescription {
  const mods = modifierNames(a.code1);
  if (a.code2 === 0) {
    if (mods.length === 0) return desc('None', '', 'none');
    if (mods.length === 1) return desc(MODIFIERS[singleBit(a.code1)][0], mods[0], 'modifier');
    return desc(mods.join('+'), mods.join('+'), 'modifier');
  }
  const [label, short] = usageName(a.code2, jis);
  if (mods.length === 0) return desc(label, short, a.code2 >= 224 && a.code2 <= 231 ? 'modifier' : 'keyboard');
  const combo = [...mods, short].join('+');
  return desc(combo, combo, 'keyboard');
}

function describeSpecial(a: KeyAction): ActionDescription {
  if (a.code1 === 0xff) {
    const name = a.code2 === 0 ? 'FN' : `FN${a.code2}`;
    return desc(a.code2 === 0 ? 'Fn' : `Fn layer ${a.code2}`, name, 'layer');
  }
  const name = SPECIAL_LABELS[`${a.code1},${a.code2}`] ?? SPECIAL_LABELS[`${a.code1},0`];
  if (!name) return unknown(a);
  return desc(name, name, isLightingSpecial(a.code1) ? 'lighting' : 'special');
}

function unknown(a: KeyAction): ActionDescription {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
  return desc(`Unknown (${hex(a.type)} ${hex(a.code1)} ${hex(a.code2)})`, '?', 'unknown');
}

/** Human labels for any key action. `short` fits on a keycap. */
export function describeAction(a: KeyAction, model: DeviceModel): ActionDescription {
  switch (a.type) {
    case ACTION.NONE:
    case ACTION.EMPTY_READBACK:
      return desc('None', '', 'none');
    case ACTION.KEYBOARD:
      return describeKeyboard(a, model.features.jis);
    case ACTION.MOUSE_BUTTON: {
      const b = MOUSE_BUTTONS[a.code1] ?? `Buttons ${a.code1}`;
      return desc(`Mouse ${b}`, `M-${b}`, 'mouse');
    }
    case ACTION.MOUSE_WHEEL: {
      const delta = a.code2 > 127 ? a.code2 - 256 : a.code2;
      const dir = delta > 0 ? 'Up' : 'Down';
      return desc(`Wheel ${dir}${Math.abs(delta) > 1 ? ` ×${Math.abs(delta)}` : ''}`, `Wh${delta > 0 ? '↑' : '↓'}`, 'mouse');
    }
    case ACTION.CONSUMER: {
      const usage = a.code1 | (a.code2 << 8);
      const short = CONSUMER_LABELS[usage];
      if (!short) return desc(`Media 0x${usage.toString(16).padStart(4, '0')}`, 'Media', 'media');
      return desc(CONSUMER_LONG[usage] ?? short, short, 'media');
    }
    case ACTION.SYSTEM: {
      const name = SYSTEM[a.code1];
      return name ? desc(name, name, 'system') : unknown(a);
    }
    case ACTION.MACRO:
      return desc(`Macro ${a.code1 + 1}`, `M${a.code1 + 1}`, 'macro');
    case ACTION.SPECIAL:
      return describeSpecial(a);
  }
  const adv = ADVANCED[a.type];
  if (adv) {
    const n = a.code1 + 1;
    const hold = a.type === ACTION.MT ? ` (hold ${a.code2 * 10} ms)` : '';
    return desc(`${adv[0]} ${n}${hold}`, `${adv[1]} ${n}`, 'advanced');
  }
  return unknown(a);
}

// ------------------------------------------------------------------ picker

export interface PickerCategory {
  id: string;
  name: string;
  keys: { action: KeyAction; label: string }[];
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const BASIC_ORDER = [
  41, ...range(58, 69), 70, 71, 72,
  53, ...range(30, 39), 45, 46, 42, 73, 74, 75,
  43, 20, 26, 8, 21, 23, 28, 24, 12, 18, 19, 47, 48, 49, 76, 77, 78,
  57, 4, 22, 7, 9, 10, 11, 13, 14, 15, 51, 52, 40,
  29, 27, 6, 25, 5, 17, 16, 54, 55, 56, 44, 82, 80, 81, 79, 101,
];
const JIS_KEYS = [137, 135, 50, 139, 138, 136];
const NUMPAD = [83, 84, 85, 86, 87, 88, ...range(89, 99), 103, 133];

/** Key picker contents for the model. FN layer keys are numbered per profile (4p..4p+3). */
export function pickerCategories(model: DeviceModel, profile = 0): PickerCategory[] {
  const entry = (a: KeyAction) => ({ action: a, label: describeAction(a, model).label });
  const keys = (usages: number[]) => usages.map((u) => entry(act(ACTION.KEYBOARD, 0, u)));
  const tuples = (list: [number, number, number][]) => list.map(([t, c1, c2]) => entry(act(t, c1, c2)));
  const jis = model.features.jis;
  const cats: PickerCategory[] = [
    { id: 'basic', name: 'Basic', keys: keys(jis ? [...BASIC_ORDER, ...JIS_KEYS] : BASIC_ORDER) },
    { id: 'modifiers', name: 'Modifiers', keys: range(0, 7).map((bit) => entry(act(ACTION.KEYBOARD, 1 << bit, 0))) },
    { id: 'numpad', name: 'Numpad', keys: keys(NUMPAD) },
    {
      id: 'extra',
      name: 'F13–F24 & international',
      keys: keys([...range(104, 115), 100, ...(jis ? [] : JIS_KEYS), 144, 145]),
    },
    {
      id: 'media',
      name: 'Media & system',
      keys: [...tuples(PICKER_MEDIA), ...[1, 2, 4].map((c) => entry(act(ACTION.SYSTEM, c)))],
    },
    {
      id: 'mouse',
      name: 'Mouse',
      keys: [
        ...[1, 2, 4, 16, 8].map((b) => entry(act(ACTION.MOUSE_BUTTON, b))),
        entry(act(ACTION.MOUSE_WHEEL, 0, 1)),
        entry(act(ACTION.MOUSE_WHEEL, 0, 255)),
      ],
    },
    { id: 'layer', name: 'Fn layers', keys: range(4 * profile, 4 * profile + 3).map((n) => entry(act(ACTION.SPECIAL, 0xff, n))) },
  ];
  if (model.features.lighting) cats.push({ id: 'lighting', name: 'Lighting', keys: tuples(PICKER_LIGHTING) });
  cats.push({
    id: 'special',
    name: 'Special',
    keys: [entry(EMPTY_ACTION), ...tuples(PICKER_SPECIAL.filter(([t]) => t === ACTION.SPECIAL))],
  });
  if (model.features.macros)
    cats.push({ id: 'macro', name: 'Macros', keys: range(0, 15).map((i) => entry(act(ACTION.MACRO, i))) });
  return cats;
}

// ------------------------------------------------------------------ browser key events

const CODE_TO_USAGE: Record<string, number> = {
  Enter: 40, Escape: 41, Backspace: 42, Tab: 43, Space: 44, Minus: 45, Equal: 46, BracketLeft: 47,
  BracketRight: 48, Backslash: 49, Semicolon: 51, Quote: 52, Backquote: 53, Comma: 54, Period: 55,
  Slash: 56, CapsLock: 57, PrintScreen: 70, ScrollLock: 71, Pause: 72, Insert: 73, Home: 74, PageUp: 75,
  Delete: 76, End: 77, PageDown: 78, ArrowRight: 79, ArrowLeft: 80, ArrowDown: 81, ArrowUp: 82,
  NumLock: 83, NumpadDivide: 84, NumpadMultiply: 85, NumpadSubtract: 86, NumpadAdd: 87, NumpadEnter: 88,
  Numpad0: 98, NumpadDecimal: 99, IntlBackslash: 100, ContextMenu: 101, Power: 102, NumpadEqual: 103,
  Help: 117, NumpadComma: 133, IntlRo: 135, KanaMode: 136, IntlYen: 137, Convert: 138, NonConvert: 139,
  Lang1: 144, Lang2: 145, ControlLeft: 224, ShiftLeft: 225, AltLeft: 226, MetaLeft: 227, OSLeft: 227,
  ControlRight: 228, ShiftRight: 229, AltRight: 230, MetaRight: 231, OSRight: 231,
};
for (let i = 0; i < 26; i++) CODE_TO_USAGE[`Key${String.fromCharCode(65 + i)}`] = 4 + i;
for (let i = 1; i <= 9; i++) CODE_TO_USAGE[`Digit${i}`] = 29 + i;
CODE_TO_USAGE.Digit0 = 39;
for (let i = 1; i <= 9; i++) CODE_TO_USAGE[`Numpad${i}`] = 88 + i;
for (let i = 1; i <= 12; i++) CODE_TO_USAGE[`F${i}`] = 57 + i;
for (let i = 13; i <= 24; i++) CODE_TO_USAGE[`F${i}`] = 91 + i;

/** HID keyboard usage for a DOM KeyboardEvent (by physical `code`), or null if unmapped. */
export function hidUsageFromKeyboardEvent(e: KeyboardEvent): number | null {
  return CODE_TO_USAGE[e.code] ?? null;
}
