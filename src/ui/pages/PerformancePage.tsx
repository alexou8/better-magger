import { useRef, useState } from 'preact/hooks';
import type { KeyTrigger, LayoutKey } from '../../core/types';
import { rawToMm, formatMm } from '../../core/units';
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
import {
  actuationColor,
  applyPreset,
  clampTrigger,
  fullTravel,
  type Preset,
} from '../lib/trigger';
import { setCached, useTable } from '../state/cache';
import { save } from '../state/toast';
import { applyTriggers } from '../state/writes';
import { Icon } from '../components/Icon';

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
      void save('key travel', () => s.writeTriggers(profile, list), {
        undo: () => applyTriggers(s, profile, undo),
      }).then((ok) => ok || triggers.reload());
    },
    (a, b) => new Map([...a, ...b]),
    250,
  );

  const update = (
    fn: (t: KeyTrigger) => KeyTrigger,
    indices: Iterable<number> = selected,
  ) => {
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

  const applyPresetToSelection = (p: Preset) =>
    update((t) => applyPreset(model, t, p));

  const visual = (k: LayoutKey): KeyVisual => {
    if (!all || k.index < 0) return {};
    const t = all[k.index];
    const sample = depths.get(k.index);
    return {
      sub: `${rawToMm(t.actuation, lim.rawPerMm).toFixed(2)}${t.mode ? ' RT' : ''}`,
      color: actuationColor(model, t.actuation),
      depth:
        live && sample
          ? Math.min(1, sample.raw / fullTravel(model, t.switchType))
          : undefined,
      title: `actuation ${rawToMm(t.actuation, lim.rawPerMm).toFixed(2)} mm${t.mode === 1 ? ', Rapid Trigger' : t.mode === 2 ? ', continuous Rapid Trigger' : ''}`,
    };
  };

  const sel = [...selected];
  const first = all && sel.length ? all[sel[0]] : null;
  const mixed =
    !!all && !!first && sel.some((i) => !sameTrigger(all[i], first));

  return (
    <div class="page-performance">
      <header class="page__header">
        <div>
          <span class="page__eyebrow index-label">02 / Find your feel</span>
          <h2>Performance</h2>
          <p class="help">
            Tune how far each key travels before it responds. Start with one
            key, then find your feel.
          </p>
        </div>
        {model.features.liveTravel && (
          <Toggle
            checked={live}
            onChange={setLive}
            label="Live key view"
            help="Shows how far each key is pressed right now"
          />
        )}
      </header>
      {triggers.error ? (
        <LoadError message={triggers.error} onRetry={triggers.reload} />
      ) : !all ? (
        <Skeleton keyboard lines={3} />
      ) : (
        <div class="editor-workspace editor-workspace--performance">
          <div class="keyboard-station">
            <div class="station-heading">
              <span class="index-label">Actuation map</span>
              <span class="station-heading__detail">
                Depth in mm <span aria-hidden="true">/</span> Profile{' '}
                {profile + 1}
              </span>
            </div>
            <div class="keyboard-deck">
              <KeyboardView
                layout={s.layout}
                selected={selected}
                onSelect={setSelected}
                multi
                visual={visual}
                ariaLabel="Keys (actuation in millimetres)"
              />
              <div class="keyboard-deck__edge" aria-hidden="true">
                <span>{model.name}</span>
                <span>{live ? 'LIVE TRAVEL' : 'PERFORMANCE'}</span>
                <span class="deck-indicator" />
              </div>
            </div>
            <SelectionToolbar
              layout={s.layout}
              selected={selected}
              onSelect={setSelected}
            />
            <p class="legend">
              <span class="legend__gradient" aria-hidden="true" /> shallow →
              deep actuation
            </p>
            <section class="preset-station">
              <div class="station-heading">
                <h3>A starting point</h3>
                <span class="index-label">Then make it your own</span>
              </div>
              <PresetBar
                disabled={!sel.length}
                onApply={applyPresetToSelection}
              />
              {!sel.length && (
                <p class="help">
                  Select keys first, or choose All above. Presets change only
                  the selected keys.
                </p>
              )}
            </section>
          </div>
          {first ? (
            <section
              class="inspector performance-inspector"
              aria-label="Tune selected keys"
            >
              <div class="actuation-readout">
                <span class="index-label">Actuation point</span>
                <div>
                  <strong>
                    {rawToMm(first.actuation, lim.rawPerMm).toFixed(2)}
                  </strong>
                  <span>mm</span>
                </div>
                <p>
                  {sel.length === 1
                    ? s.layout.keys.find((k) => k.index === sel[0])?.label
                    : `${sel.length} keys selected`}
                  {mixed ? ' · mixed values' : ''}
                </p>
                <div class="travel-ruler" aria-hidden="true">
                  <span
                    style={{
                      left: `${Math.min(100, (first.actuation / fullTravel(model, first.switchType)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div class="travel-scale" aria-label="Actuation measurements">
                <span>0 mm · Released</span>
                <strong>{formatMm(first.actuation / lim.rawPerMm)} · Registers</strong>
                <span>{formatMm(fullTravel(model, first.switchType) / lim.rawPerMm)} · Fully pressed</span>
              </div>
              {live && <p class="help live-depth">
                {depths.get(sel[0])
                  ? `${s.isDemo ? 'Demo depth' : 'Measured now'}: ${formatMm(depths.get(sel[0])!.raw / lim.rawPerMm)} · ${s.layout.keys.find(k => k.index === sel[0])?.label ?? 'First selected key'}`
                  : s.isDemo ? 'Demo generates sample presses automatically. Waiting for this key…' : 'Waiting for a travel sample. Press the selected key on your keyboard.'}
              </p>}
              <TriggerEditor
                model={model}
                trigger={first}
                count={sel.length}
                mixed={mixed}
                onChange={(fn) => update(fn)}
              />
            </section>
          ) : (
            <section
              class="inspector inspector--empty"
              aria-label="Start tuning"
            >
              <span class="index-label">Fine-tune your feel</span>
              <div class="empty-selection">
                <span class="empty-selection__icon">
                  <Icon name="performance" size={32} />
                </span>
                <h3>
                  A little deeper.
                  <br />
                  Or a little faster.
                </h3>
                <p>
                  Select a key to adjust actuation, Rapid Trigger and dead
                  zones.
                </p>
              </div>
              <div class="inspector__guide">
                <span class="index-label">What the numbers mean</span>
                <p>
                  Lower actuation needs a lighter touch. Higher actuation gives
                  your fingers more room.
                </p>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
