import { useId, useMemo, useState } from 'preact/hooks';
import type { DeviceModel, KeyAction } from '../../../core/types';
import {
  actionsEqual,
  pickerCategories,
  type PickerCategory,
} from '../../../data/keycodes';
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
  const categories = useMemo(
    () => pickerCategories(model, profile),
    [model, profile],
  );
  const [tab, setTab] = useState(categories[0]?.id ?? COMBO_TAB);
  const [query, setQuery] = useState('');
  const id = useId();
  const tabIds = [...categories.map((c) => c.id), COMBO_TAB];
  const onTabKeyDown = (e: KeyboardEvent, currentTab: string) => {
    const index = tabIds.indexOf(currentTab);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? tabIds.length - 1
          : e.key === 'ArrowRight'
            ? (index + 1) % tabIds.length
            : e.key === 'ArrowLeft'
              ? (index - 1 + tabIds.length) % tabIds.length
              : null;
    if (next === null || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    setTab(tabIds[next]);
    document.getElementById(`${id}-tab-${tabIds[next]}`)?.focus();
  };

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    const seen = new Set<string>();
    const out: PickerCategory['keys'] = [];
    for (const c of categories) {
      for (const k of c.keys) {
        const id = `${k.action.type}/${k.action.code1}/${k.action.code2}`;
        if (
          !seen.has(id) &&
          (k.label.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q))
        ) {
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
        <label class="picker__search-field">
          <span class="field__label">Search keys</span>
          <input
            type="search"
            class="picker__search"
            placeholder="Search keys, e.g. volume, F5, mouse…"
            aria-label="Search keys"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
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
                id={`${id}-tab-${c.id}`}
                aria-controls={`${id}-panel`}
                aria-selected={tab === c.id}
                tabIndex={tab === c.id ? 0 : -1}
                onKeyDown={(e) => onTabKeyDown(e, c.id)}
                class={tab === c.id ? 'is-active' : ''}
                onClick={() => setTab(c.id)}
              >
                {c.name}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              id={`${id}-tab-${COMBO_TAB}`}
              aria-controls={`${id}-panel`}
              aria-selected={tab === COMBO_TAB}
              tabIndex={tab === COMBO_TAB ? 0 : -1}
              onKeyDown={(e) => onTabKeyDown(e, COMBO_TAB)}
              class={tab === COMBO_TAB ? 'is-active' : ''}
              onClick={() => setTab(COMBO_TAB)}
            >
              Shortcut
            </button>
          </div>
          <div
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-tab-${tab}`}
            tabIndex={0}
          >
            {activeCat ? (
              grid(activeCat.keys)
            ) : (
              <ComboBuilder model={model} onPick={onPick} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
