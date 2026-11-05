/** Device discovery, interface selection and session creation (real WebHID and demo). */
import { getLayoutDef } from '../data/layouts';
import { ALL_MODELS, VENDOR_ID, findModel, findModelByBootPid, type ModelRecord } from '../data/models';
import { HidTransport } from '../hid/transport';
import { MockHidDevice } from './mock';
import { openSession } from './session';
import type { ConnectResult, DeviceModel, KeyboardSession } from './types';

const LAST_DEVICE_KEY = 'better-magger.lastDevice';
const DEMO_DEFAULT_PID = 0xfc67; // Magger68 Plus
const CONFIG_COLLECTIONS = [
  { usagePage: 0x0001, usage: 0x0000 },
  { usagePage: 0xff00, usage: 0x0001 },
];

/** Sessions by HIDDevice, so re-connecting the same device first releases the old session. */
const sessions = new Map<HIDDevice, KeyboardSession>();
/** Opens in progress, so concurrent connects (picker + auto-reconnect) share one transport. */
const opening = new Map<HIDDevice, Promise<KeyboardSession>>();

/** device.open() was refused: almost always another tab or app holds the keyboard. */
class DeviceBusyError extends Error {}

const BUSY_MESSAGE =
  'The keyboard is in use by another tab or app. Close other Better Magger tabs, the official LUMINKEY web driver ' +
  'and the LUMINKEY desktop driver, then try again.';

export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator && !!navigator.hid;
}

/** All known models, Magger models first. */
export function supportedModels(): DeviceModel[] {
  return [...ALL_MODELS];
}

const knownPids = new Set(ALL_MODELS.flatMap((m) => [m.pid, ...m.altPids, m.bootPid]).filter((p) => p > 0));
const isKnown = (d: HIDDevice) => d.vendorId === VENDOR_ID && knownPids.has(d.productId);

/** Shows the browser's device picker (needs a user gesture). */
export async function requestKeyboard(): Promise<ConnectResult> {
  if (!isWebHidSupported()) return { status: 'error', message: 'This browser does not support WebHID. Use Chrome, Edge or Opera on desktop.' };
  let devices: HIDDevice[];
  try {
    const filters = [...knownPids].map((productId) => ({ vendorId: VENDOR_ID, productId }));
    devices = await navigator.hid.requestDevice({ filters });
  } catch (e) {
    return { status: 'error', message: `Could not open the device picker: ${errorText(e)}` };
  }
  const known = devices.filter(isKnown);
  if (known.length === 0) {
    return devices.length === 0
      ? { status: 'cancelled' }
      : { status: 'unsupported', productName: devices[0].productName, pid: devices[0].productId };
  }
  return connectTo(sameProduct(known, known[0]));
}

/** Silently reopens an already-authorised keyboard (the last used one if present); null if none. */
export async function reconnectKnown(): Promise<ConnectResult | null> {
  if (!isWebHidSupported()) return null;
  let devices: HIDDevice[];
  try {
    devices = await navigator.hid.getDevices();
  } catch (e) {
    console.debug('navigator.hid.getDevices() failed', e);
    return null;
  }
  const known = devices.filter(isKnown);
  if (known.length === 0) return null;
  const last = loadLastDevice();
  const preferred =
    known.find((d) => d.productId === last?.pid && d.productName === last.productName) ??
    known.find((d) => !findModelByBootPid(d.productId)) ??
    known[0];
  const interfaces = sameProduct(known, preferred);
  // Mid re-enumeration (e.g. after a polling-rate change) only some interfaces may be back yet.
  if (!interfaces.some(hasConfigInterface)) return null;
  return connectTo(interfaces);
}

/** Fires when a LUMINKEY device is plugged in (for auto-reconnect). */
export function onDeviceAttached(cb: () => void): () => void {
  if (!isWebHidSupported()) return () => undefined;
  const handler = (e: HIDConnectionEvent) => {
    if (isKnown(e.device)) cb();
  };
  navigator.hid.addEventListener('connect', handler);
  return () => navigator.hid.removeEventListener('connect', handler);
}

/** A fully simulated keyboard (default Magger68 Plus). */
export async function openDemo(pid = DEMO_DEFAULT_PID): Promise<KeyboardSession> {
  const model = findModel(pid) ?? findModel(DEMO_DEFAULT_PID)!;
  const layout = getLayoutDef(model.layoutId);
  const device = new MockHidDevice(model, layout);
  const transport = new HidTransport(device.asHidDevice(), { hid: null });
  await transport.open();
  return openSession({ transport, model, layout, productName: device.productName, isDemo: true });
}

