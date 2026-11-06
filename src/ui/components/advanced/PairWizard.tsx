import { useState } from 'preact/hooks';
import type { AdvancedKind } from '../../../core/types';
import {
  freeSlots,
  MT_TABLE_TYPES,
  socdFromNibble,
  SOCD_OPTIONS,
  usedSlots,
  type SocdPriority,
} from '../../lib/advanced';
import { assignPair } from '../../state/advancedOps';
import { useTable } from '../../state/cache';
import { save, showToast } from '../../state/toast';
import { Toggle } from '../Toggle';
import { LoadError } from '../LoadError';
import { Skeleton } from '../Skeleton';
import { TargetKeyboard } from './TargetKeyboard';
import { WizardFrame } from './WizardFrame';
import { targetProblem, type WizardProps } from './wizardProps';

interface Props extends WizardProps {
  kind: AdvancedKind;
}

/** RS / SOCD / OKS: bind two keys to each other (PROTOCOL.md §4.7). */
export function PairWizard({
  kind,
  session: s,
  profile,
  layer,
  keymaps,
  editing,
  onDone,
}: Props) {
  const map = keymaps[layer];
  const triggers = useTable('triggers', 0, kind === 'socd');
  const [a, setA] = useState<number | null>(editing?.index ?? null);
  const [b, setB] = useState<number | null>(editing?.partner ?? null);
  const [picking, setPicking] = useState<'a' | 'b'>(a === null ? 'a' : 'b');
  const [priority, setPriority] = useState<SocdPriority | null>(null);
  const [matchTriggers, setMatchTriggers] = useState(true);
  const [saving, setSaving] = useState(false);

  if (kind === 'socd' && triggers.error)
    return <LoadError message={triggers.error} onRetry={triggers.reload} />;
  if (kind === 'socd' && !triggers.data) return <Skeleton lines={3} />;

  const currentPriority: SocdPriority =
    priority ??
    (editing && triggers.data
      ? socdFromNibble(triggers.data[editing.index].priority)
      : 'last');

  const pick = (next: Set<number>) => {
    const idx = [...next][0];
    if (idx === undefined) return;
    if (picking === 'a') {
      setA(idx);
      if (b === idx) setB(null);
      setPicking('b');
    } else {
      setB(idx);
      if (a === idx) setA(null);
    }
  };

  const problem =
    (a === null ? 'Click key A.' : null) ??
    (b === null ? 'Now click key B.' : null) ??
    targetProblem(map, a, editing) ??
    targetProblem(map, b, editing);

  const onSave = async () => {
    if (a === null || b === null) return;
    const reuse = editing
      ? [editing.slot, editing.partnerSlot].filter(
          (x): x is number => x !== undefined,
        )
      : [];
    const slots = freeSlots(usedSlots(keymaps, MT_TABLE_TYPES), 2, reuse);
    if (slots.length < 2)
      return void showToast(
        'error',
        'Not enough free slots (a pair needs two). Delete a Mod-Tap, SOCD, RS or OKS binding first.',
      );
    setSaving(true);
    const ok = await save(kind.toUpperCase(), () =>
      assignPair(s, profile, {
        kind,
        layer,
        a,
        b,
        slots: [slots[0], slots[1]],
        priority: currentPriority,
        matchTriggers,
      }),
    );
    setSaving(false);
    if (ok) onDone();
  };

  const tags: Record<number, string> = {};
  if (a !== null) tags[a] = 'A';
  if (b !== null) tags[b] = 'B';

  return (
    <WizardFrame
      kind={kind}
      layer={layer}
      editing={!!editing}
      canSave={!problem}
      saving={saving}
      problem={problem}
      onSave={onSave}
      onCancel={onDone}
    >
      <h3>1. Pick the two keys</h3>
      {!editing && (
        <div class="segmented" role="radiogroup" aria-label="Which key to pick">
          {(['a', 'b'] as const).map((k) => (
            <button
              type="button"
              role="radio"
              key={k}
              aria-checked={picking === k}
              class={picking === k ? 'is-active' : ''}
              onClick={() => setPicking(k)}
            >
              Key {k.toUpperCase()}:{' '}
              {(k === 'a' ? a : b) === null
                ? 'click a key'
                : s.layout.keys.find((x) => x.index === (k === 'a' ? a : b))
                    ?.label}
            </button>
          ))}
        </div>
      )}
      <TargetKeyboard
        session={s}
        map={map}
        selected={new Set([a, b].filter((x): x is number => x !== null))}
        onSelect={editing ? undefined : pick}
        tags={tags}
        ariaLabel={`Choose key ${picking.toUpperCase()}`}
      />
      {kind === 'socd' && (
        <>
          <h3>2. When both keys are held</h3>
          <p class="help">
            Fixed-key priority is experimental; verify the result on your
            keyboard before relying on it.
          </p>
          <div class="choice-list" role="radiogroup">
            {SOCD_OPTIONS.map((o) => (
              <label
                key={o.id}
                class={`choice${currentPriority === o.id ? ' is-active' : ''}`}
              >
                <input
                  type="radio"
                  name="socd-priority"
                  checked={currentPriority === o.id}
                  onChange={() => setPriority(o.id)}
                />
                <span>
                  <b>{o.name}</b>
                  <span class="help">{o.help}</span>
                </span>
              </label>
            ))}
          </div>
          <Toggle
            checked={matchTriggers}
            onChange={setMatchTriggers}
            label="Give key B the same actuation and Rapid Trigger settings as key A"
            help="Recommended, so both directions feel identical."
          />
        </>
      )}
    </WizardFrame>
  );
}
