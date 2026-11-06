import { LightingPreview } from '../components/lighting/LightingPreview';
import type { LightingSettings } from '../../core/types';
import {
  DIRECTION_LABELS,
  LIGHT_EFFECTS,
  SLEEP_OPTIONS_MIN,
} from '../../data/lighting';
import type { PageProps } from '../App';
import { ColorPicker } from '../components/lighting/ColorPicker';
import { EffectGallery } from '../components/lighting/EffectGallery';
import { KeyPainter } from '../components/lighting/KeyPainter';
import { LoadError } from '../components/LoadError';
import { Skeleton } from '../components/Skeleton';
import { Toggle } from '../components/Toggle';
import { useDebouncedWriter } from '../hooks/useDebouncedWriter';
import { navigate } from '../state/route';
import { getCached, setCached, useTable } from '../state/cache';
import { save } from '../state/toast';

type Patch = Partial<LightingSettings>;

const sleepLabel = (m: number) =>
  m === 0 ? 'Never' : m < 60 ? `${m} min` : `${m / 60} h`;

export function LightingPage({ session: s, profile }: PageProps) {
  const settings = useTable('settings');

  const write = useDebouncedWriter<Patch>(
    (patch) => {
      void save('lighting', () =>
        s.writeSettings(profile, { lighting: patch }),
      ).then((ok) => ok || settings.reload());
    },
    (a, b) => ({ ...a, ...b }),
    150,
  );

  if (settings.error)
    return <LoadError message={settings.error} onRetry={settings.reload} />;
  const base = settings.data;
  if (!base) return <Skeleton lines={5} />;
  const light = base.lighting;
  const locked = base.tachyonMode;
  const effect =
    LIGHT_EFFECTS.find((e) => e.id === light.effect) ?? LIGHT_EFFECTS[0];

  const change = (patch: Patch) => {
    const cur = getCached(profile, 'settings') ?? base;
    setCached(profile, 'settings', {
      ...cur,
      lighting: { ...cur.lighting, ...patch },
    }); // optimistic
    write(patch);
  };

  const directions = DIRECTION_LABELS[effect.direction];

  return (
    <div class="page-lighting">
      <header class="page__header">
        <div>
          <p class="section-kicker">Colour & motion</p>
          <h2>Lighting</h2>
          <p class="help">
            Choose a pattern. Set the intensity. Make it yours.
          </p>
        </div>
      </header>

      {locked && (
        <div class="notice notice--warn" role="status">
          <div>
            <strong>Lighting is locked while Tachyon mode is on.</strong>{' '}
            Tachyon mode trades lighting control for the lowest latency. Turn it
            off in{' '}
            <a
              href="#/settings"
              onClick={(e) => {
                e.preventDefault();
                navigate('settings');
              }}
            >
              Settings
            </a>{' '}
            to change lighting.
          </div>
        </div>
      )}

      <div class="lighting-workbench">
        <LightingPreview session={s} light={light} locked={locked} />
        <section
          class="lighting-library"
          aria-labelledby="effect-library-title"
        >
          <div class="secondary-heading">
            <h3 id="effect-library-title">Effect library</h3>
            <span class="secondary-count">{LIGHT_EFFECTS.length} patterns</span>
          </div>
          <p class="help lighting-library__note">
            Choose a pattern to see it on the keyboard above.
          </p>
          <EffectGallery
            value={light.effect}
            disabled={locked}
            onChange={(effect) => change({ effect })}
          />
        </section>

        <section
          class="lighting-controls"
          aria-labelledby="effect-controls-title"
        >
          <header class="lighting-controls__head">
            <p class="section-kicker">
              Effect {String(effect.id).padStart(2, '0')}
            </p>
            <h3 id="effect-controls-title">{effect.name}</h3>
            <p class="help">Applied as you adjust.</p>
          </header>
          <div class="lighting-controls__fields">
            {effect.brightness && (
              <div class="field">
                <label class="field__label" for="brightness">
                  Brightness <b>{light.brightness}%</b>
                </label>
                <input
                  id="brightness"
                  type="range"
                  min={0}
                  max={100}
                  value={light.brightness}
                  disabled={locked}
                  onInput={(e) =>
                    change({ brightness: Number(e.currentTarget.value) })
                  }
                />
              </div>
            )}
            {effect.speed && (
              <div class="field">
                <label class="field__label" for="speed">
                  Speed <b>{light.speed + 1} / 5</b>
                </label>
                <input
                  id="speed"
                  type="range"
                  min={0}
                  max={4}
                  value={light.speed}
                  disabled={locked}
                  onInput={(e) =>
                    change({ speed: Number(e.currentTarget.value) })
                  }
                />
              </div>
            )}
            {effect.direction !== 0 && directions && (
              <div class="field">
                <span class="field__label">Direction</span>
                <div
                  class="segmented"
                  role="radiogroup"
                  aria-label="Direction"
                  onKeyDown={(e) => {
                    if (locked || e.altKey || e.ctrlKey || e.metaKey) return;
                    let next: number;
                    if (e.key === 'Home') next = 0;
                    else if (e.key === 'End') next = directions.length - 1;
                    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
                      next = (light.direction + 1) % directions.length;
                    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
                      next =
                        (light.direction + directions.length - 1) %
                        directions.length;
                    else return;
                    e.preventDefault();
                    e.currentTarget.querySelectorAll('button')[next]?.focus();
                    change({ direction: next });
                  }}
                >
                  {directions.map((label, i) => (
                    <button
                      type="button"
                      role="radio"
                      key={label}
                      tabIndex={light.direction === i ? 0 : -1}
                      aria-checked={light.direction === i}
                      class={light.direction === i ? 'is-active' : ''}
                      disabled={locked}
                      onClick={() => change({ direction: i })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {effect.color && (
              <div class="field">
                <Toggle
                  checked={light.multicolor}
                  disabled={locked}
                  onChange={(multicolor) => change({ multicolor })}
                  label="Rainbow colours"
                  help="Cycle through all colours instead of one."
                />
                {!light.multicolor && (
                  <ColorPicker
                    id="light-color"
                    label="Colour"
                    value={[light.r, light.g, light.b]}
                    disabled={locked}
                    onChange={([r, g, b]) => change({ r, g, b })}
                  />
                )}
              </div>
            )}
            <label class="field">
              <span class="field__label">Turn lights off after</span>
              <select
                value={light.sleepMinutes}
                disabled={locked}
                onChange={(e) =>
                  change({ sleepMinutes: Number(e.currentTarget.value) })
                }
              >
                {SLEEP_OPTIONS_MIN.map((m) => (
                  <option key={m} value={m}>
                    {sleepLabel(m)} {m ? 'without typing' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </div>

      {effect.id === 0 && s.model.features.perKeyRgb && (
        <section class="lighting-painter">
          <div class="secondary-heading">
            <h3>Paint keys</h3>
            <span class="secondary-count">Per-key RGB</span>
          </div>
          <p class="help">
            Select keys, choose a colour and paint. The Custom effect shows
            these colours.
          </p>
          <KeyPainter session={s} profile={profile} disabled={locked} />
        </section>
      )}
    </div>
  );
}
