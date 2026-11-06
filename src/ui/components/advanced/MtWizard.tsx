import { useEffect, useState } from 'preact/hooks';
import type { KeyAction } from '../../../core/types';
import { freeSlots, MT_TABLE_TYPES, usedSlots } from '../../lib/advanced';
import { assignMt } from '../../state/advancedOps';
import { useTable } from '../../state/cache';
import { save, showToast } from '../../state/toast';
import { Skeleton } from '../Skeleton';
import { LoadError } from '../LoadError';
import { ActionField } from './ActionField';
import { TargetKeyboard } from './TargetKeyboard';
import { WizardFrame } from './WizardFrame';
import { targetProblem, type WizardProps } from './wizardProps';

const LEFT_CTRL: KeyAction = { type: 16, code1: 1, code2: 0 };

export function MtWizard({
  session: s,
  profile,
  layer,
  keymaps,
  editing,
  onDone,
}: WizardProps) {
  const map = keymaps[layer];
  const mt = useTable('mt');
  const [index, setIndex] = useState<number | null>(editing?.index ?? null);
  const [tap, setTap] = useState<KeyAction>({ type: 0, code1: 0, code2: 0 });
  const [hold, setHold] = useState<KeyAction>(LEFT_CTRL);
  const [holdMs, setHoldMs] = useState(editing?.holdMs ?? 200);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing && mt.data) {
      setTap(mt.data[editing.slot].tap);
      setHold(mt.data[editing.slot].hold);
    }
  }, [editing, mt.data]);
  useEffect(() => {
    if (!editing && index !== null) setTap(map[index]);
  }, [index]);

  if (mt.error) return <LoadError message={mt.error} onRetry={mt.reload} />;
  if (editing && !mt.data) return <Skeleton lines={3} />;

  const problem = targetProblem(map, index, editing);

  const onSave = async () => {
    if (index === null) return;
    const slot =
      editing?.slot ?? freeSlots(usedSlots(keymaps, MT_TABLE_TYPES), 1)[0];
    if (slot === undefined)
      return void showToast(
        'error',
        'All 32 Mod-Tap / SOCD / RS / OKS slots are in use. Delete one first.',
      );
    setSaving(true);
    const ok = await save('Mod-Tap', () =>
      assignMt(s, profile, layer, index, slot, tap, hold, holdMs),
    );
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <WizardFrame
      kind="mt"
      layer={layer}
      editing={!!editing}
      canSave={!problem}
      saving={saving}
      problem={problem}
      onSave={onSave}
      onCancel={onDone}
    >
      <h3>1. Pick the key</h3>
      <TargetKeyboard
        session={s}
        map={map}
        selected={new Set(index === null ? [] : [index])}
        onSelect={
          editing ? undefined : (next) => setIndex([...next][0] ?? null)
        }
        ariaLabel="Choose the key for Mod-Tap"
      />
      <h3>2. Choose the two actions</h3>
      <div class="grid-2">
        <ActionField
          model={s.model}
          label="When tapped"
          action={tap}
          onChange={setTap}
        />
        <ActionField
          model={s.model}
          label="When held"
          action={hold}
          onChange={setHold}
        />
      </div>
      <h3>3. Hold time</h3>
      <div class="field">
        <label class="field__label" for="mt-hold">
          Hold longer than <b>{holdMs} ms</b> to get the hold action
        </label>
        <input
          id="mt-hold"
          type="range"
          min={50}
          max={1000}
          step={10}
          value={holdMs}
          onInput={(e) => setHoldMs(Number(e.currentTarget.value))}
        />
        <p class="help">
          200 ms suits most people. Lower is snappier but you may trigger the
          hold action by accident.
        </p>
      </div>
    </WizardFrame>
  );
}
