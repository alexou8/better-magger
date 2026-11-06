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
import { Icon } from '../components/Icon';

export function KeymapPage({ session: s, profile }: PageProps) {
  const model = s.model;
  const [layer, setLayer] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const keymap = useTable('keymap', layer);
  const defaults = useTable('defaults', layer);
  const map = keymap.data;
  const defs = defaults.data;

  const write = (
    changes: { index: number; action: KeyAction }[],
    what = 'key',
  ) => {
    if (!map || !changes.length) return;
    const before = changes.map((c) => ({
      index: c.index,
      action: map[c.index],
    }));
    void save(what, () => applyKeys(s, profile, layer, changes), {
      undo: () => applyKeys(s, profile, layer, before),
    });
  };

  const assign = (action: KeyAction) =>
    write([...selected].map((index) => ({ index, action })));

  const resetKeys = () =>
    defs &&
    write(
      [...selected].map((index) => ({ index, action: defs[index] })),
      'reset',
    );

  const resetLayer = () => {
    if (!map || !defs) return;
    const changes = map.flatMap((a, index) =>
      actionsEqual(a, defs[index]) ? [] : [{ index, action: defs[index] }],
    );
    if (!changes.length) return;
    if (
      confirm(
        `Reset all ${changes.length} changed keys on the ${LAYERS[layer].name} layer to their defaults?`,
      )
    ) {
      write(changes, 'layer reset');
    }
  };

  const visual = (k: LayoutKey) => {
    if (!map || k.index < 0) return {};
    const a = map[k.index];
    const d = describeAction(a, model);
    const remapped = defs ? !actionsEqual(a, defs[k.index]) : false;
    return {
      label: d.short,
      className: remapped ? 'is-remapped' : undefined,
      title: remapped ? `remapped to ${d.label}` : d.label,
    };
  };

  const remappedCount =
    map && defs ? map.filter((a, i) => !actionsEqual(a, defs[i])).length : 0;
  const sel = [...selected];

  return (
    <div class="page-keymap">
      <header class="page__header">
        <div>
          <span class="page__eyebrow index-label">01 / Make it yours</span>
          <h2>Keymap</h2>
          <p class="help">
            Choose a key. Give it a new job. Your changes apply immediately.
          </p>
        </div>
        <button
          type="button"
          class="btn"
          disabled={!remappedCount}
          onClick={resetLayer}
        >
          Reset layer
        </button>
      </header>
      <LayerTabs
        layers={model.features.layers}
        value={layer}
        onChange={setLayer}
      />
      {keymap.error ? (
        <LoadError message={keymap.error} onRetry={keymap.reload} />
      ) : !map ? (
        <Skeleton keyboard lines={2} />
      ) : (
        <div class="editor-workspace">
          <section class="keyboard-station">
            <div class="station-heading">
              <span class="index-label">Your keyboard</span>
              <span class="station-heading__detail">
                {LAYERS[layer].name} layer <span aria-hidden="true">/</span>{' '}
                Profile {profile + 1}
              </span>
            </div>
            <div class="keyboard-deck">
              <KeyboardView
                layout={s.layout}
                selected={selected}
                onSelect={setSelected}
                multi
                visual={visual}
                ariaLabel={`${LAYERS[layer].name} layer keys`}
              />
              <div class="keyboard-deck__edge" aria-hidden="true">
                <span>{model.name}</span>
                <span>KEYMAP</span>
                <span class="deck-indicator" />
              </div>
            </div>
            <SelectionToolbar
              layout={s.layout}
              selected={selected}
              onSelect={setSelected}
            />
            {remappedCount > 0 && (
              <p class="legend">
                <span class="legend__swatch legend__swatch--remapped" />{' '}
                {remappedCount} key{remappedCount === 1 ? '' : 's'} changed from
                default
              </p>
            )}
          </section>
          {sel.length ? (
            <section
              class="inspector keymap-editor"
              aria-label="Assign an action"
            >
              <span class="index-label">
                Selected key{sel.length > 1 ? 's' : ''}
              </span>
              <KeyDetails
                model={model}
                layout={s.layout}
                selected={sel}
                map={map}
                defaults={defs}
                onResetKeys={resetKeys}
              />
              <div class="inspector__divider" />
              <ActionPicker
                model={model}
                onPick={assign}
                current={sel.length === 1 ? map[sel[0]] : undefined}
              />
            </section>
          ) : (
            <section
              class="inspector inspector--empty"
              aria-label="Start remapping"
            >
              <span class="index-label">The next move</span>
              <div class="empty-selection">
                <span class="empty-selection__icon">
                  <Icon name="pointer" size={28} />
                </span>
                <h3>Start with a key.</h3>
                <p>Select one on your keyboard to change its action.</p>
              </div>
              <div class="inspector__guide">
                <span class="index-label">A few things you can do</span>
                <ul>
                  <li>Move a shortcut closer.</li>
                  <li>Put volume on a spare key.</li>
                  <li>Make Caps Lock something useful.</li>
                </ul>
              </div>
              <p class="help">
                Use arrow keys to explore. Enter selects. Shift + arrows selects
                more.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
