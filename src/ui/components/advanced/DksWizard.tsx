import { useEffect, useState } from 'preact/hooks';
import type { DksSlot } from '../../../core/types';
import { dksActionUsed, DKS_MAX_POINT, emptyDks, maskToRow, normaliseDks, rowToMask } from '../../lib/dks';
import { freeSlots, KIND_TYPE, usedSlots } from '../../lib/advanced';
import { assignDks } from '../../state/advancedOps';
import { useTable } from '../../state/cache';
import { save, showToast } from '../../state/toast';
import { RawMmSlider } from '../RawMmSlider';
import { Skeleton } from '../Skeleton';
import { LoadError } from '../LoadError';
import { DksGrid, type DksLine } from './DksGrid';
import { TargetKeyboard } from './TargetKeyboard';
import { WizardFrame } from './WizardFrame';
import { targetProblem, type WizardProps } from './wizardProps';

const POINT_LABELS = ['Point 1: first actuation', 'Point 2: bottom', 'Point 3: lift from bottom', 'Point 4: final release'];

function linesFrom(slot: DksSlot): DksLine[] {
  return slot.actions.map((a) => ({ action: a.action, row: maskToRow(a.mask) }));
}

export function DksWizard({ session: s, profile, layer, keymaps, editing, onDone }: WizardProps) {
  const map = keymaps[layer];
  const dks = useTable('dks');
  const [index, setIndex] = useState<number | null>(editing?.index ?? null);
  const [points, setPoints] = useState<DksSlot['points']>(emptyDks().points);
  const [lines, setLines] = useState<DksLine[]>(linesFrom(emptyDks()));
  const [saving, setSaving] = useState(false);

  // Prefill from the slot when editing, or with the key's own action held throughout.
  useEffect(() => {
    if (editing && dks.data) {
      const slot = normaliseDks(dks.data[editing.slot]);
      setPoints(slot.points);
      setLines(linesFrom(slot));
    }
  }, [editing, dks.data]);
  useEffect(() => {
    if (!editing && index !== null) {
      setLines((ls) => ls.map((l, i) => (i === 0 ? { action: map[index], row: ['hold', 'hold', 'hold', 'hold'] } : l)));
    }
  }, [index]);

  if (dks.error) return <LoadError message={dks.error} onRetry={dks.reload} />;
  if (editing && !dks.data) return <Skeleton lines={4} />;

  const setPoint = (i: number, v: number) => {
    const p = [...points] as DksSlot['points'];
    p[i] = v;
    // keep 1 <= p0 <= p1 <= 30 and 1 <= p3 <= p2 <= 30
    if (i === 0) p[1] = Math.max(p[1], v);
    if (i === 1) p[0] = Math.min(p[0], v);
    if (i === 2) p[3] = Math.min(p[3], v);
    if (i === 3) p[2] = Math.max(p[2], v);
    setPoints(p);
  };

  const slot: DksSlot = { points, actions: lines.map((l) => ({ action: l.action, mask: rowToMask(l.row) })) };
  const problem = targetProblem(map, index, editing) ?? (slot.actions.some(dksActionUsed) ? null : 'Give at least one action a Tap or Hold.');

  const onSave = async () => {
    if (index === null) return;
    const slotId = editing?.slot ?? freeSlots(usedSlots(keymaps, [KIND_TYPE.dks]), 1)[0];
    if (slotId === undefined) return void showToast('error', 'All 32 DKS slots are in use. Delete a DKS binding first.');
    setSaving(true);
    const ok = await save('DKS', () => assignDks(s, profile, layer, index, slotId, slot));
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <WizardFrame kind="dks" layer={layer} editing={!!editing} canSave={!problem} saving={saving} problem={problem} onSave={onSave} onCancel={onDone}>
      <h4>1. Pick the key</h4>
      <TargetKeyboard
        session={s}
        map={map}
        selected={new Set(index === null ? [] : [index])}
        onSelect={editing ? undefined : (next) => setIndex([...next][0] ?? null)}
        ariaLabel="Choose the key for DKS"
      />
      <h4>2. Set the depth points</h4>
      <div class="grid-2">
        {points.map((v, i) => (
          <RawMmSlider
            key={i}
            id={`dks-p${i}`}
            label={POINT_LABELS[i]}
            raw={v}
            min={1}
            max={DKS_MAX_POINT}
            rawPerMm={10}
            onChange={(n) => setPoint(i, n)}
          />
        ))}
      </div>
      <h4>3. Choose what happens at each phase</h4>
      <DksGrid model={s.model} lines={lines} onChange={setLines} />
    </WizardFrame>
  );
}
