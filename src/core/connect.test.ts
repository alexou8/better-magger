import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLayoutDef } from '../data/layouts';
import { findModel, findModelByBootPid } from '../data/models';
import { openDemo, pickInterface, reconnectKnown, requestKeyboard, supportedModels } from './connect';
import { MockHidDevice } from './mock';

const iface = (name: string, usagePage: number, usage: number, outputBits: number) =>
  ({
    productName: name,
    collections: [
      {
        usagePage,
        usage,
        outputReports: outputBits ? [{ reportId: 0, items: [{ reportSize: 8, reportCount: outputBits / 8 }] }] : [],
      },
    ],
  }) as unknown as HIDDevice;

describe('pickInterface', () => {
  it('prefers the config collection with a 64-byte output report', () => {
    const keyboard = iface('kbd', 0x0001, 0x0006, 8);
    const vendor = iface('vendor', 0xff00, 0x0001, 512);
    const generic = iface('generic', 0x0001, 0x0000, 0);
    expect(pickInterface([keyboard, generic, vendor]).productName).toBe('vendor');
    expect(pickInterface([keyboard, generic]).productName).toBe('generic');
    expect(pickInterface([keyboard]).productName).toBe('kbd');
  });
});

describe('models', () => {
  it('lists Magger models first with friendly names', () => {
    const names = supportedModels().slice(0, 5).map((m) => m.name);
    expect(names).toEqual(['Magger68', 'Magger68 Pro', 'Magger68 Plus', 'Magger68 Ultra', 'Magger68 Ultra JIS']);
    expect(findModelByBootPid(0xff87)?.name).toBe('Magger68 Plus');
    expect(findModel(0xfe24)?.features.travel.rawPerMm).toBe(50);
    expect(findModel(0xfb49)?.features.profiles).toBe(4);
    expect(findModel(0x3250, 'LK98-V2 UK 2.4G')?.type).toBe(124);
  });

  it('opens a demo session', async () => {
    const session = await openDemo();
    expect(session.isDemo).toBe(true);
    expect(session.model.name).toBe('Magger68 Plus');
    expect((await session.readSettings(0)).lighting.brightness).toBe(80);
    await session.close();
  });
});

describe('connecting real devices', () => {
  const stubHid = (devices: () => Promise<HIDDevice[]>) => {
    const hid = Object.assign(new EventTarget(), { getDevices: devices, requestDevice: devices });
    vi.stubGlobal('navigator', { hid });
  };
  const plus = findModel(0xfc67)!;
  const configCollection = { usagePage: 0x0001, usage: 0x0000, outputReports: [{ items: [{ reportSize: 8, reportCount: 64 }] }] };

  afterEach(() => vi.unstubAllGlobals());

  it('explains a refused open() (keyboard held by another tab or app)', async () => {
    const busy = {
      vendorId: 0x19f5,
      productId: plus.pid,
      productName: 'Magger68 Plus',
      opened: false,
      collections: [configCollection],
      open: () => Promise.reject(new DOMException('Failed to open the device.', 'NotAllowedError')),
      close: () => Promise.resolve(),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as HIDDevice;
    stubHid(async () => [busy]);
    const r = await requestKeyboard();
    expect(r.status).toBe('error');
    expect(r.status === 'error' && r.message).toMatch(/in use by another tab or app/);
  });

  it('shares one session between concurrent connects to the same keyboard', async () => {
    const device = new MockHidDevice(plus, getLayoutDef(plus.layoutId), { latencyMs: [0, 1], productName: 'Magger68 Plus' });
    const open = vi.spyOn(device, 'open');
    stubHid(async () => [device.asHidDevice()]);
    const [a, b] = await Promise.all([reconnectKnown(), requestKeyboard()]);
    expect(a?.status).toBe('connected');
    expect(b.status).toBe('connected');
    if (a?.status !== 'connected' || b.status !== 'connected') return;
    expect(a.session).toBe(b.session);
    expect(open).toHaveBeenCalledTimes(1);
    await a.session.close();
  });

  it('waits for the config interface while the keyboard re-enumerates', async () => {
    const bootKeyboard = {
      vendorId: 0x19f5,
      productId: plus.pid,
      productName: 'Magger68 Plus',
      collections: [{ usagePage: 0x0001, usage: 0x0006, outputReports: [{ items: [{ reportSize: 1, reportCount: 8 }] }] }],
    } as unknown as HIDDevice;
    stubHid(async () => [bootKeyboard]);
    expect(await reconnectKnown()).toBeNull();
  });

  it('treats a failing getDevices() as nothing to reconnect', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    stubHid(() => Promise.reject(new DOMException('blocked', 'SecurityError')));
    expect(await reconnectKnown()).toBeNull();
  });
});
