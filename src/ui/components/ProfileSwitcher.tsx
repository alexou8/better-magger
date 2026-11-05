import { switchProfile } from '../state/connection';
import { activeProfile } from '../state/session';
import { save } from '../state/toast';

export function ProfileSwitcher({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <div class="segmented segmented--compact" role="radiogroup" aria-label="Profile">
      {Array.from({ length: count }, (_, i) => (
        <button
          type="button"
          role="radio"
          key={i}
          aria-checked={activeProfile.value === i}
          class={activeProfile.value === i ? 'is-active' : ''}
          title={`Profile ${i + 1}`}
          onClick={() => void save('profile', () => switchProfile(i), { success: `Switched to profile ${i + 1}` })}
        >
          <span class="visually-hidden">Profile </span>
          {i + 1}
        </button>
      ))}
    </div>
  );
}
