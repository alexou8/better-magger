import type { KeyAction, KeyboardSession, LayoutKey } from '../../../core/types';
import { describeAction } from '../../../data/keycodes';
import { KeyboardView } from '../KeyboardView';

interface Props {
  session: KeyboardSession;
  map: KeyAction[];
  selected: ReadonlySet<number>;
  onSelect?: (next: Set<number>) => void;
  /** Extra badge per key index (e.g. "A" / "B"). */
  tags?: Record<number, string>;
  ariaLabel: string;
}

export const isAdvancedAction = (a: KeyAction | undefined) => !!a && a.type >= 144 && a.type <= 150;

/** Keyboard for picking the key(s) a binding goes on; keys with bindings are marked. */
export function TargetKeyboard({ session, map, selected, onSelect, tags, ariaLabel }: Props) {
  const visual = (k: LayoutKey) => {
    if (k.index < 0) return {};
    const a = map[k.index];
    const adv = isAdvancedAction(a);
    return {
      label: describeAction(a, session.model).short,
      sub: tags?.[k.index],
      className: adv ? 'is-advanced' : undefined,
      title: adv ? 'has an advanced binding' : undefined,
    };
  };
  return <KeyboardView layout={session.layout} selected={selected} onSelect={onSelect} visual={visual} ariaLabel={ariaLabel} />;
}
