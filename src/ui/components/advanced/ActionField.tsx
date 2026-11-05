import { useState } from 'preact/hooks';
import type { DeviceModel, KeyAction } from '../../../core/types';
import { describeAction } from '../../../data/keycodes';
import { ActionPicker } from '../keymap/ActionPicker';
import { Modal } from '../Modal';

interface Props {
  model: DeviceModel;
  label: string;
  action: KeyAction;
  onChange: (a: KeyAction) => void;
  /** Allow clearing to "nothing". */
  clearable?: boolean;
}

const isEmpty = (a: KeyAction) => a.type === 0 && a.code1 === 0 && a.code2 === 0;

/** Shows an action and opens the key picker in a dialog to change it. */
export function ActionField({ model, label, action, onChange, clearable }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div class="action-field">
      <span class="action-field__label">{label}</span>
      <button type="button" class="btn action-field__value" onClick={() => setOpen(true)} aria-label={`${label}: ${isEmpty(action) ? 'nothing' : describeAction(action, model).label}. Change`}>
        {isEmpty(action) ? <span class="muted">Choose…</span> : describeAction(action, model).label}
      </button>
      {clearable && !isEmpty(action) && (
        <button type="button" class="btn btn--ghost btn--small" onClick={() => onChange({ type: 0, code1: 0, code2: 0 })}>
          Clear
        </button>
      )}
      {open && (
        <Modal title={label} wide onClose={() => setOpen(false)}>
          <ActionPicker
            model={model}
            current={action}
            onPick={(a) => {
              onChange(a);
              setOpen(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
