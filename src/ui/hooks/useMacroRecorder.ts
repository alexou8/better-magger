import { useEffect, useRef } from 'preact/hooks';
import type { MacroStep } from '../../core/types';
import { hidUsageFromKeyboardEvent } from '../../data/keycodes';
import { isModifierUsage } from '../lib/keys';

/**
 * While `active`, captures keydown/keyup as macro steps with real timings (delay = time until the
 * next event), or a fixed delay when `fixedDelayMs` is given. Calls `onSteps` with the full list.
 */
export function useMacroRecorder(active: boolean, onSteps: (steps: MacroStep[]) => void, fixedDelayMs: number | null) {
  const cb = useRef(onSteps);
  cb.current = onSteps;

  useEffect(() => {
    if (!active) return;
    const steps: MacroStep[] = [];
    let last = 0;
    const record = (e: KeyboardEvent, pressed: boolean) => {
      if (e.repeat) return;
      const code = hidUsageFromKeyboardEvent(e);
      if (code === null) return;
      e.preventDefault();
      e.stopPropagation();
      const now = performance.now();
      if (steps.length) steps[steps.length - 1].delayMs = fixedDelayMs ?? Math.min(65535, Math.round(now - last));
      last = now;
      steps.push({ kind: isModifierUsage(code) ? 'modifier' : 'key', code, pressed, delayMs: 0 });
      cb.current([...steps]);
    };
    const down = (e: KeyboardEvent) => record(e, true);
    const up = (e: KeyboardEvent) => record(e, false);
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, [active, fixedDelayMs]);
}
