import { pendingReads } from '../state/cache';
import { pendingWrites } from '../state/toast';

/** Thin progress bar at the top of the window while the keyboard is being read or written. */
export function BusyBar() {
  const reading = pendingReads.value > 0;
  const busy = reading || pendingWrites.value > 0;
  return (
    <div class={`busy-bar${busy ? ' is-busy' : ''}`} role="progressbar" aria-hidden={!busy} aria-label={reading ? 'Reading from keyboard' : 'Saving to keyboard'}>
      <span />
    </div>
  );
}
