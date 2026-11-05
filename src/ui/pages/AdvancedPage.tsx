import { useState } from 'preact/hooks';
import type { AdvancedKind, KeyAction } from '../../core/types';
import type { PageProps } from '../App';
import { BindingList } from '../components/advanced/BindingList';
import { DksWizard } from '../components/advanced/DksWizard';
import { MtWizard } from '../components/advanced/MtWizard';
import { PairWizard } from '../components/advanced/PairWizard';
import { TglWizard } from '../components/advanced/TglWizard';
import type { WizardProps } from '../components/advanced/wizardProps';
import { LayerTabs } from '../components/LayerTabs';
import { LoadError } from '../components/LoadError';
import { Skeleton } from '../components/Skeleton';
import { findBindings, KIND_INFO, PAIR_KINDS, type Binding } from '../lib/advanced';
import { removeBinding } from '../state/advancedOps';
import { useTable } from '../state/cache';
import { save } from '../state/toast';

export function AdvancedPage({ session: s, profile }: PageProps) {
  const f = s.model.features;
  const kinds = f.advanced;
  // Fixed number of hook calls: four layers, disabled beyond the model's layer count.
  const tables = [0, 1, 2, 3].map((l) => useTable('keymap', l, l < f.layers));
  const mt = useTable('mt', 0, kinds.includes('mt'));
  const tgl = useTable('tgl', 0, kinds.includes('tgl'));
  const [layer, setLayer] = useState(0);
  const [wizard, setWizard] = useState<{ kind: AdvancedKind; editing: Binding | null } | null>(null);

  const used = tables.slice(0, f.layers);
  const failed = used.find((t) => t.error);
  if (failed) return <LoadError message={failed.error!} onRetry={failed.reload} />;
  if (used.some((t) => !t.data)) return <Skeleton keyboard lines={3} />;
  const keymaps = used.map((t) => t.data as KeyAction[]);
  const bindings = findBindings(keymaps, kinds);

  const onDelete = (b: Binding) => {
    if (!confirm(`Delete this ${KIND_INFO[b.kind].name} binding? The key${b.partner !== undefined ? 's go' : ' goes'} back to the default action.`)) return;
    void save(`${KIND_INFO[b.kind].name} removal`, () => removeBinding(s, profile, b), { success: 'Binding deleted' });
  };

  if (wizard) {
    const props: WizardProps = {
      session: s,
      profile,
      layer: wizard.editing?.layer ?? layer,
      keymaps,
      editing: wizard.editing,
      onDone: () => setWizard(null),
    };
    const k = wizard.kind;
    return (
      <div class="page-advanced">
        {k === 'dks' ? (
          <DksWizard {...props} />
        ) : k === 'mt' ? (
          <MtWizard {...props} />
        ) : k === 'tgl' ? (
          <TglWizard {...props} />
        ) : (
          <PairWizard {...props} kind={k} />
        )}
      </div>
    );
  }

  return (
    <div class="page-advanced">
      <header class="page__header">
        <div>
          <h2>Advanced keys</h2>
          <p class="help">Give keys extra powers. Each binding lives on one layer of the current profile.</p>
        </div>
      </header>
      <section class="card">
        <h3>Your advanced keys</h3>
        <BindingList
          model={s.model}
          layout={s.layout}
          bindings={bindings}
          mt={mt.data}
          tgl={tgl.data}
          onEdit={(b) => setWizard({ kind: b.kind, editing: b })}
          onDelete={onDelete}
        />
      </section>
      <section class="card">
        <h3>Create a new one</h3>
        <LayerTabs layers={f.layers} value={layer} onChange={setLayer} />
        <div class="kind-grid">
          {kinds.map((k) => (
            <button type="button" key={k} class="kind-card" onClick={() => setWizard({ kind: k, editing: null })}>
              <span class={`badge badge--kind badge--${k}`}>{KIND_INFO[k].name}</span>
              <span class="kind-card__title">{KIND_INFO[k].title}</span>
              <span class="help">{KIND_INFO[k].description}</span>
              <span class="help">
                <em>{KIND_INFO[k].example}</em>
              </span>
              {PAIR_KINDS.includes(k) && <span class="muted">Uses two keys</span>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
