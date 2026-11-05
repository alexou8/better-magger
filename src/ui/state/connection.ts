import { batch } from '@preact/signals';
import type { ConnectResult, KeyboardSession, SessionEvent } from '../../core/types';
import { isWebHidSupported, onDeviceAttached, openDemo, reconnectKnown, requestKeyboard } from '../../core/connect';
import { getCached, invalidate, setCached } from './cache';
import { activeProfile, connectNotice, connState, firmware, lastModelName, session } from './session';
import { errorMessage, showToast } from './toast';

let unsubscribe: (() => void) | null = null;
let reconnecting: Promise<boolean> | null = null;
let retryTimers: ReturnType<typeof setTimeout>[] = [];

function clearRetries(): void {
  retryTimers.forEach(clearTimeout);
  retryTimers = [];
}

async function adopt(s: KeyboardSession): Promise<void> {
  unsubscribe?.();
  clearRetries();
  invalidate();
  let profile = await s.getActiveProfile().catch(() => 0);
  if (profile < 0 || profile >= s.model.features.profiles) profile = 0;
  batch(() => {
    session.value = s;
    activeProfile.value = profile;
    connState.value = 'connected';
    connectNotice.value = null;
    firmware.value = null;
    lastModelName.value = s.model.name;
  });
  unsubscribe = s.on(handleEvent);
  s.getFirmware()
    .then((f) => {
      if (session.peek() === s) firmware.value = f;
    })
    .catch(() => undefined);
}

function handleEvent(e: SessionEvent): void {
  switch (e.kind) {
    case 'profileChanged':
      if (e.profile !== activeProfile.peek()) {
        activeProfile.value = e.profile;
        showToast('info', `Keyboard switched to profile ${e.profile + 1}`);
      }
      break;
    case 'osModeChanged': {
      const p = activeProfile.peek();
      const settings = getCached(p, 'settings');
      if (settings) setCached(p, 'settings', { ...settings, osMode: e.mode });
      break;
    }
    case 'resetDone':
      invalidate(e.profile);
      break;
    case 'lightingChanged':
      invalidate(activeProfile.peek());
      break;
    case 'wirelessLink':
      showToast(e.connected ? 'info' : 'error', e.connected ? 'Keyboard linked to the receiver' : 'Keyboard lost its link to the receiver');
      break;
    case 'disconnected':
      handleLost();
      break;
    case 'error':
      showToast('error', e.message);
      break;
    case 'travel':
      break; // consumed by live travel / calibration views
  }
}

function handleLost(): void {
  unsubscribe?.();
  unsubscribe = null;
  invalidate();
  batch(() => {
    session.value = null;
    connState.value = 'lost';
  });
  // Polling-rate changes and replugs re-enumerate the device; try a few silent reconnects.
  clearRetries();
  retryTimers = [1000, 3000, 6000].map((ms) => setTimeout(() => void tryReconnect(), ms));
}

/** Translates a ConnectResult into state or a friendly notice. Returns true when connected. */
async function handleResult(r: ConnectResult): Promise<boolean> {
  switch (r.status) {
    case 'connected':
      await adopt(r.session);
      return true;
    case 'bootloader':
      connectNotice.value = {
        tone: 'warn',
        title: `${r.modelName} is in firmware-update mode`,
        body: 'The keyboard is waiting for a firmware update, so it can\'t be configured right now. Unplug it and plug it back in to start normally, or finish the update with the official LUMINKEY updater.',
      };
      break;
    case 'unsupported':
      connectNotice.value = {
        tone: 'error',
        title: `"${r.productName || 'This device'}" isn't supported`,
        body: `Better Magger only works with LUMINKEY Magger keyboards (product id 0x${r.pid.toString(16).padStart(4, '0')}). If this is a Magger, please open an issue on GitHub.`,
      };
      break;
    case 'error':
      connectNotice.value = { tone: 'error', title: 'Could not connect', body: r.message };
      break;
    case 'cancelled':
      break;
  }
  if (connState.peek() === 'connecting') connState.value = 'idle';
  return false;
}

export async function connectKeyboard(): Promise<void> {
  connState.value = 'connecting';
  connectNotice.value = null;
  try {
    await handleResult(await requestKeyboard());
  } catch (err) {
    await handleResult({ status: 'error', message: errorMessage(err) });
  }
}

/** Silently reopens an already-authorised keyboard. */
export function tryReconnect(): Promise<boolean> {
  if (session.peek() || !isWebHidSupported()) return Promise.resolve(Boolean(session.peek()));
  reconnecting ??= (async () => {
    try {
      const r = await reconnectKnown();
      return r ? await handleResult(r) : false;
    } catch {
      return false;
    } finally {
      reconnecting = null;
    }
  })();
  return reconnecting;
}

export async function startDemo(pid?: number): Promise<void> {
  connState.value = 'connecting';
  try {
    await adopt(await openDemo(pid));
  } catch (err) {
    await handleResult({ status: 'error', message: errorMessage(err) });
  }
}

export async function disconnect(): Promise<void> {
  const s = session.peek();
  unsubscribe?.();
  unsubscribe = null;
  clearRetries();
  invalidate();
  batch(() => {
    session.value = null;
    connState.value = 'idle';
    firmware.value = null;
  });
  await s?.close().catch(() => undefined);
}

/** Call once at startup: silent reconnect + auto-reconnect on replug. Returns a cleanup. */
export function initConnection(): () => void {
  if (!isWebHidSupported()) return () => undefined;
  void tryReconnect();
  return onDeviceAttached(() => void tryReconnect());
}

export async function switchProfile(profile: number): Promise<void> {
  const s = session.peek();
  if (!s || profile === activeProfile.peek()) return;
  await s.selectProfile(profile);
  activeProfile.value = profile;
}
