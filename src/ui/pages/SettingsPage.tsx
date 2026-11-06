import { ProfileName } from '../components/settings/ProfileName';
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
          <p class="section-kicker">Device & profiles</p>
          <h2>Settings</h2>
          <p class="help">
            Tune the keyboard, keep a copy of your setup, and maintain your
            switches.
          </p>
        </div>
        <span class="secondary-count">
          Profile {String(profile + 1).padStart(2, '0')}
        </span>
      </header>

      <section class="settings-section" aria-labelledby="settings-device-title">
        <header class="settings-section__heading">
          <span class="settings-section__index" aria-hidden="true">
            01
          </span>
          <div>
            <h3 id="settings-device-title">Device tuning</h3>
            <p class="help">
              Response rate, key protection and operating modes.
            </p>
          </div>
        </header>
        <div class="settings-section__body">
          {settings.error ? (
            <LoadError message={settings.error} onRetry={settings.reload} />
          ) : settings.data ? (
            <DeviceSettings
              session={s}
              profile={profile}
              settings={settings.data}
            />
          ) : (
            <Skeleton lines={5} />
          )}
        </div>
      </section>

      <section
        class="settings-section settings-section--backup"
        aria-labelledby="settings-backup-title"
      >
        <header class="settings-section__heading">
          <span class="settings-section__index" aria-hidden="true">
            02
          </span>
          <div>
            <h3 id="settings-backup-title">Backup & restore</h3>
            <p class="help">A local copy of everything in this profile.</p>
          </div>
        </header>
        <div class="settings-section__body">
          <ProfileName session={s} profile={profile} />
          <BackupRestore session={s} profile={profile} />
          {f.profiles > 1 && (
            <div class="settings-profile-copy">
              <h4>Copy to another profile</h4>
              <CopyProfile session={s} profile={profile} />
            </div>
          )}
        </div>
      </section>

      {f.calibration && (
        <section
          class="settings-section"
          aria-labelledby="settings-calibration-title"
        >
          <header class="settings-section__heading">
            <span class="settings-section__index" aria-hidden="true">
              03
            </span>
            <div>
              <h3 id="settings-calibration-title">Calibration</h3>
              <p class="help">Re-measure key travel after a switch change.</p>
            </div>
          </header>
          <div class="settings-section__body">
            <CalibrationWizard session={s} />
          </div>
        </section>
      )}

      <section
        class="settings-section settings-section--danger"
        aria-labelledby="settings-reset-title"
      >
        <header class="settings-section__heading">
          <span class="settings-section__index" aria-hidden="true">
            {f.calibration ? '04' : '03'}
          </span>
          <div>
            <h3 id="settings-reset-title">Factory reset</h3>
            <p class="help">Start over across all profiles. Back up first.</p>
          </div>
        </header>
        <div class="settings-section__body">
          <FactoryReset session={s} />
        </div>
      </section>
    </div>
  );
}
