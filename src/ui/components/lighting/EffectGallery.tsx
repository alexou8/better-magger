import { LIGHT_EFFECTS } from '../../../data/lighting';

interface Props {
  value: number;
  disabled: boolean;
  onChange: (id: number) => void;
}

export function EffectGallery({ value, disabled, onChange }: Props) {
  return (
    <div class="effects" role="radiogroup" aria-label="Lighting effect">
      {LIGHT_EFFECTS.map((e) => (
        <button
          type="button"
          role="radio"
          key={e.id}
          aria-checked={value === e.id}
          class={`effect effect--${e.id}${value === e.id ? ' is-active' : ''}`}
          disabled={disabled}
          onClick={() => onChange(e.id)}
        >
          <span class="effect__preview" aria-hidden="true" />
          <span class="effect__name">{e.name}</span>
        </button>
      ))}
    </div>
  );
}
