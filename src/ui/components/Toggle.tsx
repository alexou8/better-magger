import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

interface Props {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: ComponentChildren;
  help?: ComponentChildren;
  disabled?: boolean;
}

/** Switch-style checkbox with label and optional explanation. */
export function Toggle({ checked, onChange, label, help, disabled }: Props) {
  const id = useId();
  return (
    <label class={`toggle${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span class="toggle__track" aria-hidden="true" />
      <span class="toggle__text">
        <span class="toggle__label" id={`${id}-label`}>
          {label}
        </span>
        {help && (
          <span class="help" id={`${id}-help`}>
            {help}
          </span>
        )}
      </span>
    </label>
  );
}
