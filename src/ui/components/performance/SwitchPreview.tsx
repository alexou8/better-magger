import { useState } from 'preact/hooks';
import type { DeviceModel, KeyTrigger } from '../../../core/types';
import { formatMm } from '../../../core/units';
import { fullTravel } from '../../lib/trigger';

/** Manual travel demonstration, intentionally independent of live device measurements. */
export function SwitchPreview({ model, trigger }: { model: DeviceModel; trigger: KeyTrigger }) {
  const [depth, setDepth] = useState(0);
  const maximum = fullTravel(model, trigger.switchType);
  const raw = Math.min(depth, maximum);
  const active = raw >= trigger.actuation;
  const mm = (value: number) => formatMm(value / model.features.travel.rawPerMm);
  return (
    <section class="switch-preview" aria-label="Switch preview">
      <div class="switch-preview__head">
        <div><p class="section-kicker">Try the travel</p><h4>{model.features.switchTypes.find(s => s.value === trigger.switchType)?.name ?? 'Installed switch'}</h4></div>
        <span class="badge">{mm(maximum)} travel</span>
      </div>
      <div class="switch-preview__body">
        <svg viewBox="0 0 120 135" role="img" aria-label={`Switch at ${mm(raw)} of travel`}>
          <path d="M30 54H90V119H30Z" class="switch-housing" />
          <path d="M52 88L68 94L52 100L68 106L52 112" class="switch-spring" />
          <g transform={`translate(0 ${raw / maximum * 40})`}>
            <path d="M50 28H70V75H50Z" class="switch-stem" />
            <rect x="18" y="12" width="84" height="24" rx="5" class="switch-cap" />
          </g>
          <path d="M20 120H100" class="switch-spring" />
        </svg>
        <div><strong>{mm(raw)}</strong><p class="help">{active ? 'Past actuation point' : 'Before actuation point'}</p></div>
      </div>
      <label class="field" for="preview-depth">
        <span class="field__label">Preview press depth</span>
        <input id="preview-depth" type="range" min="0" max={maximum} step="1" value={raw}
          aria-valuetext={mm(raw)} aria-describedby="preview-depth-help" onInput={e => setDepth(Number(e.currentTarget.value))} />
      </label>
      <p class="help" id="preview-depth-help">Drag to press the illustrated switch. This explains the first actuation point; it does not change settings or simulate Rapid Trigger. Use Live key view to measure your keyboard.</p>
    </section>
  );
}
