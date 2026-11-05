import { PRESETS, type Preset } from '../../lib/trigger';

interface Props {
  disabled: boolean;
  onApply: (p: Preset) => void;
}

export function PresetBar({ disabled, onApply }: Props) {
  return (
    <div class="presets">
      {PRESETS.map((p) => (
        <button type="button" key={p.id} class="preset" disabled={disabled} onClick={() => onApply(p)}>
          <span class="preset__name">{p.name}</span>
          <span class="preset__help">{p.help}</span>
        </button>
      ))}
    </div>
  );
}
