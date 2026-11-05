import type { DeviceModel, KeyAction, Layout, MtSlot } from '../../../core/types';
import { describeAction } from '../../../data/keycodes';
import { KIND_INFO, type Binding } from '../../lib/advanced';
import { LAYERS } from '../../lib/layers';

interface Props {
  model: DeviceModel;
  layout: Layout;
  bindings: Binding[];
  mt?: MtSlot[];
  tgl?: KeyAction[];
  onEdit: (b: Binding) => void;
  onDelete: (b: Binding) => void;
}

export function BindingList({ model, layout, bindings, mt, tgl, onEdit, onDelete }: Props) {
  const keyName = (i: number | undefined) => layout.keys.find((k) => k.index === i)?.label ?? `#${i}`;
  const name = (a: KeyAction) => describeAction(a, model).label;

  const detail = (b: Binding): string => {
    if (b.kind === 'mt' && mt?.[b.slot]) return `Tap: ${name(mt[b.slot].tap)} · Hold: ${name(mt[b.slot].hold)} (${b.holdMs} ms)`;
    if (b.kind === 'tgl' && tgl?.[b.slot]) return `Toggles ${name(tgl[b.slot])}`;
    if (b.partner !== undefined) return `${keyName(b.index)} ↔ ${keyName(b.partner)}`;
    return KIND_INFO[b.kind].title;
  };

  if (!bindings.length) return <p class="empty-hint">No advanced keys yet. Create one below.</p>;

  return (
    <ul class="binding-list">
      {bindings.map((b) => (
        <li key={`${b.layer}/${b.index}`} class="binding">
          <span class={`badge badge--kind badge--${b.kind}`}>{KIND_INFO[b.kind].name}</span>
          <span class="binding__key">
            <span class="keycap">{keyName(b.index)}</span>
            {b.partner !== undefined && (
              <>
                {' + '}
                <span class="keycap">{keyName(b.partner)}</span>
              </>
            )}
          </span>
          <span class="binding__detail">
            {detail(b)}
            <span class="muted"> · {LAYERS[b.layer].name} layer</span>
          </span>
          <span class="btn-row">
            <button type="button" class="btn btn--small" onClick={() => onEdit(b)}>
              Edit
            </button>
            <button type="button" class="btn btn--small btn--danger" onClick={() => onDelete(b)}>
              Delete
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
