import { useRef, useState } from 'preact/hooks';
import type { KeyboardSession } from '../../../core/types';
import { applyProfile, downloadJson, gatherProfile, parseBackup } from '../../lib/backup';
import { save, showToast } from '../../state/toast';

interface Props {
  session: KeyboardSession;
  profile: number;
}

/** Export the current profile to JSON and import it back (same model only). */
export function BackupRestore({ session: s, profile }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const onProgress = (verb: string) => (done: number, total: number) => setProgress(`${verb}… ${Math.round((100 * done) / total)}%`);

  const exportProfile = async () => {
    await save(
      'backup',
      async () => {
        const b = await gatherProfile(s, profile, onProgress('Reading'));
        const date = new Date().toISOString().slice(0, 10);
        downloadJson(`${s.model.name.replace(/\s+/g, '-')}-profile${profile + 1}-${date}.json`, b);
      },
      { success: 'Backup downloaded' },
    );
    setProgress(null);
  };

  const importFile = async (f: File) => {
    const parsed = parseBackup(await f.text(), s.model);
    if (!parsed.ok) return void showToast('error', parsed.error);
    if (!confirm(`Replace everything in profile ${profile + 1} with “${f.name}”?`)) return;
    await save('restore', () => applyProfile(s, profile, parsed.backup, onProgress('Writing')), { success: `Profile ${profile + 1} restored` });
    setProgress(null);
  };

  return (
    <div class="backup">
      <p class="help">
        Save profile {profile + 1} (keymap, actuation, lighting, macros and advanced keys) to a file, or load one back.
        Backups only load on the same keyboard model.
      </p>
      <div class="btn-row">
        <button type="button" class="btn" disabled={!!progress} onClick={() => void exportProfile()}>
          Export profile {profile + 1}
        </button>
        <button type="button" class="btn" disabled={!!progress} onClick={() => file.current?.click()}>
          Import into profile {profile + 1}…
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (f) void importFile(f);
          }}
        />
      </div>
      {progress && (
        <p class="help" role="status">
          {progress}
        </p>
      )}
    </div>
  );
}
