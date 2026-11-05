import type { Macro, MacroStep } from '../../core/types';
import { MODIFIER_USAGES } from './keys';

/** 2048-byte table: 64 bytes of offsets, then 4 bytes per action (PROTOCOL.md §4.9). */
export const MACRO_STEP_CAPACITY = (2048 - 64) / 4;

export const MOUSE_BUTTONS: { code: number; label: string }[] = [
  { code: 1, label: 'Left click' },
  { code: 2, label: 'Right click' },
  { code: 4, label: 'Middle click' },
  { code: 8, label: 'Forward' },
  { code: 16, label: 'Back' },
];

export function totalSteps(macros: Macro[]): number {
  return macros.reduce((n, m) => n + m.steps.length, 0);
}

export function stepLabel(step: MacroStep, keyLabel: (usage: number) => string): string {
  if (step.kind === 'mouse') return MOUSE_BUTTONS.find((b) => b.code === step.code)?.label ?? `Mouse ${step.code}`;
  if (step.kind === 'modifier') return MODIFIER_USAGES.find((m) => m.usage === step.code)?.label ?? `Modifier ${step.code}`;
  return keyLabel(step.code);
}

/** Replaces every delay with a fixed value (the last step keeps 0). */
export function simplifyDelays(steps: MacroStep[], delayMs: number): MacroStep[] {
  return steps.map((s, i) => ({ ...s, delayMs: i === steps.length - 1 ? 0 : delayMs }));
}

export function summarizeMacro(m: Macro, keyLabel: (usage: number) => string): string {
  const presses = m.steps.filter((s) => s.pressed).map((s) => stepLabel(s, keyLabel));
  if (!presses.length) return 'Empty';
  const text = presses.slice(0, 6).join(' · ');
  return presses.length > 6 ? `${text} …` : text;
}
