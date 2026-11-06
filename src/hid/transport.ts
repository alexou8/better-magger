/**
 * One HIDDevice, one serial command queue. Known unsolicited reports are routed to events.
 * Request header matching is enabled per command after its replies demonstrate echoed headers;
 * non-echoing firmware retains serial reply handling (PROTOCOL.md §8).
 */
import { classifyReport, type InputKind } from '../core/protocol';

export const DEFAULT_TIMEOUT_MS = 1500;
const STALE_TTL_MS = 3000;
/** Header bytes every reply carries before its payload (PROTOCOL.md §1.3). */
const REPLY_HEADER_SIZE = 8;

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
  offset: number;
  resolve(reply: Uint8Array): void;
  reject(error: Error): void;
}

const hex = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');
const signatureOf = (r: Uint8Array) => `${r[1]}:${r[5]}:${r[6]}`;
const offsetOf = (r: Uint8Array) => r[5] | (r[6] << 8);

function describe(frame: Uint8Array): string {
  return `command ${hex(frame[1])} (offset ${frame[5] | (frame[6] << 8)})`;
}

export class HidTransport {
  private queue: Promise<unknown> = Promise.resolve();
  private pending: Pending | null = null;
  private readonly listeners = new Set<(e: TransportEvent) => void>();
  /** Recent cmd/offset signatures, including completed requests that might reply twice. */
  private stale = new Map<string, number>();
  /** Learn per command: read payloads and write acknowledgements may use different headers. */
  private replyModes = new Map<number, { command: boolean; offset: boolean }>();
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
      if (reply) {
        this.stale.set(signatureOf(frame), Date.now() + STALE_TTL_MS);
        return reply;
      }
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
        offset: offsetOf(frame),
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
    if (report.length < REPLY_HEADER_SIZE) {
      // Cannot carry a reply header; let the request time out and retry instead of failing it.
      console.debug(`Dropped ${report.length}-byte input report`);
      return;
    }
    const pending = this.pending;
    if (!pending) {
      console.debug('Dropped input report with no request pending', report.slice(0, 8));
      return;
    }
    const signature = signatureOf(report);
    const matches = signature === pending.signature;
    const mode = this.replyModes.get(pending.cmd);
    const commandMatches = report[1] === pending.cmd;
    // A zero offset can be a fixed legacy header. It proves nothing about offset echoes.
    // Only a matching nonzero offset enables offset matching for this command.
    const knownOtherCommand = !commandMatches && this.replyModes.get(report[1])?.command && this.isStale(signature);
    if ((mode?.command && !commandMatches) || (mode?.offset && !matches) || knownOtherCommand) {
      console.debug('Dropped reply that does not match the pending request', report.slice(0, 8));
      return;
    }
    if (!mode) {
      this.replyModes.set(pending.cmd, { command: commandMatches, offset: matches && pending.offset !== 0 });
      if (!commandMatches) console.debug(`Command ${hex(pending.cmd)} does not echo request headers; using serial legacy reply handling`);
    } else if (mode.command && matches && pending.offset !== 0) {
      mode.offset = true;
    }
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
