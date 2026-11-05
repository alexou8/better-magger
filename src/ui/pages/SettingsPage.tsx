import type { PageProps } from '../App';
import { LoadError } from '../components/LoadError';
import { BackupRestore } from '../components/settings/BackupRestore';
import { CalibrationWizard } from '../components/settings/CalibrationWizard';
import { CopyProfile } from '../components/settings/CopyProfile';
import { DeviceSettings } from '../components/settings/DeviceSettings';
import { FactoryReset } from '../components/settings/FactoryReset';
import { Skeleton } from '../components/Skeleton';
import { useTable } from '../state/cache';

export function SettingsPage({ session: s, profile }: PageProps) {
  const settings = useTable('settings');
  const f = s.model.features;
  return (
    <div class="page-settings">
      <header class="page__header">
        <div>
          <h2>Settings</h2>
          <p class="help">Keyboard-wide options for profile {profile + 1}, plus calibration, backups and reset.</p>
        </div>
      </header>
      <section class="card">
        <h3>Keyboard</h3>
        {settings.error ? (
          <LoadError message={settings.error} onRetry={settings.reload} />
        ) : settings.data ? (
          <DeviceSettings session={s} profile={profile} settings={settings.data} />
        ) : (
          <Skeleton lines={5} />
        )}
      </section>
      {f.calibration && (
        <section class="card">
          <h3>Calibration</h3>
          <CalibrationWizard session={s} />
        </section>
      )}
      <section class="card">
        <h3>Backup & restore</h3>
        <BackupRestore session={s} profile={profile} />
        {f.profiles > 1 && (
          <>
            <h4>Copy to another profile</h4>
            <CopyProfile session={s} profile={profile} />
          </>
        )}
      </section>
      <section class="card card--danger">
        <h3>Factory reset</h3>
        <FactoryReset session={s} />
      </section>
    </div>
  );
}
