import { signal } from '@preact/signals';
import type { KeyboardSession, MacroStep } from '../../core/types';
import { session } from './session';

/** Drafts survive page/profile navigation, and belong only to their keyboard session. */
const sessions = new WeakMap<KeyboardSession, Map<number, ReturnType<typeof createDrafts>>>();

function createDrafts() {
  return { current: signal(0), steps: signal(new Map<number, MacroStep[]>()) };
}

export function macroDrafts(s: KeyboardSession, profile: number) {
  let profiles = sessions.get(s);
  if (!profiles) sessions.set(s, (profiles = new Map()));
  let drafts = profiles.get(profile);
  if (!drafts) profiles.set(profile, (drafts = createDrafts()));
  return drafts;
}

export function hasMacroDrafts(s: KeyboardSession | null): boolean {
  return !!s && [...(sessions.get(s)?.values() ?? [])].some((drafts) => drafts.steps.peek().size > 0);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (!hasMacroDrafts(session.peek())) return;
    event.preventDefault();
    event.returnValue = '';
  });
}
