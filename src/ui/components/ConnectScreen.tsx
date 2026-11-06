import { useMemo, useState } from 'preact/hooks';
import { isWebHidSupported, supportedModels } from '../../core/connect';
import { connectKeyboard, startDemo } from '../state/connection';
import { connectNotice, connState, lastModelName } from '../state/session';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { KeyboardPreview } from './KeyboardPreview';
import { ThemeToggle } from './ThemeToggle';

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function ConnectScreen() {
  const supported = isWebHidSupported();
  const models = useMemo(() => supportedModels(), []);
  const magger = models.filter((m) => m.family !== 'Other');
  const [demoPid, setDemoPid] = useState<number | undefined>(undefined);
  const busy = connState.value === 'connecting';
  const notice = connectNotice.value;

  return (
    <main class="connect" id="main" tabIndex={-1}>
      <header class="connect__top">
        <Brand />
        <div class="connect__top-right">
          <span class="index-label">An independent keyboard workbench</span>
          <ThemeToggle />
        </div>
      </header>
      {connState.value === 'lost' && (
        <div class="notice notice--warn" role="alert">
          <div>
            <strong>
              {lastModelName.value ?? 'The keyboard'} disconnected.
            </strong>{' '}
            Plug it back in and we'll reconnect automatically. Changing the
            polling rate can briefly disconnect USB.
          </div>
        </div>
      )}
      <div class="connect__stage">
        <section class="hero">
          <span class="eyebrow">
            <span class="eyebrow__line" />
            For LUMINKEY Magger keyboards
          </span>
          <h1 class="hero__title">
            Every key.
            <br />
            <span>Just right.</span>
          </h1>
          <p class="hero__lead">
            A keyboard should feel like yours. Remap a key, find your actuation
            point, or dial in the lights. All from your browser.
          </p>
          <div class="hero__actions">
            <button
              type="button"
              class="btn btn--primary btn--large"
              disabled={busy || !supported}
              onClick={() => void connectKeyboard()}
            >
              <Icon name="usb" size={20} />
              {busy ? 'Connecting…' : 'Connect keyboard'}
              <Icon name="arrow" size={20} />
            </button>
            <span class="hero__connection-note">
              USB cable in.
              <br />
              We'll identify your model.
            </span>
          </div>
          {!supported && (
            <div class="notice notice--warn connect__browser-note" role="alert">
              <div>
                <strong>
                  {isMobile()
                    ? "Phones and tablets can't configure keyboards."
                    : "This browser can't talk to keyboards."}
                </strong>{' '}
                Open this site in desktop Chrome, Edge or Opera to connect. You
                can still explore the demo here.
              </div>
            </div>
          )}
          {notice && (
            <div class={`notice notice--${notice.tone}`} role="alert">
              <div>
                <strong>{notice.title}.</strong> {notice.body}
                {notice.tone === 'warn' && (
                  <>
                    {' '}
                    <a
                      href="https://luminkey.club"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open the official updater
                    </a>
                  </>
                )}
              </div>
            </div>
          )}
          <div class="hero__local">
            <Icon name="check" size={15} />
            <span>
              No account. No install. Settings sent directly to your keyboard.
            </span>
          </div>
        </section>
        <section class="connect__preview" aria-label="A look at the workspace">
          <KeyboardPreview />
          <div class="preview-functions">
            <span>Key mapping</span>
            <span>Rapid Trigger</span>
            <span>Lighting</span>
            <span>Macros</span>
          </div>
        </section>
      </div>
      <section class="demo-strip" aria-labelledby="demo-title">
        <div class="demo-strip__intro">
          <span class="index-label">Take a look first</span>
          <h2 id="demo-title">No keyboard handy?</h2>
          <p>Explore the full workbench with a virtual keyboard.</p>
        </div>
        <div class="demo-strip__controls">
          <label class="inline-field">
            <span>Demo model</span>
            <select
              value={demoPid ?? ''}
              onChange={(e) =>
                setDemoPid(
                  e.currentTarget.value
                    ? Number(e.currentTarget.value)
                    : undefined,
                )
              }
            >
              <option value="">Default (Magger68 Plus)</option>
              {magger.map((m) => (
                <option key={m.pid} value={m.pid}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            class="btn btn--demo"
            disabled={busy}
            onClick={() => void startDemo(demoPid)}
          >
            Try demo
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </section>
      <div class="connect__bottom">
        <section class="connect-guide" aria-labelledby="connect-guide-title">
          <div class="section-heading">
            <span class="index-label">Before you connect</span>
            <h2 id="connect-guide-title">Three small steps.</h2>
          </div>
          <ol class="connect-steps">
            <li>
              <span class="connect-step__number">01</span>
              <div>
                <h3>Plug in with USB.</h3>
                <p>
                  Use a data cable directly to your computer. Wireless receivers
                  may not expose settings.
                </p>
              </div>
            </li>
            <li>
              <span class="connect-step__number">02</span>
              <div>
                <h3>Give it the room.</h3>
                <p>
                  Close the official LUMINKEY driver and other configurator
                  tabs. Only one can connect at a time.
                </p>
              </div>
            </li>
            <li>
              <span class="connect-step__number">03</span>
              <div>
                <h3>Choose your keyboard.</h3>
                <p>
                  Click Connect keyboard and select it in the browser prompt.
                  Plus or Pro? We'll work that out.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section class="model-support" aria-labelledby="models-title">
          <span class="index-label">Built for Magger</span>
          <h2 id="models-title">A place for your board.</h2>
          <p>
            Magger68, Pro, Plus, Ultra and JIS, with support for Magger 60
            variants. Features follow the model you connect.
          </p>
          <details>
            <summary>
              View model list<span aria-hidden="true">+</span>
            </summary>
            <ul>
              {magger.map((m) => (
                <li key={m.pid}>{m.name}</li>
              ))}
            </ul>
          </details>
          <p class="help">
            Unofficial software. Export a backup before extensive changes.{' '}
            <a
              href="https://github.com/alexou8/better-magger/blob/claude/sleepy-archimedes-i4z9fx/docs/HARDWARE_VALIDATION.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Compatibility & first-use notes <Icon name="external" size={13} />
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
