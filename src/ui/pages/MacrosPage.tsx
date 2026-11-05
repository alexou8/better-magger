import { useMemo, useState } from 'preact/hooks';
import type { Macro, MacroStep } from '../../core/types';
import type { PageProps } from '../App';
import { LoadError } from '../components/LoadError';
import { MacroEditor } from '../components/macros/MacroEditor';
import { Skeleton } from '../components/Skeleton';
import { basicKeys, MACRO_COUNT } from '../lib/keys';
import { MACRO_STEP_CAPACITY, summarizeMacro, totalSteps } from '../lib/macro';
import { setCached, useTable } from '../state/cache';
import { save } from '../state/toast';

export function MacrosPage({ session: s, profile }: PageProps) {
  const macros = useTable('macros');
  const keys = useMemo(() => basicKeys(s.model), [s.model]);
  const [current, setCurrent] = useState(0);
  const [draft, setDraft] = useState<MacroStep[] | null>(null);
  const [saving, setSaving] = useState(false);

  if (macros.error) return <LoadError message={macros.error} onRetry={macros.reload} />;
  const all = macros.data;
  if (!all) return <Skeleton lines={6} />;

  const keyLabel = (usage: number) => keys.find((k) => k.usage === usage)?.label ?? `Key ${usage}`;
  const steps = draft ?? all[current]?.steps ?? [];
  const dirty = draft !== null;

  const choose = (i: number) => {
    if (dirty && !confirm('Discard unsaved changes to this macro?')) return;
    setDraft(null);
    setCurrent(i);
  };

  const onSave = async () => {
    const next: Macro[] = Array.from({ length: MACRO_COUNT }, (_, i) => (i === current ? { steps } : all[i] ?? { steps: [] }));
    setSaving(true);
    const ok = await save('macro', async () => {
      await s.writeMacros(profile, next);
      setCached(profile, 'macros', next);
    });
    setSaving(false);
    if (ok) setDraft(null);
  };

  const capacity = MACRO_STEP_CAPACITY - (totalSteps(all) - (all[current]?.steps.length ?? 0));

  return (
    <div class="page-macros">
      <header class="page__header">
        <div>
          <h2>Macros</h2>
          <p class="help">A macro plays a sequence of key presses with one key. Record one, tidy it up, save, then assign it on the Keymap page.</p>
        </div>
      </header>
      <div class="macros-layout">
        <ul class="macro-list" aria-label="Macros">
          {Array.from({ length: MACRO_COUNT }, (_, i) => (
            <li key={i}>
              <button type="button" class={`macro-list__item${i === current ? ' is-active' : ''}`} aria-current={i === current} onClick={() => choose(i)}>
                <b>M{i + 1}</b>
                <span class="muted">{all[i] ? summarizeMacro(all[i], keyLabel) : 'Empty'}</span>
              </button>
            </li>
          ))}
        </ul>
        <section class="card">
          <MacroEditor
            name={`M${current + 1}`}
            steps={steps}
            keys={keys}
            capacity={capacity}
            dirty={dirty}
            saving={saving}
            onChange={setDraft}
            onSave={onSave}
            onRevert={() => setDraft(null)}
          />
        </section>
      </div>
    </div>
  );
}
