import { useEffect } from 'preact/hooks';
import type { KeyboardSession } from '../../core/types';
import { showToast, errorMessage } from '../state/toast';
import { useTravelEvents } from './useTravelEvents';

/** Turns the keyboard's live travel stream on while `on` is true (and off on unmount / disconnect). */
export function useLiveTravel(s: KeyboardSession | null, profile: number, on: boolean) {
  useEffect(() => {
    if (!s || !on) return;
    s.setLiveTravel(profile, true).catch((err: unknown) => showToast('error', `Live view failed: ${errorMessage(err)}`));
    return () => {
      s.setLiveTravel(profile, false).catch(() => undefined); // may already be disconnected
    };
  }, [s, profile, on]);
  return useTravelEvents(s, on);
}
