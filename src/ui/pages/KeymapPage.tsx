import { useState } from 'preact/hooks';
import type { KeyAction, LayoutKey } from '../../core/types';
import { actionsEqual, describeAction } from '../../data/keycodes';
import type { PageProps } from '../App';
import { KeyboardView } from '../components/KeyboardView';
import { ActionPicker } from '../components/keymap/ActionPicker';
import { KeyDetails } from '../components/keymap/KeyDetails';
import { LayerTabs } from '../components/LayerTabs';
import { LoadError } from '../components/LoadError';
import { SelectionToolbar } from '../components/SelectionToolbar';
import { Skeleton } from '../components/Skeleton';
import { useTable } from '../state/cache';
import { save } from '../state/toast';
import { applyKeys } from '../state/writes';
import { LAYERS } from '../lib/layers';

export function KeymapPage({ session: s, profile }: PageProps) {
  const model = s.model;
  const [layer, setLayer] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const keymap = useTable('keymap', layer);
  const defaults = useTable('defaults', layer);
  const map = keymap.data;
  const defs = defaults.data;

  const write = (changes: { index: number; action: KeyAction }[], what = 'key') => {
    if (!map || !changes.length) return;
    const before = changes.map((c) => ({ index: c.index, action: map[c.index] }));
    void save(what, () => applyKeys(s, profile, layer, changes), { undo: () => applyKeys(s, profile, layer, before) });
  };

  const assign = (action: KeyAction) => write([...selected].map((index) => ({ index, action })));

  const resetKeys = () => defs && write([...selected].map((index) => ({ index, action: defs[index] })), 'reset');

  const resetLayer = () => {
    if (!map || !defs) return;
    const changes = map.flatMap((a, index) => (actionsEqual(a, defs[index]) ? [] : [{ index, action: defs[index] }]));
    if (!changes.length) return;
    if (confirm(`Reset all ${changes.length} changed keys on the ${LAYERS[layer].name} layer to their defaults?`)) {
      write(changes, 'layer reset');
    }
  };

  const visual = (k: LayoutKey) => {
    if (!map || k.index < 0) return {};
    const a = map[k.index];
    const d = describeAction(a, model);
    const remapped = defs ? !actionsEqual(a, defs[k.index]) : false;
    return { label: d.short, className: remapped ? 'is-remapped' : undefined, title: remapped ? `remapped to ${d.label}` : d.label };
  };

  const remappedCount = map && defs ? map.filter((a, i) => !actionsEqual(a, defs[i])).length : 0;
  const sel = [...selected];

  return (
    <div class="page-keymap">
      <header class="page__header">
        <div>
          <h2>Keymap</h2>
          <p class="help">Pick a key on the picture, then choose what it should do. Changes are saved to the keyboard right away.</p>
        </div>
        <button type="button" class="btn" disabled={!remappedCount} onClick={resetLayer}>
          Reset layer
        </button>
      </header>
      <LayerTabs layers={model.features.layers} value={layer} onChange={setLayer} />
      {keymap.error ? (
        <LoadError message={keymap.error} onRetry={keymap.reload} />
      ) : !map ? (
        <Skeleton keyboard lines={2} />
      ) : (
        <>
          <section class="card card--flush">
            <KeyboardView layout={s.layout} selected={selected} onSelect={setSelected} multi visual={visual} ariaLabel={`${LAYERS[layer].name} layer keys`} />
            <SelectionToolbar layout={s.layout} selected={selected} onSelect={setSelected} />
            {remappedCount > 0 && (
              <p class="legend">
                <span class="legend__swatch legend__swatch--remapped" /> {remappedCount} key{remappedCount === 1 ? '' : 's'} changed from default
              </p>
            )}
          </section>
          {sel.length ? (
            <section class="card keymap-editor">
              <KeyDetails model={model} layout={s.layout} selected={sel} map={map} defaults={defs} onResetKeys={resetKeys} />
              <ActionPicker model={model} onPick={assign} current={sel.length === 1 ? map[sel[0]] : undefined} />
            </section>
          ) : (
            <p class="empty-hint">Select a key above to change it.</p>
          )}
        </>
      )}
    </div>
  );
}
