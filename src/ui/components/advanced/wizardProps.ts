import type { KeyAction, KeyboardSession } from '../../../core/types';
import type { Binding } from '../../lib/advanced';
import { isAdvancedAction } from './TargetKeyboard';

export interface WizardProps {
  session: KeyboardSession;
  profile: number;
  layer: number;
  /** All layers of the active profile (for slot allocation). */
  keymaps: KeyAction[][];
  editing: Binding | null;
  onDone: () => void;
}

/** Why a key can't receive a new binding, or null. */
export function targetProblem(map: KeyAction[], index: number | null, editing: Binding | null): string | null {
  if (index === null) return 'Click the key you want to set up.';
  const ownKeys = editing ? [editing.index, editing.partner] : [];
  if (isAdvancedAction(map[index]) && !ownKeys.includes(index)) {
    return 'That key already has an advanced binding. Delete it first, or pick another key.';
  }
  return null;
}
