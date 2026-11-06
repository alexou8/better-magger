import type { ComponentChildren } from 'preact';
import type { AdvancedKind } from '../../../core/types';
import { KIND_INFO } from '../../lib/advanced';
import { LAYERS } from '../../lib/layers';

interface Props {
  kind: AdvancedKind;
  layer: number;
  editing: boolean;
  canSave: boolean;
  saving: boolean;
  problem?: string | null;
  onSave: () => void;
  onCancel: () => void;
  children: ComponentChildren;
}

/** Shared title, explanation and Save/Cancel bar for the advanced-key wizards. */
export function WizardFrame({
  kind,
  layer,
  editing,
  canSave,
  saving,
  problem,
  onSave,
  onCancel,
  children,
}: Props) {
  const info = KIND_INFO[kind];
  return (
    <section
      class="card wizard"
      aria-label={`${editing ? 'Edit' : 'New'} ${info.name}`}
    >
      <header class="wizard__header">
        <h2>
          {editing ? 'Edit' : 'New'} {info.name}
          <span class="wizard__subtitle">
            {' '}
            · {info.title} · {LAYERS[layer].name} layer
          </span>
        </h2>
        <p class="help">
          {info.description} <em>Example: {info.example}</em>
        </p>
      </header>
      {children}
      {problem && <p class="notice notice--warn">{problem}</p>}
      <div class="btn-row wizard__actions">
        <button
          type="button"
          class="btn btn--primary"
          disabled={!canSave || saving}
          onClick={onSave}
        >
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Assign to key'}
        </button>
        <button type="button" class="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
