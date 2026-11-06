import { useId } from 'preact/hooks';
import { switchProfile } from '../state/connection';
import { activeProfile } from '../state/session';
import { save } from '../state/toast';

export function ProfileSwitcher({ count }: { count: number }) {
  const id = useId();
  if (count <= 1) return null;
  return (
    <div
      class="segmented segmented--compact"
      role="radiogroup"
      aria-label="Profile"
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          type="button"
          role="radio"
          key={i}
          id={`${id}-profile-${i}`}
          aria-checked={activeProfile.value === i}
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
            document.getElementById(`${id}-profile-${next}`)?.focus();
            void save('profile', () => switchProfile(next), {
              success: `Switched to profile ${next + 1}`,
            });
          }}
          class={activeProfile.value === i ? 'is-active' : ''}
          title={`Profile ${i + 1}`}
          onClick={() =>
            void save('profile', () => switchProfile(i), {
              success: `Switched to profile ${i + 1}`,
            })
          }
        >
          <span class="visually-hidden">Profile </span>
          {i + 1}
        </button>
      ))}
    </div>
  );
}
