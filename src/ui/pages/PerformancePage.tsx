import { useRef, useState } from 'preact/hooks';
import type { KeyTrigger, LayoutKey } from '../../core/types';
import { rawToMm } from '../../core/units';
import type { PageProps } from '../App';
import { KeyboardView, type KeyVisual } from '../components/KeyboardView';
import { LoadError } from '../components/LoadError';
import { PresetBar } from '../components/performance/PresetBar';
import { TriggerEditor } from '../components/performance/TriggerEditor';
import { SelectionToolbar } from '../components/SelectionToolbar';
import { Skeleton } from '../components/Skeleton';
import { Toggle } from '../components/Toggle';
import { useDebouncedWriter } from '../hooks/useDebouncedWriter';
import { useLiveTravel } from '../hooks/useLiveTravel';
import { actuationColor, applyPreset, clampTrigger, fullTravel, type Preset } from '../lib/trigger';
import { setCached, useTable } from '../state/cache';
import { save } from '../state/toast';
import { applyTriggers } from '../state/writes';

type Changes = Map<number, KeyTrigger>;

const sameTrigger = (a: KeyTrigger, b: KeyTrigger) =>
  (Object.keys(a) as (keyof KeyTrigger)[]).every((k) => a[k] === b[k]);

export function PerformancePage({ session: s, profile }: PageProps) {
  const model = s.model;
  const lim = model.features.travel;
  const triggers = useTable('triggers');
  const all = triggers.data;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [live, setLive] = useState(false);
  const depths = useLiveTravel(s, profile, live && model.features.liveTravel);
  /** Values before the current burst of slider changes, for undo. */
  const before = useRef<Changes>(new Map());

  const flush = useDebouncedWriter<Changes>(
    (changes) => {
      const list = [...changes].map(([index, trigger]) => ({ index, trigger }));
      const undo = [...changes.keys()].flatMap((index) => {
        const t = before.current.get(index);
        return t ? [{ index, trigger: t }] : [];
      });
      before.current = new Map();
      void save('key travel', () => s.writeTriggers(profile, list), { undo: () => applyTriggers(s, profile, undo) }).then(
        (ok) => ok || triggers.reload(),
      );
    },
    (a, b) => new Map([...a, ...b]),
    250,
  );

  const update = (fn: (t: KeyTrigger) => KeyTrigger, indices: Iterable<number> = selected) => {
    if (!all) return;
    const next = all.slice();
    const changes: Changes = new Map();
    for (const i of indices) {
      const t = clampTrigger(model, fn(all[i]));
      if (sameTrigger(t, all[i])) continue;
      if (!before.current.has(i)) before.current.set(i, all[i]);
      next[i] = t;
      changes.set(i, t);
    }
    if (!changes.size) return;
    setCached(profile, 'triggers', next); // optimistic; the debounced write follows
    flush(changes);
  };

  const applyPresetToSelection = (p: Preset) => update((t) => applyPreset(model, t, p));

  const visual = (k: LayoutKey): KeyVisual => {
    if (!all || k.index < 0) return {};
    const t = all[k.index];
    const sample = depths.get(k.index);
    return {
      sub: `${rawToMm(t.actuation, lim.rawPerMm).toFixed(2)}${t.mode ? ' RT' : ''}`,
      color: actuationColor(model, t.actuation),
      depth: live && sample ? Math.min(1, sample.raw / fullTravel(model, t.switchType)) : undefined,
      title: `actuation ${rawToMm(t.actuation, lim.rawPerMm).toFixed(2)} mm${t.mode === 1 ? ', Rapid Trigger' : t.mode === 2 ? ', continuous Rapid Trigger' : ''}`,
    };
  };

  const sel = [...selected];
  const first = all && sel.length ? all[sel[0]] : null;
  const mixed = !!all && !!first && sel.some((i) => !sameTrigger(all[i], first));

  return (
    <div class="page-performance">
      <header class="page__header">
        <div>
          <h2>Performance</h2>
          <p class="help">Select keys, then set how deep they actuate and whether Rapid Trigger is on. Numbers on keys are actuation points in mm.</p>
        </div>
        {model.features.liveTravel && (
          <Toggle checked={live} onChange={setLive} label="Live key view" help="Shows how far each key is pressed right now" />
        )}
      </header>
      {triggers.error ? (
        <LoadError message={triggers.error} onRetry={triggers.reload} />
      ) : !all ? (
        <Skeleton keyboard lines={3} />
      ) : (
        <>
          <section class="card card--flush">
            <KeyboardView layout={s.layout} selected={selected} onSelect={setSelected} multi visual={visual} ariaLabel="Keys (actuation in millimetres)" />
            <SelectionToolbar layout={s.layout} selected={selected} onSelect={setSelected} />
            <p class="legend">
              <span class="legend__gradient" aria-hidden="true" /> shallow → deep actuation
            </p>
          </section>
          <section class="card">
            <h3>Presets</h3>
            <PresetBar disabled={!sel.length} onApply={applyPresetToSelection} />
            {!sel.length && <p class="help">Select keys first (or press “All” above).</p>}
          </section>
          {first ? (
            <section class="card">
              <TriggerEditor model={model} trigger={first} count={sel.length} mixed={mixed} onChange={(fn) => update(fn)} />
            </section>
          ) : (
            <p class="empty-hint">Select one or more keys to adjust them.</p>
          )}
        </>
      )}
    </div>
  );
}
