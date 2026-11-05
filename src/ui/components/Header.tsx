import type { KeyboardSession } from '../../core/types';
import { disconnect } from '../state/connection';
import { firmware } from '../state/session';
import { ProfileSwitcher } from './ProfileSwitcher';
import { ThemeToggle } from './ThemeToggle';

export function Header({ session }: { session: KeyboardSession }) {
  const fw = firmware.value;
  const { model } = session;
  return (
    <header class="header">
      <div class="header__device">
        <span class="status-dot" role="img" title="Connected" aria-label="Connected" />
        <div>
          <h1 class="header__model">
            {model.name}
            {session.isDemo && <span class="badge badge--demo">Demo</span>}
          </h1>
          <p class="header__meta">
            {fw ? `Firmware ${fw.display}` : 'Firmware …'}
            {fw?.updateAvailable && (
              <a class="badge badge--update" href="https://luminkey.club" target="_blank" rel="noopener noreferrer" title="Update with the official LUMINKEY updater">
                Update available
              </a>
            )}
          </p>
        </div>
      </div>
      <div class="header__actions">
        <span class="header__profile-label" aria-hidden="true">
          {model.features.profiles > 1 ? 'Profile' : ''}
        </span>
        <ProfileSwitcher count={model.features.profiles} />
        <ThemeToggle />
        <button type="button" class="btn" onClick={() => void disconnect()}>
          Disconnect
        </button>
      </div>
    </header>
  );
}
