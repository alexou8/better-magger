import type { DeviceModel, KeyAction, Layout } from '../../../core/types';
import { actionsEqual, describeAction } from '../../../data/keycodes';
import { navigate } from '../../state/route';

interface Props {
  model: DeviceModel;
  layout: Layout;
  selected: number[];
  map: KeyAction[];
  defaults: KeyAction[] | undefined;
  onResetKeys: () => void;
}

const isAdvanced = (a: KeyAction) => a.type >= 144 && a.type <= 150;

/** Summary of the selected key(s): current vs. default action and a reset button. */
export function KeyDetails({ model, layout, selected, map, defaults, onResetKeys }: Props) {
  const names = selected.map((i) => layout.keys.find((k) => k.index === i)?.label ?? `#${i}`);
  const remapped = defaults ? selected.filter((i) => !actionsEqual(map[i], defaults[i])) : [];
  const single = selected.length === 1 ? selected[0] : null;
  const current = single !== null ? describeAction(map[single], model) : null;

  return (
    <div class="key-details">
      <h3 class="key-details__title">
        {single !== null ? (
          <>
            <span class="keycap">{names[0]}</span> does <strong>{current?.label}</strong>
          </>
        ) : (
          `${selected.length} keys selected`
        )}
      </h3>
      {single !== null && defaults && remapped.length > 0 && (
        <p class="help">Default: {describeAction(defaults[single], model).label}</p>
      )}
      {selected.some((i) => isAdvanced(map[i])) && (
        <p class="notice notice--info">
          This key has an advanced binding. Picking a new action replaces it; to edit it, go to{' '}
          <a
            href="#/advanced"
            onClick={(e) => {
              e.preventDefault();
              navigate('advanced');
            }}
          >
            Advanced keys
          </a>
          .
        </p>
      )}
      <div class="btn-row">
        <button type="button" class="btn btn--small" disabled={!defaults || !remapped.length} onClick={onResetKeys}>
          Reset {selected.length === 1 ? 'key' : `${remapped.length} keys`} to default
        </button>
      </div>
    </div>
  );
}
