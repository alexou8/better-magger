/**
 * One HIDDevice, one serial command queue. Each request waits for its own reply; unsolicited
 * reports (travel, profile/OS/lighting changes, dongle link) are routed to event listeners and
 * never mistaken for replies (fixes PROTOCOL.md §7.1/§7.2).
 */
import { classifyReport, type InputKind } from '../core/protocol';

export const DEFAULT_TIMEOUT_MS = 1500;
const STALE_TTL_MS = 3000;

export type TransportEvent =
  | { kind: Exclude<InputKind, 'reply'>; report: Uint8Array }
  | { kind: 'disconnected' };

export interface RequestOptions {
  timeoutMs?: number;
  /** Extra attempts after a timeout (default 1). */
  retries?: number;
  /** Resolve with null instead of rejecting when no reply arrives (commands that may not answer). */
  replyOptional?: boolean;
}

export interface TransportOptions {
  timeoutMs?: number;
  /** Source of 'disconnect' events; defaults to navigator.hid. */
  hid?: EventTarget | null;
}

interface Pending {
  signature: string;
  cmd: number;
  resolve(reply: Uint8Array): void;
  reject(error: Error): void;
}

const hex = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');
const signatureOf = (r: Uint8Array) => `${r[1]}:${r[5]}:${r[6]}`;

function describe(frame: Uint8Array): string {
  return `command ${hex(frame[1])} (offset ${frame[5] | (frame[6] << 8)})`;
}

export class HidTransport {
  private queue: Promise<unknown> = Promise.resolve();
  private pending: Pending | null = null;
  private readonly listeners = new Set<(e: TransportEvent) => void>();
  /** Signatures (cmd/offset) of attempts that timed out; a late reply to them is dropped. */
  private stale = new Map<string, number>();
  private state: 'idle' | 'open' | 'closed' = 'idle';
  private closedReason = new Error('Keyboard is not connected');
  private readonly hid: EventTarget | null;
  private readonly timeoutMs: number;

  constructor(
    readonly device: HIDDevice,
    options: TransportOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.hid = options.hid !== undefined ? options.hid : (globalThis.navigator?.hid ?? null);
  }

  get isOpen(): boolean {
    return this.state === 'open';
  }

  async open(): Promise<void> {
    if (this.state === 'open') return;
    if (this.state === 'closed') throw new Error('Transport already closed');
    if (!this.device.opened) await this.device.open();
    this.device.addEventListener('inputreport', this.onInputReport);
    this.hid?.addEventListener('disconnect', this.onHidDisconnect);
    this.state = 'open';
  }

  async close(): Promise<void> {
    if (this.state === 'closed') return;
    this.shutdown(new Error('Connection closed'));
    try {
      if (this.device.opened) await this.device.close();
    } catch (e) {
      console.debug('HID close failed', e);
    }
  }

  onEvent(listener: (e: TransportEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Queues one 64-byte frame and resolves with its reply. */
  request(frame: Uint8Array<ArrayBuffer>, options: RequestOptions & { replyOptional: true }): Promise<Uint8Array | null>;
  request(frame: Uint8Array<ArrayBuffer>, options?: RequestOptions): Promise<Uint8Array>;
  request(frame: Uint8Array<ArrayBuffer>, options: RequestOptions = {}): Promise<Uint8Array | null> {
    const run = () => this.exchange(frame, options);
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async exchange(frame: Uint8Array<ArrayBuffer>, o: RequestOptions): Promise<Uint8Array | null> {
    const attempts = 1 + (o.retries ?? 1);
    for (let i = 0; i < attempts; i++) {
      if (this.state !== 'open') throw this.closedReason;
      const reply = await this.attempt(frame, o.timeoutMs ?? this.timeoutMs);
      if (reply) return reply;
      this.stale.set(signatureOf(frame), Date.now() + STALE_TTL_MS);
      if (i + 1 < attempts) console.debug(`No reply to ${describe(frame)}, retrying`);
    }
    if (o.replyOptional) return null;
    throw new Error(`The keyboard did not answer ${describe(frame)} after ${attempts} attempt(s)`);
  }

  private attempt(frame: Uint8Array<ArrayBuffer>, timeoutMs: number): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        if (this.pending === pending) this.pending = null;
      };
      const pending: Pending = {
        signature: signatureOf(frame),
        cmd: frame[1],
        resolve: (r) => (done(), resolve(r)),
        reject: (e) => (done(), reject(e)),
      };
      const timer = setTimeout(() => (done(), resolve(null)), timeoutMs);
      this.pending = pending; // before sending: the reply may arrive before sendReport settles
      this.device.sendReport(0, frame).catch((e: unknown) => {
        if (this.pending === pending) pending.reject(new Error(`Failed to send ${describe(frame)}: ${errorText(e)}`));
      });
    });
  }

  private readonly onInputReport = (e: HIDInputReportEvent): void => {
    const report = new Uint8Array(e.data.buffer.slice(e.data.byteOffset, e.data.byteOffset + e.data.byteLength));
    const kind = classifyReport(report);
    if (kind !== 'reply') this.emit({ kind, report });
    else this.handleReply(report);
  };

  private handleReply(report: Uint8Array): void {
    const pending = this.pending;
    if (!pending) {
      console.debug('Dropped input report with no request pending', report.slice(0, 8));
      return;
    }
    const signature = signatureOf(report);
    if (signature !== pending.signature && this.isStale(signature)) {
      console.debug('Dropped late reply to an earlier timed-out request', report.slice(0, 8));
      return;
    }
    // Replies are assumed to echo the command in byte 1 (UNVERIFIED); accept regardless.
    if (report[1] !== pending.cmd) console.debug(`Reply byte1 ${hex(report[1])} does not echo command ${hex(pending.cmd)}`);
    pending.resolve(report);
  }

  private isStale(signature: string): boolean {
    const now = Date.now();
    for (const [sig, until] of this.stale) if (until < now) this.stale.delete(sig);
    return this.stale.has(signature);
  }

  private readonly onHidDisconnect = (e: Event): void => {
    if ((e as HIDConnectionEvent).device !== this.device || this.state !== 'open') return;
    this.shutdown(new Error('Keyboard disconnected'));
    this.emit({ kind: 'disconnected' });
  };

  private shutdown(reason: Error): void {
    this.state = 'closed';
    this.closedReason = reason;
    this.device.removeEventListener('inputreport', this.onInputReport);
    this.hid?.removeEventListener('disconnect', this.onHidDisconnect);
    this.pending?.reject(reason);
  }

  private emit(e: TransportEvent): void {
    for (const l of [...this.listeners]) {
      try {
        l(e);
      } catch (err) {
        console.error('Transport listener failed', err);
      }
    }
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
