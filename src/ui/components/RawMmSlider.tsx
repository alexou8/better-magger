import { useEffect, useState } from 'preact/hooks';
import { mmToRaw, rawToMm } from '../../core/units';

interface Props {
  id: string;
  label: string;
  /** Value in raw device units. */
  raw: number;
  min: number;
  max: number;
  rawPerMm: number;
  onChange: (raw: number) => void;
  help?: string;
  disabled?: boolean;
}

function decimals(rawPerMm: number): number {
  return Math.max(1, Math.ceil(Math.log10(rawPerMm)));
}

/** Slider + number input showing millimetres while editing raw device units. */
export function RawMmSlider({
  id,
  label,
  raw,
  min,
  max,
  rawPerMm,
  onChange,
  help,
  disabled,
}: Props) {
  const digits = decimals(rawPerMm);
  const fmt = (r: number) => rawToMm(r, rawPerMm).toFixed(digits);
  const [text, setText] = useState(fmt(raw));
  useEffect(() => setText(fmt(raw)), [raw, rawPerMm]);

  const commit = (value: string) => {
    const mm = Number.parseFloat(value.replace(',', '.'));
    if (Number.isNaN(mm)) return setText(fmt(raw));
    const next = Math.min(max, Math.max(min, mmToRaw(mm, rawPerMm)));
    setText(fmt(next));
    if (next !== raw) onChange(next);
  };

  return (
    <div class="field">
      <label id={`${id}-label`} class="field__label" for={id}>
        {label}
      </label>
      <div class="slider">
        <input
          type="range"
          id={id}
          min={min}
          max={max}
          step={1}
          value={raw}
          disabled={disabled}
          aria-describedby={help ? `${id}-help` : undefined}
          aria-valuetext={`${fmt(raw)} millimetres`}
          onInput={(e) => onChange(Number(e.currentTarget.value))}
        />
        <span class="slider__num">
          <input
            type="number"
            inputMode="decimal"
            id={`${id}-number`}
            aria-labelledby={`${id}-label ${id}-unit`}
            aria-describedby={help ? `${id}-help` : undefined}
            min={fmt(min)}
            max={fmt(max)}
            step={(1 / rawPerMm).toFixed(digits)}
            value={text}
            disabled={disabled}
            onInput={(e) => setText(e.currentTarget.value)}
            onChange={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && commit(e.currentTarget.value)
            }
          />
          <span id={`${id}-unit`} class="slider__unit">
            mm
          </span>
        </span>
      </div>
      {help && (
        <p id={`${id}-help`} class="help">
          {help}
        </p>
      )}
    </div>
  );
}
