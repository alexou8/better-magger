import type { KeyboardSession } from '../../core/types';
import { disconnect } from '../state/connection';
import { firmware, profileTarget } from '../state/session';
import { ProfileSwitcher } from './ProfileSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { pendingWrites } from '../state/toast';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { useLayoutEffect, useRef } from 'preact/hooks';

export function Header({ session }: { session: KeyboardSession }) {
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = header.current!;
    const measure = () =>
      document.documentElement.style.setProperty(
        '--header-height',
        getComputedStyle(el).position === 'sticky'
          ? `${el.getBoundingClientRect().height}px`
          : '0px',
      );
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--header-height');
    };
  }, []);
  const fw = firmware.value;
  const { model } = session;
  return (
    <header ref={header} class="header">
      <div class="header__brand">
        <Brand />
        <span class="header__edition index-label">Keyboard workbench</span>
      </div>
      <div class="header__device">
        <div>
          <h1 class="header__model">
            {model.name}
            {session.isDemo && <span class="badge badge--demo">Demo</span>}
          </h1>
          <p class="header__meta">
            <span class={`connection-label${session.isDemo ? ' is-demo' : ''}`}>
              <span class="status-dot" />
              {session.isDemo ? 'Virtual keyboard' : 'Keyboard connected'}
            </span>
            <span class="header__meta-separator" aria-hidden="true">
              /
            </span>
            {fw ? `Firmware ${fw.display}` : 'Reading firmware…'}
            {fw?.updateAvailable && (
              <a
                class="badge badge--update"
                href="https://luminkey.club"
                target="_blank"
                rel="noopener noreferrer"
                title="Update with the official LUMINKEY updater"
              >
                Update available
              </a>
            )}
          </p>
        </div>
      </div>
      <div class="header__actions">
        <div class="header__profile">
          <span class="header__profile-label" aria-hidden="true">
            {model.features.profiles > 1 ? 'Profile' : ''}
          </span>
          <ProfileSwitcher count={model.features.profiles} />
        </div>
        <ThemeToggle />
        <button
          type="button"
          class="btn btn--disconnect"
          onClick={() => void disconnect()}
        >
          <Icon name="disconnect" size={18} />
          Disconnect
        </button>
      </div>
      <div class="header__status" role="status">
        <span class="header__status-mark" aria-hidden="true">
          {pendingWrites.value > 0 ? '···' : '↳'}
        </span>
        {profileTarget.value !== null
          ? `Switching to profile ${profileTarget.value + 1}…`
          : pendingWrites.value > 0
            ? 'Saving changes…'
            : session.isDemo
              ? 'Demo workspace. Your keyboard stays untouched.'
              : 'Changes apply directly to your keyboard.'}
        <span class="header__status-detail">
          {session.isDemo ? 'Explore freely' : 'Back up profiles in Settings'}
        </span>
      </div>
    </header>
  );
}
