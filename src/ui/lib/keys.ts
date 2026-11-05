import type { DeviceModel, KeyAction } from '../../core/types';
import { describeAction, pickerCategories } from '../../data/keycodes';

export interface PickerKey {
  action: KeyAction;
  label: string;
}

export interface PickerCategory {
  id: string;
  name: string;
  keys: PickerKey[];
}

export const MACRO_COUNT = 16;
export const ACTION_MACRO = 112;

export function macroAction(i: number): KeyAction {
  return { type: ACTION_MACRO, code1: i, code2: 0 };
}

/** Picker categories from the keycode table, plus a Macros tab when the model supports macros. */
export function categoriesFor(model: DeviceModel): PickerCategory[] {
  const cats = pickerCategories(model);
  if (model.features.macros && !cats.some((c) => c.keys.some((k) => k.action.type === ACTION_MACRO))) {
    cats.push({
      id: 'macros',
      name: 'Macros',
      keys: Array.from({ length: MACRO_COUNT }, (_, i) => ({ action: macroAction(i), label: `M${i + 1}` })),
    });
  }
  return cats;
}

/** Plain (unmodified) keyboard keys as { usage, label }, for the combo builder and macro editor. */
export function basicKeys(model: DeviceModel): { usage: number; label: string }[] {
  const seen = new Set<number>();
  const out: { usage: number; label: string }[] = [];
  for (const cat of pickerCategories(model)) {
    for (const k of cat.keys) {
      const a = k.action;
      if (a.type === 16 && a.code1 === 0 && a.code2 > 0 && !seen.has(a.code2)) {
        seen.add(a.code2);
        out.push({ usage: a.code2, label: describeAction(a, model).label });
      }
    }
  }
  return out;
}

/** HID usages 224..231 are the modifier keys. */
export const MODIFIER_USAGES: { usage: number; label: string }[] = [
  { usage: 224, label: 'Left Ctrl' },
  { usage: 225, label: 'Left Shift' },
  { usage: 226, label: 'Left Alt' },
  { usage: 227, label: 'Left Win/Cmd' },
  { usage: 228, label: 'Right Ctrl' },
  { usage: 229, label: 'Right Shift' },
  { usage: 230, label: 'Right Alt' },
  { usage: 231, label: 'Right Win/Cmd' },
];

export function isModifierUsage(usage: number): boolean {
  return usage >= 224 && usage <= 231;
}

/** Keyboard action for a HID usage: modifiers become {16, mask, 0}, others {16, mods, usage}. */
export function actionForUsage(usage: number, mods = 0): KeyAction {
  if (isModifierUsage(usage)) return { type: 16, code1: mods | (1 << (usage - 224)), code2: 0 };
  return { type: 16, code1: mods, code2: usage };
}
