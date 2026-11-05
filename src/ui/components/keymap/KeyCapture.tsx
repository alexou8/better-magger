import { useEffect, useState } from 'preact/hooks';
import type { KeyAction } from '../../../core/types';
import { hidUsageFromKeyboardEvent } from '../../../data/keycodes';
import { actionForUsage, isModifierUsage } from '../../lib/keys';

interface Props {
  onCapture: (a: KeyAction) => void;
}

const TIMEOUT_MS = 15000;

/**
 * "Press a key to assign": the next key press (with held modifiers, e.g. Ctrl+C) becomes the action.
 * Pressing and releasing a lone modifier assigns that modifier.
 */
export function KeyCapture({ onCapture }: Props) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    let mods = 0;
    let lastMod: number | null = null;
    const done = (a: KeyAction) => {
      setListening(false);
      onCapture(a);
    };
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      const usage = hidUsageFromKeyboardEvent(e);
      if (usage === null) return;
      if (isModifierUsage(usage)) {
        mods |= 1 << (usage - 224);
        lastMod = usage;
      } else done(actionForUsage(usage, mods));
    };
    const up = (e: KeyboardEvent) => {
      const usage = hidUsageFromKeyboardEvent(e);
      if (usage !== null && usage === lastMod) done(actionForUsage(usage));
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    const timer = setTimeout(() => setListening(false), TIMEOUT_MS);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      clearTimeout(timer);
    };
  }, [listening]);

  return listening ? (
    <div class="capture is-listening" role="status" aria-live="assertive">
      <span class="capture__pulse" aria-hidden="true" />
      <span>Press a key or combo on your keyboard… (Esc is assignable too)</span>
      <button type="button" class="btn btn--small" onClick={() => setListening(false)}>
        Cancel
      </button>
    </div>
  ) : (
    <button type="button" class="btn capture" onClick={() => setListening(true)}>
      ⌨ Press a key to assign
    </button>
  );
}
