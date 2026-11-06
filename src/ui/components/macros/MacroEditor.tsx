import { useState } from 'preact/hooks';
import type { MacroStep } from '../../../core/types';
import { useMacroRecorder } from '../../hooks/useMacroRecorder';
import { simplifyDelays } from '../../lib/macro';
import { MacroStepRow } from './MacroStepRow';

interface Props {
  name: string;
  steps: MacroStep[];
  keys: { usage: number; label: string }[];
  /** Steps still available in the shared 2 KB macro table (excluding this macro). */
  capacity: number;
  dirty: boolean;
  saving: boolean;
  onChange: (steps: MacroStep[]) => void;
  onSave: () => void;
  onRevert: () => void;
}

export function MacroEditor({ name, steps, keys, capacity, dirty, saving, onChange, onSave, onRevert }: Props) {
  const [recording, setRecording] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [fixedMs, setFixedMs] = useState(10);
  useMacroRecorder(recording, onChange, fixed ? fixedMs : null);

  const set = (i: number, s: MacroStep) => onChange(steps.map((x, j) => (j === i ? s : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = steps.slice();
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const addTap = () =>
    onChange([
      ...steps.map((s, i) => (i === steps.length - 1 && s.delayMs === 0 ? { ...s, delayMs: 10 } : s)),
      { kind: 'key', code: keys[0]?.usage ?? 4, pressed: true, delayMs: 10 },
      { kind: 'key', code: keys[0]?.usage ?? 4, pressed: false, delayMs: 0 },
    ]);
  const over = steps.length > capacity;

  return (
    <div class="macro-editor">
      <header class="macro-editor__head">
        <h3>{name}</h3>
        <div class="btn-row">
          <button type="button" class={`btn${recording ? ' btn--danger' : ' btn--primary'}`} onClick={() => setRecording(!recording)} aria-pressed={recording}>
            {recording ? '■ Stop recording' : '● Record'}
          </button>
          <button type="button" class="btn" disabled={recording || !steps.length} onClick={() => onChange(simplifyDelays(steps, fixedMs))}>
            Simplify delays
          </button>
          <button type="button" class="btn btn--ghost" disabled={recording || !steps.length} onClick={() => confirm('Remove all steps?') && onChange([])}>
            Clear
          </button>
        </div>
      </header>

      <div class="macro-editor__opts">
        <label class="check">
          <input type="checkbox" disabled={recording} checked={fixed} onChange={(e) => setFixed(e.currentTarget.checked)} />
          Record with a fixed delay
        </label>
        <label class="inline-field">
          <span>Delay</span>
          <input type="number" disabled={recording} min={0} max={65535} value={fixedMs} onChange={(e) => setFixedMs(Math.max(0, Math.min(65535, Math.round(Number(e.currentTarget.value) || 0))))} />
          <span>ms</span>
        </label>
      </div>

      {recording && (
        <p class="notice notice--info" role="status">
          Recording… type the keys for your macro. Click <b>Stop recording</b> when done. (Mouse clicks aren't recorded;
          add them as steps afterwards.)
        </p>
      )}

      {steps.length ? (
        <ol class="macro-steps">
          {steps.map((s, i) => (
            <MacroStepRow key={i} step={s} index={i} count={steps.length} keys={keys} onChange={(n) => set(i, n)} onMove={(d) => move(i, d)} onRemove={() => onChange(steps.filter((_, j) => j !== i))} />
          ))}
        </ol>
      ) : (
        <p class="empty-hint">No steps yet. Press Record and type, or add steps manually.</p>
      )}

      <div class="btn-row">
        <button type="button" class="btn" disabled={recording} onClick={addTap}>
          + Add key press & release
        </button>
        <button type="button" class="btn" disabled={recording} onClick={() => onChange([...steps, { kind: 'key', code: keys[0]?.usage ?? 4, pressed: true, delayMs: 0 }])}>
          + Add single step
        </button>
      </div>

      {over && <p class="notice notice--error">Too many steps: the keyboard has room for {capacity} more in total.</p>}

      <div class="btn-row macro-editor__save">
        <button type="button" class="btn btn--primary" disabled={!dirty || saving || recording || over} onClick={onSave}>
          {saving ? 'Saving…' : 'Save macro'}
        </button>
        <button type="button" class="btn" disabled={!dirty || saving} onClick={onRevert}>
          Discard changes
        </button>
        <span class="help">Assign it to a key on the Keymap page (category “Macros”).</span>
      </div>
    </div>
  );
}
