import { useState } from 'preact/hooks';
import type { KeyboardSession } from '../../../core/types';
import { profileName, renameProfile } from '../../state/profileNames';

export function ProfileName({ session, profile }: { session: KeyboardSession; profile: number }) {
  const [name, setName] = useState(() => profileName(session, profile));
  const [saved, setSaved] = useState('');
  return (
    <form class="profile-name-form" onSubmit={(e) => {
      e.preventDefault();
      const remembered = renameProfile(session, profile, name);
      setName(profileName(session, profile));
      setSaved(remembered ? 'Profile name saved.' : 'Name updated for this session. Browser storage is unavailable.');
    }}>
      <label class="field" for="profile-name">
        <span class="field__label">Profile {profile + 1} name</span>
        <input type="text" id="profile-name" value={name} maxLength={24} placeholder="e.g. Everyday or Gaming"
          aria-describedby="profile-name-help" onInput={(e) => { setName(e.currentTarget.value); setSaved(''); }} />
      </label>
      <p class="help" id="profile-name-help">Up to 24 characters. Names are saved only in this browser, per keyboard model. Leave blank to use the profile number. Names are not included in backups.</p>
      <button class="btn" type="submit">Save profile name</button>
      <span class="help" role="status">{saved}</span>
    </form>
  );
}
