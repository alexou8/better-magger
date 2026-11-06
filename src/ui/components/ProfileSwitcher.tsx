import type { KeyboardSession } from '../../core/types';
import { profileName } from '../state/profileNames';
import { useId } from 'preact/hooks';
import { switchProfile } from '../state/connection';
import { activeProfile, profileTarget } from '../state/session';
import { save } from '../state/toast';

export function ProfileSwitcher({ count, session }: { count: number; session: KeyboardSession }) {
  const id = useId();
  const busy = profileTarget.value !== null;
  if (count <= 1) return null;
  return (
    <div
      class="segmented segmented--compact"
      role="radiogroup"
      aria-label="Profile"
      aria-busy={busy}
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          type="button"
          role="radio"
          key={i}
          id={`${id}-profile-${i}`}
          aria-checked={activeProfile.value === i}
          aria-disabled={busy}
          data-pending={profileTarget.value === i ? true : undefined}
          tabIndex={activeProfile.value === i ? 0 : -1}
          onKeyDown={(e) => {
            const next =
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? count - 1
                  : e.key === 'ArrowRight' || e.key === 'ArrowDown'
                    ? (i + 1) % count
                    : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                      ? (i - 1 + count) % count
                      : null;
            if (next === null || e.altKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            if (profileTarget.peek() !== null) return;
            document.getElementById(`${id}-profile-${next}`)?.focus();
            void save('profile', () => switchProfile(next), {
              success: `Switched to profile ${next + 1}`,
            });
          }}
          class={activeProfile.value === i ? 'is-active' : ''}
          aria-label={`Profile ${i + 1}${profileName(session, i) ? `: ${profileName(session, i)}` : ''}`}
          title={`Profile ${i + 1}${profileName(session, i) ? `: ${profileName(session, i)}` : ''}`}
          onClick={() => {
            if (profileTarget.peek() !== null) return;
            void save('profile', () => switchProfile(i), {
              success: `Switched to profile ${i + 1}`,
            });
          }}
        >
          <span class="visually-hidden">Profile </span>
          {i + 1}
          {profileName(session, i) && <span class="profile-label">{profileName(session, i)}</span>}
        </button>
      ))}
    </div>
  );
}
