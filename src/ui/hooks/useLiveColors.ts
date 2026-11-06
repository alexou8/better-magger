import { useEffect, useRef, useState } from 'preact/hooks';
import type { KeyboardSession } from '../../core/types';
import type { Rgb } from '../lib/color';
import { watchLiveLighting } from '../lib/liveLighting';
import { pendingWrites, errorMessage } from '../state/toast';
import { profileTarget } from '../state/session';

export function useLiveColors(s: KeyboardSession, enabled: boolean, continuous: boolean) {
  const [colors, setColors] = useState<Rgb[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const snapshot = useRef<Rgb[] | null>(null);
  const previousAttempt = useRef(-1);
  const switching = profileTarget.value !== null;
  useEffect(() => {
    if (!enabled || switching) return;
    const refresh = previousAttempt.current !== attempt;
    previousAttempt.current = attempt;
    if (!continuous && snapshot.current && !refresh) return;
    setError(null);
    return watchLiveLighting({
      read: signal => s.readLiveColors(signal),
      onFrame: frame => { snapshot.current = frame; setColors(frame); },
      onError: err => setError(errorMessage(err)),
      canRead: () => pendingWrites.peek() === 0 && profileTarget.peek() === null,
      once: !continuous,
    });
  }, [s, enabled, continuous, attempt, switching]);
  return { colors, error, refresh: () => setAttempt(n => n + 1) };
}
