import { useMemo, useState } from 'preact/hooks';
import { isWebHidSupported, supportedModels } from '../../core/connect';
import { connectKeyboard, startDemo } from '../state/connection';
import { connectNotice, connState, lastModelName } from '../state/session';
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
    <main class="connect" id="main">
      <div class="connect__top">
        <ThemeToggle />
      </div>

      {connState.value === 'lost' && (
        <div class="notice notice--warn" role="alert">
          <div>
            <strong>{lastModelName.value ?? 'The keyboard'} disconnected.</strong> Plug it back in and we'll reconnect
            automatically. Changing the polling rate also briefly reconnects the keyboard.
          </div>
        </div>
      )}

      <section class="hero">
        <h1 class="hero__title">Better Magger</h1>
        <p class="hero__lead">
          A friendly configurator for LUMINKEY Magger hall-effect keyboards. Remap keys, tune actuation and Rapid
          Trigger, set up lighting and macros, all saved straight to your keyboard.
        </p>

        {supported ? (
          <div class="hero__actions">
            <button type="button" class="btn btn--primary btn--large" disabled={busy} onClick={() => void connectKeyboard()}>
              {busy ? 'Connecting…' : 'Connect keyboard'}
            </button>
          </div>
        ) : (
          <div class="notice notice--warn" role="alert">
            <div>
              <strong>{isMobile() ? 'Phones and tablets can\'t configure keyboards.' : 'This browser can\'t talk to keyboards.'}</strong>{' '}
              Better Magger uses WebHID, which only exists in desktop <b>Chrome</b>, <b>Edge</b> or <b>Opera</b> (Windows,
              macOS, Linux, ChromeOS). Firefox and Safari don't support it. You can still look around with the demo.
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
                  <a href="https://luminkey.club" target="_blank" rel="noopener noreferrer">
                    Open the official updater
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        <div class="hero__demo">
          <button type="button" class="btn" disabled={busy} onClick={() => void startDemo(demoPid)}>
            Try demo
          </button>
          <label class="inline-field">
            <span>Demo model</span>
            <select
              value={demoPid ?? ''}
              onChange={(e) => setDemoPid(e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
            >
              <option value="">Default (Magger68 Plus)</option>
              {magger.map((m) => (
                <option key={m.pid} value={m.pid}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div class="connect__grid">
        <section class="card">
          <h2>How to connect</h2>
          <ol class="tips">
            <li>
              Plug the keyboard in with a <b>USB cable</b> (the wireless receiver may not expose settings).
            </li>
            <li>
              <b>Close the official LUMINKEY driver</b> (website tab or desktop app). Only one app can use the keyboard
              at a time.
            </li>
            <li>
              Click <b>Connect keyboard</b> and choose your Magger in the browser's list. Next time it reconnects by
              itself.
            </li>
            <li>Nothing in the list? Try another cable or USB port, and make sure it's not in firmware-update mode.</li>
          </ol>
        </section>

        <section class="card">
          <h2>Supported keyboards</h2>
          <ul class="chips">
            {(magger.length ? magger : models).map((m) => (
              <li key={m.pid} class="chip">
                {m.name}
              </li>
            ))}
          </ul>
          <p class="help">Settings are applied to the keyboard immediately and stay there, even on other computers.</p>
        </section>
      </div>
    </main>
  );
}
