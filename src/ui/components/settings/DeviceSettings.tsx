import type { BaseSettings, KeyboardSession } from '../../../core/types';
import { setCached } from '../../state/cache';
import { session } from '../../state/session';
import { save } from '../../state/toast';
import { Toggle } from '../Toggle';

type Patch = Partial<Omit<BaseSettings, 'lighting'>>;

interface Props {
  session: KeyboardSession;
  profile: number;
  settings: BaseSettings;
}

const DEBOUNCE = [
  { value: 0, name: 'Low', help: 'Fastest response.' },
  { value: 1, name: 'Medium', help: 'Balanced.' },
  { value: 2, name: 'High', help: 'Use if a key ever double-types.' },
];

export function DeviceSettings({ session: s, profile, settings }: Props) {
  const f = s.model.features;
  const write = (what: string, patch: Patch) =>
    void save(what, async () => setCached(profile, 'settings', await s.writeSettings(profile, patch)));

  /** Polling-rate changes re-enumerate the keyboard, so a dropped reply is expected; auto-reconnect follows. */
  const writePolling = (pollingRate: number) =>
    void save(
      'polling rate',
      async () => {
        try {
          setCached(profile, 'settings', await s.writeSettings(profile, { pollingRate }));
        } catch (err) {
          if (session.peek() === s) throw err;
        }
      },
      { success: 'Polling rate changed. The keyboard may reconnect.' },
    );

  return (
    <div class="settings-grid">
      <label class="field">
        <span class="field__label">Polling rate</span>
        <select value={settings.pollingRate} onChange={(e) => writePolling(Number(e.currentTarget.value))}>
          {f.pollingRates.map((r) => (
            <option key={r.value} value={r.value}>
              {r.hz.toLocaleString()} Hz
            </option>
          ))}
        </select>
        <span class="help">How often the keyboard reports to the computer. The keyboard briefly reconnects after a change; we reconnect automatically.</span>
      </label>

      <fieldset class="field">
        <legend class="field__label">Debounce</legend>
        <div class="segmented" role="radiogroup">
          {DEBOUNCE.map((d) => (
            <button type="button" role="radio" key={d.value} aria-checked={settings.debounce === d.value} class={settings.debounce === d.value ? 'is-active' : ''} onClick={() => write('debounce', { debounce: d.value })}>
              {d.name}
            </button>
          ))}
        </div>
        <span class="help">{DEBOUNCE.find((d) => d.value === settings.debounce)?.help}</span>
      </fieldset>

      <Toggle
        checked={settings.bottomOutActuation}
        onChange={(v) => write('bottom-out setting', { bottomOutActuation: v })}
        label="Actuate when bottomed out"
        help="Keys always register when pressed all the way down, even with unusual dead-zone settings."
      />
      <Toggle
        checked={settings.tachyonMode}
        onChange={(v) => write('Tachyon mode', { tachyonMode: v })}
        label="Tachyon mode"
        help="Lowest possible latency. Lighting can't be changed while it is on."
      />
      <Toggle checked={settings.lockWin} onChange={(v) => write('Win lock', { lockWin: v })} label="Disable the Windows key" help="Stops accidental Start-menu pops while gaming." />
      <Toggle checked={settings.lockAltTab} onChange={(v) => write('Alt+Tab lock', { lockAltTab: v })} label="Disable Alt+Tab" />
      <Toggle checked={settings.lockAltF4} onChange={(v) => write('Alt+F4 lock', { lockAltF4: v })} label="Disable Alt+F4" />

      <div class="field">
        <span class="field__label">Operating system mode</span>
        <p>
          <span class="badge">{settings.osMode === 'mac' ? 'macOS' : 'Windows'}</span>
        </p>
        <span class="help">Switched on the keyboard itself with its OS shortcut (see the manual). Mac mode uses the “Mac / FN2” layer.</span>
      </div>
    </div>
  );
}
