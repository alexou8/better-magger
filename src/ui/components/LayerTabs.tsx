import { useId } from 'preact/hooks';
import { LAYERS } from '../lib/layers';

interface Props {
  layers: number;
  value: number;
  onChange: (layer: number) => void;
}

/** Layer switcher with a one-line explanation of the active layer. */
export function LayerTabs({ layers, value, onChange }: Props) {
  const id = useId();
  return (
    <div class="layer-tabs">
      <div class="segmented" role="radiogroup" aria-label="Layer">
        {LAYERS.slice(0, layers).map((l, i) => (
          <button
            type="button"
            role="radio"
            key={l.name}
            id={`${id}-layer-${i}`}
            aria-checked={value === i}
            tabIndex={value === i ? 0 : -1}
            onKeyDown={(e) => {
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? layers - 1
                    : e.key === 'ArrowRight' || e.key === 'ArrowDown'
                      ? (i + 1) % layers
                      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                        ? (i - 1 + layers) % layers
                        : null;
              if (next === null || e.altKey || e.ctrlKey || e.metaKey) return;
              e.preventDefault();
              onChange(next);
              document.getElementById(`${id}-layer-${next}`)?.focus();
            }}
            class={value === i ? 'is-active' : ''}
            onClick={() => onChange(i)}
          >
            {l.name}
          </button>
        ))}
      </div>
      <p class="help">{LAYERS[value]?.help}</p>
    </div>
  );
}
