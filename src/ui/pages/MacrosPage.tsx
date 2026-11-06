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
import { macroDrafts } from '../state/macroDrafts';

export function MacrosPage({ session: s, profile }: PageProps) {
  const macros = useTable('macros');
  const keys = useMemo(() => basicKeys(s.model), [s.model]);
  const drafts = useMemo(() => macroDrafts(s, profile), [s, profile]);
  const current = drafts.current.value;
  const draft = drafts.steps.value.get(current) ?? null;
  const setDraft = (steps: MacroStep[] | null) => {
    const next = new Map(drafts.steps.peek());
    if (steps === null) next.delete(current);
    else next.set(current, steps);
    drafts.steps.value = next;
  };
  const [saving, setSaving] = useState(false);

  if (macros.error) return <LoadError message={macros.error} onRetry={macros.reload} />;
  const all = macros.data;
  if (!all) return <Skeleton lines={6} />;

  const keyLabel = (usage: number) => keys.find((k) => k.usage === usage)?.label ?? `Key ${usage}`;
  const steps = draft ?? all[current]?.steps ?? [];
  const dirty = draft !== null;

  const choose = (i: number) => {
    drafts.current.value = i;
  };

  const onSave = async () => {
    const next: Macro[] = Array.from({ length: MACRO_COUNT }, (_, i) => (i === current ? { steps } : all[i] ?? { steps: [] }));
    setSaving(true);
    const ok = await save('macro', async () => {
      await s.writeMacros(profile, next);
      setCached(profile, 'macros', next);
    });
    setSaving(false);
    if (ok && drafts.steps.peek().get(current) === draft) setDraft(null);
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
      <p class="help">Unsaved drafts stay here when you switch pages or profiles. Save each macro to apply it to the keyboard; * marks a draft.</p>
      <div class="macros-layout">
        <ul class="macro-list" aria-label="Macros">
          {Array.from({ length: MACRO_COUNT }, (_, i) => (
            <li key={i}>
              <button type="button" class={`macro-list__item${i === current ? ' is-active' : ''}`} aria-current={i === current} onClick={() => choose(i)}>
                <b>M{i + 1}{drafts.steps.value.has(i) ? ' *' : ''}</b>
                <span class="muted">{all[i] ? summarizeMacro(all[i], keyLabel) : 'Empty'}</span>
              </button>
            </li>
          ))}
        </ul>
        <section class="card">
          <MacroEditor
            key={current}
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
