import { signal } from '@preact/signals';
import type { KeyboardSession } from '../../core/types';
import { readPref, writePref } from '../lib/storage';

const names = signal<Record<string, string>>({});
/** Names belong to this browser and model; demo labels never rename real profiles. */
export function profileNameKey(s: Pick<KeyboardSession, 'model' | 'isDemo'>, profile: number) {
  return `better-magger.profile-name.v1.${s.isDemo ? 'demo' : 'device'}.${s.model.pid}.${profile}`;
}
export function profileName(s: Pick<KeyboardSession, 'model' | 'isDemo'>, profile: number): string {
  const key = profileNameKey(s, profile);
  return names.value[key] ?? readPref(key)?.trim().slice(0, 24) ?? '';
}
export function renameProfile(s: KeyboardSession, profile: number, name: string) {
  const key = profileNameKey(s, profile);
  const value = name.trim().slice(0, 24);
  names.value = { ...names.peek(), [key]: value };
  return writePref(key, value);
}
