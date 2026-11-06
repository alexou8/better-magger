import { useEffect, useState } from 'preact/hooks';
import type { KeyboardSession, LightingSettings } from '../../../core/types';
import { LIGHT_EFFECTS } from '../../../data/lighting';
import { rgbToHex } from '../../lib/color';
import { previewColor } from '../../lib/lightingPreview';
import { useTable } from '../../state/cache';

export function LightingPreview({ session, light, locked }: { session: KeyboardSession; light: LightingSettings; locked: boolean }) {
  const colors = useTable('colors', 0, light.effect === 0 && session.model.features.perKeyRgb);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener('change', change);
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', change); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const animated = !!LIGHT_EFFECTS.find(e => e.id === light.effect)?.speed;
  const running = animated && !paused && !reduced && !hidden && !locked;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTime(t => t + 0.08), 80);
    return () => clearInterval(timer);
  }, [running]);
  const layout = session.layout;
  const unit = 34, pad = 16;
  return (
    <section class="lighting-preview-panel" aria-label="Lighting preview">
      <div class="secondary-heading">
        <div><p class="section-kicker">On your layout</p><h3>Live lighting preview</h3></div>
        <button type="button" class="btn" disabled={!animated || reduced || locked} onClick={() => setPaused(v => !v)}>{paused ? 'Play preview' : 'Pause preview'}</button>
      </div>
      <svg class="lighting-preview" viewBox={`0 0 ${layout.width * unit + 2 * pad} ${layout.height * unit + 2 * pad}`} role="img" aria-label={locked ? 'Lighting preview unavailable in Tachyon mode' : `${LIGHT_EFFECTS.find(e => e.id === light.effect)?.name ?? 'Unknown effect'} lighting illustration at ${light.brightness}% brightness`}>
        {layout.keys.map(k => <g key={k.id}>
          <rect x={pad + k.x * unit + 2} y={pad + k.y * unit + 2} width={k.w * unit - 4} height={k.h * unit - 4} rx="3" fill={rgbToHex(locked ? [0, 0, 0] : previewColor(light, k, time, colors.data?.[k.index]))} />
          <text x={pad + (k.x + k.w / 2) * unit} y={pad + (k.y + k.h / 2) * unit + 3} text-anchor="middle">{k.label}</text>
        </g>)}
      </svg>
      <p class="help">Illustrative preview; your keyboard’s timing and colours may differ. Reactive patterns play sample taps automatically.{reduced ? ' Motion is paused to match your reduced-motion preference.' : ''}{locked ? ' Preview is unavailable while Tachyon mode is on.' : ''}{light.effect === 0 && !colors.data ? (colors.error ? ' Custom colours could not be loaded.' : ' Custom colours are loading.') : ''}</p>
      {light.effect === 0 && colors.error && <button type="button" class="btn" onClick={colors.reload}>Retry custom colours</button>}
    </section>
  );
}
