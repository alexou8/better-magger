import type { KeyAction, KeyboardSession, KeyTrigger } from '../../core/types';
import { getCached, setCached } from './cache';

/** Writes key actions to one layer and mirrors them in the cache. */
export async function applyKeys(
  s: KeyboardSession,
  profile: number,
  layer: number,
  changes: { index: number; action: KeyAction }[],
): Promise<void> {
  if (!changes.length) return;
  await s.writeKeys(profile, layer, changes);
  const map = getCached(profile, 'keymap', layer);
  if (map) {
    const next = map.slice();
    for (const c of changes) next[c.index] = c.action;
    setCached(profile, 'keymap', next, layer);
  }
}

/** Writes key triggers and mirrors them in the cache. */
export async function applyTriggers(
  s: KeyboardSession,
  profile: number,
  changes: { index: number; trigger: KeyTrigger }[],
): Promise<void> {
  if (!changes.length) return;
  await s.writeTriggers(profile, changes);
  const all = getCached(profile, 'triggers');
  if (all) {
    const next = all.slice();
    for (const c of changes) next[c.index] = c.trigger;
    setCached(profile, 'triggers', next);
  }
}
