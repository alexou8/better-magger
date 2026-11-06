import { batch } from '@preact/signals';
import type { ConnectResult, KeyboardSession, SessionEvent } from '../../core/types';
import { isWebHidSupported, onDeviceAttached, openDemo, reconnectKnown, requestKeyboard } from '../../core/connect';
import { getCached, invalidate, setCached } from './cache';
import { activeProfile, connectNotice, connState, firmware, lastModelName, session } from './session';
import { errorMessage, showToast } from './toast';

let unsubscribe: (() => void) | null = null;
let reconnecting: Promise<boolean> | null = null;
let retryTimers: ReturnType<typeof setTimeout>[] = [];
/** Only the latest user intent may publish a session or a connection error. */
let intent = 0;
let explicitConnection = false;
const operations = new Set<number>();
const unusedSessions = new Set<KeyboardSession>();

async function releaseUnused(): Promise<void> {
  // Core connects can share one session. Wait until every result has a chance to claim it.
  if (operations.size) return;
  const unused = [...unusedSessions];
  unusedSessions.clear();
  await Promise.all(unused.filter((s) => s !== session.peek()).map((s) => s.close().catch(() => undefined)));
}

function beginConnection(explicit: boolean): number {
  if (explicit) clearRetries();
  const token = ++intent;
  operations.add(token);
  explicitConnection = explicit;
  return token;
}

async function finishConnection(token: number): Promise<void> {
  operations.delete(token);
  if (token === intent) explicitConnection = false;
  await releaseUnused();
}

function clearRetries(): void {
  retryTimers.forEach(clearTimeout);
  retryTimers = [];
}

async function adopt(s: KeyboardSession, token: number): Promise<boolean> {
  if (token !== intent) {
    unusedSessions.add(s);
    return false;
  }
  let disconnected = false;
  let reportedProfile: number | undefined;
  const off = s.on((event) => {
    if (event.kind === 'disconnected') disconnected = true;
    if (event.kind === 'profileChanged') reportedProfile = event.profile;
    if (session.peek() === s && token === intent) handleEvent(event);
  });
  try {
    // A failed profile read must not silently route edits to profile zero.
    let profile = await s.getActiveProfile();
    if (token !== intent || disconnected) {
      off();
      unusedSessions.add(s);
      if (disconnected && token === intent) throw new Error('The keyboard disconnected while connecting. Plug it back in and try again.');
      return false;
    }
    profile = reportedProfile ?? profile;
    if (!Number.isInteger(profile) || profile < 0 || profile >= s.model.features.profiles) {
      throw new Error('The keyboard reported an invalid active profile. Reconnect before editing.');
    }
    const previous = session.peek();
    unsubscribe?.();
    unsubscribe = off;
    clearRetries();
    invalidate();
    batch(() => {
      session.value = s;
      activeProfile.value = profile;
      connState.value = 'connected';
      connectNotice.value = null;
      firmware.value = null;
      lastModelName.value = s.model.name;
    });
    if (previous && previous !== s) unusedSessions.add(previous);
    s.getFirmware()
      .then((f) => {
        if (session.peek() === s) firmware.value = f;
      })
      .catch(() => undefined);
    return true;
  } catch (error) {
    off();
    unusedSessions.add(s);
    throw error;
  }
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
  ++intent;
  explicitConnection = false;
  const lost = session.peek();
  if (lost) unusedSessions.add(lost);
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
  void releaseUnused();
}

/** Translates a ConnectResult into state or a friendly notice. Returns true when connected. */
async function handleResult(r: ConnectResult, token: number): Promise<boolean> {
  if (token !== intent) {
    if (r.status === 'connected') unusedSessions.add(r.session);
    return false;
  }
  switch (r.status) {
    case 'connected':
      return adopt(r.session, token);
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
  const token = beginConnection(true);
  connState.value = 'connecting';
  connectNotice.value = null;
  try {
    await handleResult(await requestKeyboard(), token);
  } catch (err) {
    await handleResult({ status: 'error', message: errorMessage(err) }, token);
  } finally {
    await finishConnection(token);
  }
}

/** Silently reopens an already-authorised keyboard. */
export function tryReconnect(): Promise<boolean> {
  if (session.peek() || !isWebHidSupported() || explicitConnection) return Promise.resolve(Boolean(session.peek()));
  if (reconnecting) return reconnecting;
  const token = beginConnection(false);
  const attempt: Promise<boolean> = Promise.resolve().then(async () => {
    try {
      const r = await reconnectKnown();
      return r ? await handleResult(r, token) : false;
    } catch (err) {
      await handleResult({ status: 'error', message: errorMessage(err) }, token);
      return false;
    } finally {
      if (reconnecting === attempt) reconnecting = null;
      await finishConnection(token);
    }
  });
  reconnecting = attempt;
  return attempt;
}

export async function startDemo(pid?: number): Promise<void> {
  const token = beginConnection(true);
  connState.value = 'connecting';
  connectNotice.value = null;
  try {
    await adopt(await openDemo(pid), token);
  } catch (err) {
    await handleResult({ status: 'error', message: errorMessage(err) }, token);
  } finally {
    await finishConnection(token);
  }
}

export async function disconnect(): Promise<void> {
  ++intent;
  explicitConnection = false;
  reconnecting = null;
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
  await releaseUnused();
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
  if (!Number.isInteger(profile) || profile < 0 || profile >= s.model.features.profiles) throw new Error('Invalid profile');
  await s.selectProfile(profile);
  if (session.peek() === s) activeProfile.value = profile;
}
