import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeFrame } from '../core/protocol';
import { HidTransport, type TransportEvent } from './transport';

/** A scripted HIDDevice: `onSend` decides what (and when) to answer. */
class ScriptedDevice extends EventTarget {
  opened = false;
  sent: Uint8Array[] = [];
  constructor(private readonly onSend: (frame: Uint8Array, n: number, dev: ScriptedDevice) => void) {
    super();
  }
  async open() {
    this.opened = true;
  }
  async close() {
    this.opened = false;
  }
  async sendReport(_id: number, data: Uint8Array) {
    this.sent.push(data.slice());
    this.onSend(data, this.sent.length, this);
  }
  input(bytes: number[], delay = 1) {
    const r = Uint8Array.from({ length: 64 }, (_, i) => bytes[i] ?? 0);
    setTimeout(() => this.dispatchEvent(Object.assign(new Event('inputreport'), { data: new DataView(r.buffer) })), delay);
  }
}

/** Echo-style reply carrying a marker byte at [8]. */
const reply = (frame: Uint8Array, marker: number) => [0xaa, ...frame.subarray(1, 8), marker];

function setup(onSend: (frame: Uint8Array, n: number, dev: ScriptedDevice) => void, timeoutMs = 30) {
  const device = new ScriptedDevice(onSend);
  const hid = new EventTarget();
  const transport = new HidTransport(device as unknown as HIDDevice, { timeoutMs, hid });
  const events: TransportEvent[] = [];
  transport.onEvent((e) => events.push(e));
  return { device, hid, transport, events };
}

afterEach(() => vi.restoreAllMocks());

describe('HidTransport', () => {
  it('opens the device once and tolerates an already opened device', async () => {
    const { device, transport } = setup(() => undefined);
    device.opened = true;
    const open = vi.spyOn(device, 'open');
    await transport.open();
    expect(open).not.toHaveBeenCalled();
    expect(transport.isOpen).toBe(true);
  });

  it('retries once after a timeout', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const { device, transport } = setup((f, n, dev) => {
      if (n === 2) dev.input(reply(f, 7));
    });
    await transport.open();
    const r = await transport.request(encodeFrame(0x05, 0, 56));
    expect(r[8]).toBe(7);
    expect(device.sent.length).toBe(2);
  });

  it('rejects with a descriptive error when the keyboard never answers', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const { device, transport } = setup(() => undefined);
    await transport.open();
    await expect(transport.request(encodeFrame(0xa0, 1024, 56))).rejects.toThrow(/did not answer command 0xA0 \(offset 1024\) after 2/);
    expect(device.sent.length).toBe(2);
    // the queue keeps working afterwards
    await expect(transport.request(encodeFrame(0x04, 0, 32), { replyOptional: true, retries: 0 })).resolves.toBeNull();
  });

  it('routes an unsolicited report received during a read to events', async () => {
    const { transport, events } = setup((f, _n, dev) => {
      dev.input([0xa1, 0, 2]);
      dev.input(reply(f, 9), 2);
    });
    await transport.open();
    const r = await transport.request(encodeFrame(0x08, 0, 56));
    expect(r[8]).toBe(9);
    expect(events).toEqual([{ kind: 'profile', report: expect.any(Uint8Array) }]);
    expect((events[0] as { report: Uint8Array }).report[2]).toBe(2);
  });

  it('serialises concurrent requests in order', async () => {
    const { device, transport } = setup((f, n, dev) => dev.input(reply(f, n), 5 - n));
    await transport.open();
    const results = await Promise.all([1, 2, 3].map((i) => transport.request(encodeFrame(0x08, 56 * i, 56))));
    expect(results.map((r) => r[8])).toEqual([1, 2, 3]);
    expect(device.sent.map((f) => f[5])).toEqual([56, 112, 168]);
  });

  it('drops a late reply to a timed-out request instead of taking it as the next reply', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    // 1st send: answered twice, late (after timeout 100 + retry). 3rd send: answered after the stray.
    const { transport } = setup((f, n, dev) => {
      if (n === 1) {
        dev.input(reply(f, 0xee), 120);
        dev.input(reply(f, 0xee), 160);
      }
      if (n === 3) dev.input(reply(f, 0x33), 60);
    }, 100);
    await transport.open();
    const first = await transport.request(encodeFrame(0x08, 0, 56));
    expect(first[8]).toBe(0xee);
    const second = await transport.request(encodeFrame(0x08, 56, 56));
    expect(second[8]).toBe(0x33);
  });

  it('rejects the pending request and reports disconnection', async () => {
    const { device, hid, transport, events } = setup(() => undefined, 1000);
    await transport.open();
    const pending = transport.request(encodeFrame(0x05, 0, 56));
    hid.dispatchEvent(Object.assign(new Event('disconnect'), { device }));
    await expect(pending).rejects.toThrow(/disconnected/);
    expect(events).toEqual([{ kind: 'disconnected' }]);
    await expect(transport.request(encodeFrame(0x05, 0, 56))).rejects.toThrow(/disconnected/);
    device.input([0xa1, 0, 1], 0);
    await new Promise((r) => setTimeout(r, 10));
    expect(events.length).toBe(1); // input listener removed
  });

  it('ignores disconnect events of other devices', async () => {
    const { hid, transport, events } = setup(() => undefined);
    await transport.open();
    hid.dispatchEvent(Object.assign(new Event('disconnect'), { device: {} }));
    expect(events).toEqual([]);
    expect(transport.isOpen).toBe(true);
  });
});
