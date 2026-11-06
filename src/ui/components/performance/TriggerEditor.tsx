import { SwitchPreview } from './SwitchPreview';
import type { DeviceModel, KeyMode, KeyTrigger } from '../../../core/types';
import { rtMode } from '../../../core/units';
import { RawMmSlider } from '../RawMmSlider';
import { convertRt, maxActuation, MODES, matchReleaseToPress } from '../../lib/trigger';
import { useId } from 'preact/hooks';

interface Props {
  model: DeviceModel;
  /** Values shown (first selected key). */
  trigger: KeyTrigger;
  count: number;
  mixed: boolean;
  onChange: (fn: (t: KeyTrigger) => KeyTrigger) => void;
}

/** Actuation, mode, RT sensitivity, dead zones and switch type for the selected keys. */
export function TriggerEditor({
  model,
  trigger: t,
  count,
  mixed,
  onChange,
}: Props) {
  const id = useId();
  const f = model.features;
  const lim = f.travel;
  const press = rtMode(model, t.pressPrecision);
  const release = rtMode(model, t.releasePrecision);
  const precisionChoice = f.rtPrecisionModes.length > 1;

  const setPrecision = (which: 'press' | 'release', id: number) =>
    onChange((k) =>
      which === 'press'
        ? {
            ...k,
            pressPrecision: id,
            rtPress: convertRt(model, k.rtPress, k.pressPrecision, id),
          }
        : {
            ...k,
            releasePrecision: id,
            rtRelease: convertRt(model, k.rtRelease, k.releasePrecision, id),
          },
    );

  const precisionSelect = (which: 'press' | 'release', value: number) => (
    <label class="inline-field">
      <span>{which === 'press' ? 'Press precision' : 'Release precision'}</span>
      <select
        value={value}
        onChange={(e) => setPrecision(which, Number(e.currentTarget.value))}
      >
        {f.rtPrecisionModes.map((m) => (
          <option key={m.id} value={m.id}>
            {m.stepMm} mm steps (up to {(m.maxRaw / m.rawPerMm).toFixed(1)} mm)
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div class="trigger-editor">
      <p class="help">
        Editing {count} key{count === 1 ? '' : 's'}
        {mixed &&
          ' · keys have different values; showing the first, a change applies only that setting to all'}
      </p>

      <fieldset class="field">
        <legend class="field__label">Mode</legend>
        <div class="segmented" role="radiogroup" aria-label="Trigger mode">
          {MODES.map((m) => (
            <button
              type="button"
              role="radio"
              key={m.id}
              id={`${id}-mode-${m.id}`}
              aria-checked={t.mode === m.id}
              tabIndex={t.mode === m.id ? 0 : -1}
              onKeyDown={(e) => {
                const next =
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? 2
                      : e.key === 'ArrowRight' || e.key === 'ArrowDown'
                        ? (m.id + 1) % 3
                        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                          ? (m.id + 2) % 3
                          : null;
                if (next === null || e.altKey || e.ctrlKey || e.metaKey) return;
                e.preventDefault();
                onChange((k) => ({ ...k, mode: next as KeyMode }));
                document.getElementById(`${id}-mode-${next}`)?.focus();
              }}
              class={t.mode === m.id ? 'is-active' : ''}
              onClick={() => onChange((k) => ({ ...k, mode: m.id as KeyMode }))}
            >
              {m.name}
            </button>
          ))}
        </div>
        <p class="help">{MODES.find((m) => m.id === t.mode)?.help}</p>
      </fieldset>

      <RawMmSlider
        id="actuation"
        label="Actuation point"
        raw={t.actuation}
        min={lim.minActuationRaw}
        max={maxActuation(model, t)}
        rawPerMm={lim.rawPerMm}
        help="How far you press before the key registers. Lower = faster but easier to trigger by accident."
        onChange={(v) => onChange((k) => ({ ...k, actuation: v }))}
      />

      {t.mode !== 0 && (
        <div class="rt-fields">
          <RawMmSlider
            id="rt-press"
            label="Rapid Trigger: press sensitivity"
            raw={t.rtPress}
            min={1}
            max={press.maxRaw}
            rawPerMm={press.rawPerMm}
            help="How far the key must go down again to re-activate."
            onChange={(v) => onChange((k) => ({ ...k, rtPress: v }))}
          />
          {precisionChoice && precisionSelect('press', t.pressPrecision)}
          <RawMmSlider
            id="rt-release"
            label="Rapid Trigger: release sensitivity"
            raw={t.rtRelease}
            min={1}
            max={release.maxRaw}
            rawPerMm={release.rawPerMm}
            help="How far the key must rise to turn off."
            onChange={(v) => onChange((k) => ({ ...k, rtRelease: v }))}
          />
          {precisionChoice && precisionSelect('release', t.releasePrecision)}
          <button type="button" class="btn" onClick={() => onChange(matchReleaseToPress)}>
            Match release to press
          </button>
          <p class="help">Use the same movement distance in both directions. This copies each selected key’s press sensitivity and precision to its release; you can still adjust them separately.</p>
        </div>
      )}

      {f.switchTypes.length > 0 && (
        <label class="field">
          <span class="field__label" id="switch-type-label">Switch type</span>
          <select
            aria-labelledby="switch-type-label"
            aria-describedby="switch-type-help"
            value={t.switchType}
            onChange={(e) =>
              onChange((k) => ({
                ...k,
                switchType: Number(e.currentTarget.value),
              }))
            }
          >
            {f.switchTypes.map((sw) => (
              <option key={sw.value} value={sw.value}>
                {sw.name}
              </option>
            ))}
          </select>
          <span class="help" id="switch-type-help">
            Match the switches installed so travel is measured correctly.
          </span>
        </label>
      )}

      <SwitchPreview key={t.switchType} model={model} trigger={t} />
      <p class="help">After physically changing switches, match the switch type here and calibrate in Settings. Choosing a type applies to the selected keys and may reduce actuation to fit their travel.</p>

      <details class="disclosure">
        <summary>Dead zones (advanced)</summary>
        <RawMmSlider
          id="dz-top"
          label="Top dead zone"
          raw={t.pressDeadzone}
          min={0}
          max={lim.deadzoneMaxRaw}
          rawPerMm={lim.rawPerMm}
          help="Ignore this much movement at the top, to avoid triggers from resting fingers or wobble."
          onChange={(v) => onChange((k) => ({ ...k, pressDeadzone: v }))}
        />
        <RawMmSlider
          id="dz-bottom"
          label="Bottom dead zone"
          raw={t.releaseDeadzone}
          min={0}
          max={lim.deadzoneMaxRaw}
          rawPerMm={lim.rawPerMm}
          help="Treat the last bit of travel as fully pressed, so bottoming out never releases the key."
          onChange={(v) => onChange((k) => ({ ...k, releaseDeadzone: v }))}
        />
      </details>
    </div>
  );
}
