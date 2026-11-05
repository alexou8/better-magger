import type { MacroStep } from '../../../core/types';
import { MODIFIER_USAGES } from '../../lib/keys';
import { MOUSE_BUTTONS } from '../../lib/macro';

interface Props {
  step: MacroStep;
  index: number;
  count: number;
  keys: { usage: number; label: string }[];
  onChange: (s: MacroStep) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

const DEFAULT_CODE: Record<MacroStep['kind'], number> = { key: 4, modifier: 224, mouse: 1 };

export function MacroStepRow({ step, index, count, keys, onChange, onMove, onRemove }: Props) {
  const options =
    step.kind === 'key'
      ? keys.map((k) => ({ code: k.usage, label: k.label }))
      : step.kind === 'modifier'
        ? MODIFIER_USAGES.map((m) => ({ code: m.usage, label: m.label }))
        : MOUSE_BUTTONS;
  const n = index + 1;
  return (
    <li class={`macro-step${step.pressed ? ' is-press' : ' is-release'}`}>
      <span class="macro-step__n">{n}</span>
      <select aria-label={`Step ${n} type`} value={step.kind} onChange={(e) => {
        const kind = e.currentTarget.value as MacroStep['kind'];
        onChange({ ...step, kind, code: DEFAULT_CODE[kind] });
      }}>
        <option value="key">Key</option>
        <option value="modifier">Modifier</option>
        <option value="mouse">Mouse</option>
      </select>
      <select aria-label={`Step ${n} key`} value={step.code} onChange={(e) => onChange({ ...step, code: Number(e.currentTarget.value) })}>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
      <select aria-label={`Step ${n} press or release`} value={step.pressed ? '1' : '0'} onChange={(e) => onChange({ ...step, pressed: e.currentTarget.value === '1' })}>
        <option value="1">↓ Press</option>
        <option value="0">↑ Release</option>
      </select>
      <label class="macro-step__delay">
        <span>then wait</span>
        <input
          type="number"
          min={0}
          max={65535}
          aria-label={`Delay after step ${n} in milliseconds`}
          value={step.delayMs}
          onChange={(e) => onChange({ ...step, delayMs: Math.max(0, Math.min(65535, Number(e.currentTarget.value) || 0)) })}
        />
        <span>ms</span>
      </label>
      <span class="btn-row">
        <button type="button" class="btn btn--ghost btn--icon btn--small" aria-label={`Move step ${n} up`} disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" class="btn btn--ghost btn--icon btn--small" aria-label={`Move step ${n} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓
        </button>
        <button type="button" class="btn btn--ghost btn--icon btn--small" aria-label={`Remove step ${n}`} onClick={onRemove}>
          ✕
        </button>
      </span>
    </li>
  );
}
