import { useState } from 'preact/hooks';
import type { KeyboardSession } from '../../../core/types';
import { invalidate } from '../../state/cache';
import { save } from '../../state/toast';

const WORD = 'RESET';

export function FactoryReset({ session: s }: { session: KeyboardSession }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    const ok = await save(
      'factory reset',
      async () => {
        await s.factoryReset();
        await new Promise((r) => setTimeout(r, 5000)); // the keyboard needs a moment to rebuild its tables
        invalidate();
      },
      { success: 'Keyboard reset to factory settings' },
    );
    setBusy(false);
    if (ok) setText('');
  };

  return (
    <div class="danger-zone">
      <p class="help">
        Erases <b>all profiles</b>: keymaps, actuation, lighting, macros and advanced keys go back to factory defaults.
        Export a backup first if you might want them back.
      </p>
      <label class="field">
        <span class="field__label">
          Type <code>{WORD}</code> to confirm
        </span>
        <input type="text" value={text} autoComplete="off" spellcheck={false} onInput={(e) => setText(e.currentTarget.value)} />
      </label>
      <button type="button" class="btn btn--danger" disabled={text.trim().toUpperCase() !== WORD || busy} onClick={() => void reset()}>
        {busy ? 'Resetting… (a few seconds)' : 'Factory reset'}
      </button>
    </div>
  );
}
