import { useEffect, useState } from 'preact/hooks';
import type { KeyboardSession, LightingSettings } from '../../../core/types';
import { LIGHT_EFFECTS } from '../../../data/lighting';
import { rgbToHex } from '../../lib/color';
import { previewColor } from '../../lib/lightingPreview';
import { useLiveColors } from '../../hooks/useLiveColors';
import { useTable } from '../../state/cache';

interface Props {
  session: KeyboardSession;
  light: LightingSettings;
  locked: boolean;
}

export function LightingPreview({ session, light, locked }: Props) {
  const [source, setSource] = useState('keyboard');
  const colors = useTable('colors', 0, source === 'illustration' && light.effect === 0 && session.model.features.perKeyRgb);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hidden, setHidden] = useState(() => document.hidden);
  const hardware = source === 'keyboard';
  const live = useLiveColors(session, hardware && !hidden, !paused && !reduced);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener('change', change);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      media.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const effect = LIGHT_EFFECTS.find(e => e.id === light.effect);
  const running = !hardware && effect?.speed && !paused && !reduced && !hidden && !locked;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTime(t => t + 0.08), 80);
    return () => clearInterval(timer);
  }, [running]);

  const layout = session.layout;
  const unit = 34, pad = 16;
  const still = paused || reduced || hidden;
  const status = hardware
    ? live.error ? 'Read unavailable' : !live.colors ? 'Waiting for LED data' : still ? 'Snapshot paused' : session.isDemo ? 'Demo LED stream' : 'Reading keyboard LEDs'
    : 'Illustration';

  return (
    <section class="lighting-preview-panel" aria-label="Lighting preview">
      <div class="secondary-heading">
        <div>
          <p class="section-kicker">On your layout</p>
          <h3>{hardware ? 'Keyboard lighting' : 'Lighting illustration'}</h3>
        </div>
        <div class="preview-actions">
          <label class="preview-source" for="preview-source">
            <span class="field__label" id="preview-source-label">Preview source</span>
            <select id="preview-source" aria-labelledby="preview-source-label" value={source} onChange={e => { setSource(e.currentTarget.value); setPaused(false); }}>
              <option value="keyboard">Keyboard LEDs{session.isDemo ? ' (demo)' : ''}</option>
              <option value="illustration">Illustration</option>
            </select>
          </label>
          <button type="button" class="btn" disabled={reduced || (!hardware && (!effect?.speed || locked))}
            onClick={() => setPaused(v => !v)}>{paused ? 'Play preview' : 'Pause preview'}</button>
          {hardware && still && <button type="button" class="btn" onClick={live.refresh}>Refresh snapshot</button>}
        </div>
      </div>
      <p class="preview-status index-label" role="status">{status}</p>
      <svg class="lighting-preview" data-source={source}
        viewBox={`0 0 ${layout.width * unit + 2 * pad} ${layout.height * unit + 2 * pad}`}
        role="img" aria-label={hardware ? 'Current keyboard LED samples' : `${effect?.name ?? 'Unknown effect'} lighting illustration at ${light.brightness}% brightness`}>
        {layout.keys.map(k => {
          // Live output already includes firmware brightness and effect timing.
          const rgb = hardware ? live.colors?.[k.index] : locked ? undefined : previewColor(light, k, time, colors.data?.[k.index]);
          return <g key={k.id}>
            <rect x={pad + k.x * unit + 2} y={pad + k.y * unit + 2} width={k.w * unit - 4} height={k.h * unit - 4} rx="3" fill={rgb ? rgbToHex(rgb) : '#262a26'} />
            <text x={pad + (k.x + k.w / 2) * unit} y={pad + (k.y + k.h / 2) * unit + 3} text-anchor="middle">{k.label}</text>
          </g>;
        })}
      </svg>
      <p class="help">
        {hardware
          ? `${session.isDemo ? 'Synthetic LED output from the demo keyboard.' : 'Reads the keyboard’s current LED colours.'} Follows live LED output at up to 30 updates per second, depending on USB speed. Screen colours may look different. Pause freezes only this view.`
          : 'Illustrative patterns, independent of the keyboard’s timing. Reactive patterns play sample taps automatically.'}
        {reduced ? ' Motion is paused to match your reduced-motion preference.' : ''}
        {!hardware && locked ? ' Illustration is unavailable while Tachyon mode is on.' : ''}
        {!hardware && light.effect === 0 && !colors.data ? (colors.error ? ' Custom colours could not be loaded.' : ' Custom colours are loading.') : ''}
      </p>
      {hardware && live.error && <div class="notice notice--warn" role="alert">
        <div><strong>Could not read live LEDs.</strong> {live.error} Use Illustration if this firmware does not support live readback.</div>
        <button type="button" class="btn" onClick={live.refresh}>Retry LED read</button>
      </div>}
      {!hardware && light.effect === 0 && colors.error && <button type="button" class="btn" onClick={colors.reload}>Retry custom colours</button>}
    </section>
  );
}
