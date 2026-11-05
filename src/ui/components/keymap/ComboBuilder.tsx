import { useMemo, useState } from 'preact/hooks';
import type { DeviceModel, KeyAction } from '../../../core/types';
import { MOD_BITS } from '../../../data/keycodes';
import { basicKeys } from '../../lib/keys';

interface Props {
  model: DeviceModel;
  onPick: (a: KeyAction) => void;
}

const MODS: { name: string; left: number; right: number }[] = [
  { name: 'Ctrl', left: MOD_BITS.LCtrl, right: MOD_BITS.RCtrl },
  { name: 'Shift', left: MOD_BITS.LShift, right: MOD_BITS.RShift },
  { name: 'Alt', left: MOD_BITS.LAlt, right: MOD_BITS.RAlt },
  { name: 'Win / Cmd', left: MOD_BITS.LGui, right: MOD_BITS.RGui },
];

/** Builds a modifier + key shortcut such as Ctrl+Shift+Esc. */
export function ComboBuilder({ model, onPick }: Props) {
  const keys = useMemo(() => basicKeys(model), [model]);
  const [mods, setMods] = useState(0);
  const [right, setRight] = useState(false);
  const [usage, setUsage] = useState(keys[0]?.usage ?? 4);

  const mask = MODS.reduce((m, mod, i) => (mods & (1 << i) ? m | (right ? mod.right : mod.left) : m), 0);

  return (
    <div class="combo">
      <fieldset class="combo__mods">
        <legend>Hold</legend>
        {MODS.map((m, i) => (
          <label key={m.name} class="check">
            <input
              type="checkbox"
              checked={(mods & (1 << i)) !== 0}
              onChange={(e) => setMods(e.currentTarget.checked ? mods | (1 << i) : mods & ~(1 << i))}
            />
            {m.name}
          </label>
        ))}
        <label class="check check--muted">
          <input type="checkbox" checked={right} onChange={(e) => setRight(e.currentTarget.checked)} />
          Use right-hand modifiers
        </label>
      </fieldset>
      <label class="field">
        <span class="field__label">and press</span>
        <select value={usage} onChange={(e) => setUsage(Number(e.currentTarget.value))}>
          {keys.map((k) => (
            <option key={k.usage} value={k.usage}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" class="btn btn--primary" disabled={!mask} onClick={() => onPick({ type: 16, code1: mask, code2: usage })}>
        Assign shortcut
      </button>
    </div>
  );
}
