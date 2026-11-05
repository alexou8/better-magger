import { useEffect, useState } from 'preact/hooks';
import type { KeyAction } from '../../../core/types';
import { freeSlots, KIND_TYPE, usedSlots } from '../../lib/advanced';
import { assignTgl } from '../../state/advancedOps';
import { useTable } from '../../state/cache';
import { save, showToast } from '../../state/toast';
import { Skeleton } from '../Skeleton';
import { ActionField } from './ActionField';
import { TargetKeyboard } from './TargetKeyboard';
import { WizardFrame } from './WizardFrame';
import { targetProblem, type WizardProps } from './wizardProps';

export function TglWizard({ session: s, profile, layer, keymaps, editing, onDone }: WizardProps) {
  const map = keymaps[layer];
  const tgl = useTable('tgl');
  const [index, setIndex] = useState<number | null>(editing?.index ?? null);
  const [action, setAction] = useState<KeyAction>({ type: 0, code1: 0, code2: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing && tgl.data) setAction(tgl.data[editing.slot]);
  }, [editing, tgl.data]);
  useEffect(() => {
    if (!editing && index !== null) setAction(map[index]);
  }, [index]);

  if (editing && !tgl.data) return <Skeleton lines={2} />;

  const problem = targetProblem(map, index, editing);

  const onSave = async () => {
    if (index === null) return;
    const slot = editing?.slot ?? freeSlots(usedSlots(keymaps, [KIND_TYPE.tgl]), 1)[0];
    if (slot === undefined) return void showToast('error', 'All 32 Toggle slots are in use. Delete one first.');
    setSaving(true);
    const ok = await save('Toggle', () => assignTgl(s, profile, layer, index, slot, action));
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <WizardFrame kind="tgl" layer={layer} editing={!!editing} canSave={!problem} saving={saving} problem={problem} onSave={onSave} onCancel={onDone}>
      <h4>1. Pick the key</h4>
      <TargetKeyboard
        session={s}
        map={map}
        selected={new Set(index === null ? [] : [index])}
        onSelect={editing ? undefined : (next) => setIndex([...next][0] ?? null)}
        ariaLabel="Choose the key for Toggle"
      />
      <h4>2. Action to toggle</h4>
      <ActionField model={s.model} label="Tap to lock / unlock" action={action} onChange={setAction} />
    </WizardFrame>
  );
}
