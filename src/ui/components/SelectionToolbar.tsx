import type { Layout } from '../../core/types';

interface Props {
  layout: Layout;
  selected: ReadonlySet<number>;
  onSelect: (next: Set<number>) => void;
}

/** "All / None / Row / Invert" helpers for multi-select keyboard views. */
export function SelectionToolbar({ layout, selected, onSelect }: Props) {
  const usable = layout.keys.filter((k) => k.index >= 0);
  const rowOf = (y: number) => Math.round(y * 2) / 2;

  const selectRows = () => {
    const rows = new Set(usable.filter((k) => selected.has(k.index)).map((k) => rowOf(k.y)));
    onSelect(new Set([...selected, ...usable.filter((k) => rows.has(rowOf(k.y))).map((k) => k.index)]));
  };

  return (
    <div class="sel-toolbar" role="toolbar" aria-label="Selection">
      <span class="sel-toolbar__count" aria-live="polite">
        {selected.size ? `${selected.size} key${selected.size === 1 ? '' : 's'} selected` : 'Click keys to select · Shift/Ctrl-click or drag to select several'}
      </span>
      <div class="btn-row">
        <button type="button" class="btn btn--small" onClick={() => onSelect(new Set(usable.map((k) => k.index)))}>
          All
        </button>
        {[
          { name: 'WASD', codes: [26, 4, 22, 7] },
          { name: 'Arrows', codes: [79, 80, 81, 82] },
        ].map(group => {
          const keys = usable.filter(k => group.codes.includes(k.code));
          return keys.length > 0 && <button type="button" key={group.name} class="btn btn--small"
            title={`Select ${group.name} keys without changing their settings`}
            onClick={() => onSelect(new Set(keys.map(k => k.index)))}>{group.name}</button>;
        })}
        <button type="button" class="btn btn--small" disabled={!selected.size} onClick={() => onSelect(new Set())}>
          None
        </button>
        <button type="button" class="btn btn--small" disabled={!selected.size} onClick={selectRows} title="Extend selection to whole rows">
          Row
        </button>
        <button
          type="button"
          class="btn btn--small"
          onClick={() => onSelect(new Set(usable.filter((k) => !selected.has(k.index)).map((k) => k.index)))}
        >
          Invert
        </button>
      </div>
    </div>
  );
}