// ------------------------------------------------------------------ internals

function sameProduct(devices: HIDDevice[], like: HIDDevice): HIDDevice[] {
  return devices.filter((d) => d.productId === like.productId && d.productName === like.productName);
}

async function connectTo(interfaces: HIDDevice[]): Promise<ConnectResult> {
  const device = pickInterface(interfaces);
  const boot = findModelByBootPid(device.productId);
  if (boot) return { status: 'bootloader', modelName: boot.name };
  const model = findModel(device.productId, device.productName);
  if (!model) return { status: 'unsupported', productName: device.productName, pid: device.productId };
  if (!hasConfigInterface(device)) {
    return { status: 'error', message: `${model.name} did not expose its configuration interface. Unplug it, plug it back in and try again.` };
  }
  try {
    const session = await openDeviceOnce(device, model);
    saveLastDevice(device);
    return { status: 'connected', session };
  } catch (e) {
    if (e instanceof DeviceBusyError) return { status: 'error', message: e.message };
    return { status: 'error', message: `Could not talk to ${model.name}: ${errorText(e)}` };
  }
}

function openDeviceOnce(device: HIDDevice, model: ModelRecord): Promise<KeyboardSession> {
  const inFlight = opening.get(device);
  if (inFlight) return inFlight;
  const promise = openDevice(device, model).finally(() => opening.delete(device));
  opening.set(device, promise);
  return promise;
}

async function openDevice(device: HIDDevice, model: ModelRecord): Promise<KeyboardSession> {
  await sessions.get(device)?.close();
  sessions.delete(device);
  const transport = new HidTransport(device);
  try {
    try {
      await transport.open();
    } catch (e) {
      throw isBusyError(e) ? new DeviceBusyError(BUSY_MESSAGE) : e;
    }
    const layout = getLayoutDef(model.layoutId);
    const session = await openSession({ transport, model, layout, productName: device.productName, isDemo: false });
    sessions.set(device, session);
    session.on((e) => {
      if (e.kind === 'disconnected') sessions.delete(device);
    });
    return session;
  } catch (e) {
    await transport.close();
    throw e;
  }
}

/** NotAllowedError ("Failed to open the device") / InvalidStateError from HIDDevice.open(). */
function isBusyError(e: unknown): boolean {
  const name = (e as { name?: unknown } | null)?.name;
  return name === 'NotAllowedError' || name === 'InvalidStateError' || /failed to open/i.test(errorText(e));
}

function outputReportBytes(c: HIDCollectionInfo): number {
  const sizes = (c.outputReports ?? []).map((r) => (r.items ?? []).reduce((n, i) => n + (i.reportSize ?? 0) * (i.reportCount ?? 0), 0) / 8);
  return Math.max(0, ...sizes);
}

/**
 * The config interface: a top-level collection (0x0001/0x0000 or 0xFF00/0x0001) with a 64-byte
 * output report. The official app just took `[0]` (PROTOCOL.md §7.13).
 */
export function pickInterface(interfaces: HIDDevice[]): HIDDevice {
  return interfaces.reduce((best, d) => (interfaceScore(d) > interfaceScore(best) ? d : best), interfaces[0]);
}

function interfaceScore(d: HIDDevice): number {
  return Math.max(
    0,
    ...d.collections.map((c) => {
      const usageMatch = CONFIG_COLLECTIONS.some((u) => u.usagePage === c.usagePage && u.usage === c.usage);
      return (usageMatch ? 1 : 0) + (outputReportBytes(c) === 64 ? 2 : 0);
    }),
  );
}

/**
 * False for an interface that only has other collections (e.g. the protected boot keyboard),
 * which WebHID will not let us talk to. Devices that list no collections get the benefit of the doubt.
 */
export function hasConfigInterface(d: HIDDevice): boolean {
  return d.collections.length === 0 || interfaceScore(d) > 0;
}

function loadLastDevice(): { pid: number; productName: string } | null {
  try {
    const raw = localStorage.getItem(LAST_DEVICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastDevice(d: HIDDevice): void {
  try {
    localStorage.setItem(LAST_DEVICE_KEY, JSON.stringify({ pid: d.productId, productName: d.productName }));
  } catch {
    // storage unavailable (private mode); auto-reconnect just picks the first known device
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
