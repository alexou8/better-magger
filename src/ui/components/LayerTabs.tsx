import { LAYERS } from '../lib/layers';

interface Props {
  layers: number;
  value: number;
  onChange: (layer: number) => void;
}

/** Layer switcher with a one-line explanation of the active layer. */
export function LayerTabs({ layers, value, onChange }: Props) {
  return (
    <div class="layer-tabs">
      <div class="segmented" role="tablist" aria-label="Layer">
        {LAYERS.slice(0, layers).map((l, i) => (
          <button
            type="button"
            role="tab"
            key={l.name}
            aria-selected={value === i}
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
