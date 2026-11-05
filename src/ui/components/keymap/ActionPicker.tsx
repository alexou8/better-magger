import { useMemo, useState } from 'preact/hooks';
import type { DeviceModel, KeyAction } from '../../../core/types';
import { actionsEqual, pickerCategories, type PickerCategory } from '../../../data/keycodes';
import { activeProfile } from '../../state/session';
import { ComboBuilder } from './ComboBuilder';
import { KeyCapture } from './KeyCapture';

interface Props {
  model: DeviceModel;
  onPick: (a: KeyAction) => void;
  current?: KeyAction;
}

const COMBO_TAB = '__combo';

/** Category tabs + search + "press a key" capture + shortcut builder. */
export function ActionPicker({ model, onPick, current }: Props) {
  const profile = activeProfile.value; // FN layer keys are numbered per profile
  const categories = useMemo(() => pickerCategories(model, profile), [model, profile]);
  const [tab, setTab] = useState(categories[0]?.id ?? COMBO_TAB);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    const seen = new Set<string>();
    const out: PickerCategory['keys'] = [];
    for (const c of categories) {
      for (const k of c.keys) {
        const id = `${k.action.type}/${k.action.code1}/${k.action.code2}`;
        if (!seen.has(id) && (k.label.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))) {
          seen.add(id);
          out.push(k);
        }
      }
    }
    return out;
  }, [q, categories]);

  const grid = (keys: PickerCategory['keys']) =>
    keys.length ? (
      <div class="picker__grid">
        {keys.map((k) => {
          const active = current ? actionsEqual(current, k.action) : false;
          return (
            <button
              type="button"
              key={`${k.action.type}/${k.action.code1}/${k.action.code2}`}
              class={`picker__key${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onPick(k.action)}
            >
              {k.label}
            </button>
          );
        })}
      </div>
    ) : (
      <p class="help">Nothing matches "{query}".</p>
    );

  const activeCat = categories.find((c) => c.id === tab);

  return (
    <div class="picker">
      <div class="picker__top">
        <input
          type="search"
          class="picker__search"
          placeholder="Search keys, e.g. volume, F5, mouse…"
          aria-label="Search keys"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <KeyCapture onCapture={onPick} />
      </div>
      {results ? (
        grid(results)
      ) : (
        <>
          <div class="tabs" role="tablist" aria-label="Key categories">
            {categories.map((c) => (
              <button
                type="button"
                role="tab"
                key={c.id}
                aria-selected={tab === c.id}
                class={tab === c.id ? 'is-active' : ''}
                onClick={() => setTab(c.id)}
              >
                {c.name}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={tab === COMBO_TAB}
              class={tab === COMBO_TAB ? 'is-active' : ''}
              onClick={() => setTab(COMBO_TAB)}
            >
              Shortcut
            </button>
          </div>
          <div role="tabpanel">{activeCat ? grid(activeCat.keys) : <ComboBuilder model={model} onPick={onPick} />}</div>
        </>
      )}
    </div>
  );
}
