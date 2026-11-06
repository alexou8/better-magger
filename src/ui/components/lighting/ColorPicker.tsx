import { recentColors, rememberColor } from '../../state/recentColors';
import { rgbToHex, hexToRgb, SWATCHES, type Rgb } from '../../lib/color';

interface Props {
  id: string;
  label: string;
  value: Rgb;
  onChange: (rgb: Rgb) => void;
  disabled?: boolean;
}

/** Native colour input plus quick swatches. */
export function ColorPicker({ id, label, value, onChange, disabled }: Props) {
  const hex = rgbToHex(value);
  return (
    <div class="field">
      <label class="field__label" for={id}>
        {label}
      </label>
      <div class="color-picker">
        <input id={id} type="color" value={hex} disabled={disabled} onInput={(e) => onChange(hexToRgb(e.currentTarget.value))} onChange={(e) => rememberColor(hexToRgb(e.currentTarget.value))} />
        <code>{hex.toUpperCase()}</code>
        <div class="swatches">
          {SWATCHES.map((c) => (
            <button
              type="button"
              key={rgbToHex(c)}
              class={`swatch${rgbToHex(c) === hex ? ' is-active' : ''}`}
              style={{ background: rgbToHex(c) }}
              aria-label={`Colour ${rgbToHex(c)}`}
              disabled={disabled}
              onClick={() => { rememberColor(c); onChange(c); }}
            />
          ))}
        </div>
      </div>
      {recentColors.value.length > 0 && <div class="recent-colors">
        <span class="index-label">Recently used</span>
        <div class="swatches" role="group" aria-label="Recently used colours">
          {recentColors.value.map(hex => <button type="button" key={hex} class="swatch"
            style={{ background: hex }} aria-label={`Recent colour ${hex}`} disabled={disabled}
            onClick={() => { const rgb = hexToRgb(hex); rememberColor(rgb); onChange(rgb); }} />)}
        </div>
      </div>}
    </div>
  );
}
