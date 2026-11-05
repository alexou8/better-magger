import { useState } from 'preact/hooks';
import type { KeyboardSession } from '../../../core/types';
import { applyProfile, gatherProfile } from '../../lib/backup';
import { save } from '../../state/toast';

interface Props {
  session: KeyboardSession;
  profile: number;
}

export function CopyProfile({ session: s, profile }: Props) {
  const count = s.model.features.profiles;
  const others = Array.from({ length: count }, (_, i) => i).filter((i) => i !== profile);
  const [target, setTarget] = useState(others[0] ?? 0);
  const [progress, setProgress] = useState<string | null>(null);

  if (!others.length) return null;

  const copy = async () => {
    if (!confirm(`Overwrite profile ${target + 1} with a copy of profile ${profile + 1}?`)) return;
    await save(
      'profile copy',
      async () => {
        const b = await gatherProfile(s, profile, (d, t) => setProgress(`Reading… ${Math.round((100 * d) / t)}%`));
        await applyProfile(s, target, b, (d, t) => setProgress(`Writing… ${Math.round((100 * d) / t)}%`));
      },
      { success: `Copied to profile ${target + 1}` },
    );
    setProgress(null);
  };

  return (
    <div class="copy-profile">
      <label class="inline-field">
        <span>Copy profile {profile + 1} to</span>
        <select value={target} onChange={(e) => setTarget(Number(e.currentTarget.value))}>
          {others.map((i) => (
            <option key={i} value={i}>
              Profile {i + 1}
            </option>
          ))}
        </select>
      </label>
      <button type="button" class="btn" disabled={!!progress} onClick={() => void copy()}>
        {progress ?? 'Copy'}
      </button>
    </div>
  );
}
