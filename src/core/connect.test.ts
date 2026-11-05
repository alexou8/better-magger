import { describe, expect, it } from 'vitest';
import { findModel, findModelByBootPid } from '../data/models';
import { openDemo, pickInterface, supportedModels } from './connect';

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
