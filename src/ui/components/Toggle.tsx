import type { ComponentChildren } from 'preact';

interface Props {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: ComponentChildren;
  help?: ComponentChildren;
  disabled?: boolean;
}

/** Switch-style checkbox with label and optional explanation. */
export function Toggle({ checked, onChange, label, help, disabled }: Props) {
  return (
    <label class={`toggle${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span class="toggle__track" aria-hidden="true" />
      <span class="toggle__text">
        <span class="toggle__label">{label}</span>
        {help && <span class="help">{help}</span>}
      </span>
    </label>
  );
}
