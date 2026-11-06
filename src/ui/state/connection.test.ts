import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardSession, SessionEvent } from '../../core/types';
import { findModel } from '../../data/models';

const core = vi.hoisted(() => ({
  isWebHidSupported: vi.fn(() => true),
  onDeviceAttached: vi.fn(() => () => undefined),
  openDemo: vi.fn(), reconnectKnown: vi.fn(), requestKeyboard: vi.fn(),
}));
vi.mock('../../core/connect', () => core);
import { connectKeyboard, disconnect, startDemo, switchProfile, tryReconnect } from './connection';
import { activeProfile, connectNotice, connState, session } from './session';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function keyboard(isDemo = false) {
  const listeners = new Set<(e: SessionEvent) => void>();
  const s = {
    model: findModel(0xfc67)!, isDemo,
    getActiveProfile: vi.fn(async () => 2),
    getFirmware: vi.fn(async () => ({ version: 107, display: '1.07', updateAvailable: false })),
    close: vi.fn(async () => undefined),
    selectProfile: vi.fn(async (_profile: number) => undefined),
    on: vi.fn((listener: (e: SessionEvent) => void) => { listeners.add(listener); return () => listeners.delete(listener); }),
  } as unknown as KeyboardSession;
  return { s, emit: (event: SessionEvent) => listeners.forEach((f) => f(event)), listeners };
}

beforeEach(async () => {
  vi.useFakeTimers();
  await disconnect();
  vi.clearAllMocks();
  core.isWebHidSupported.mockReturnValue(true);
  core.reconnectKnown.mockResolvedValue(null);
});
afterEach(async () => { await disconnect(); vi.clearAllTimers(); vi.useRealTimers(); });

describe('connection intent and ownership', () => {
  it('discards and closes a reconnect result arriving after Disconnect', async () => {
    const pending = deferred<{ status: 'connected'; session: KeyboardSession }>();
    const { s } = keyboard();
    core.reconnectKnown.mockReturnValue(pending.promise);
    const opening = tryReconnect();
    await Promise.resolve();
    await disconnect();
    pending.resolve({ status: 'connected', session: s });
    expect(await opening).toBe(false);
    expect(session.peek()).toBeNull();
    expect(connState.peek()).toBe('idle');
    expect(s.close).toHaveBeenCalledOnce();
  });

  it('keeps a newly selected demo when an older real reconnect finishes', async () => {
    const pending = deferred<{ status: 'connected'; session: KeyboardSession }>();
    const real = keyboard().s, demo = keyboard(true).s;
    core.reconnectKnown.mockReturnValue(pending.promise);
    core.openDemo.mockResolvedValue(demo);
    const reconnect = tryReconnect();
    await Promise.resolve();
    await startDemo();
    pending.resolve({ status: 'connected', session: real });
    await reconnect;
    expect(session.peek()).toBe(demo);
    expect(real.close).toHaveBeenCalledOnce();
    expect(demo.close).not.toHaveBeenCalled();
  });

  it('cannot resurrect a session after Disconnect during the active-profile read', async () => {
    const profile = deferred<number>();
    const { s, listeners } = keyboard();
    vi.mocked(s.getActiveProfile).mockReturnValue(profile.promise);
    core.requestKeyboard.mockResolvedValue({ status: 'connected', session: s });
    const connecting = connectKeyboard();
    await Promise.resolve();
    await disconnect();
    profile.resolve(2);
    await connecting;
    expect(session.peek()).toBeNull();
    expect(listeners.size).toBe(0);
    expect(s.close).toHaveBeenCalledOnce();
  });

  it('does not adopt a keyboard disconnected during its initial profile read', async () => {
    const profile = deferred<number>();
    const { s, emit, listeners } = keyboard();
    vi.mocked(s.getActiveProfile).mockReturnValue(profile.promise);
    core.openDemo.mockResolvedValue(s);
    const connecting = startDemo();
    await Promise.resolve();
    emit({ kind: 'disconnected' });
    profile.resolve(1);
    await connecting;
    expect(session.peek()).toBeNull();
    expect(connectNotice.peek()?.body).toMatch(/disconnected while connecting/);
    expect(listeners.size).toBe(0);
    expect(s.close).toHaveBeenCalledOnce();
  });

  it('surfaces a failed profile read instead of silently exposing profile zero', async () => {
    const { s } = keyboard();
    vi.mocked(s.getActiveProfile).mockRejectedValue(new Error('Profile read failed'));
    core.openDemo.mockResolvedValue(s);
    await startDemo();
    expect(session.peek()).toBeNull();
    expect(connectNotice.peek()?.body).toBe('Profile read failed');
    expect(s.close).toHaveBeenCalledOnce();
  });

  it('releases the previous session after adopting a replacement', async () => {
    const first = keyboard(true).s, second = keyboard(true).s;
    core.openDemo.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await startDemo();
    await startDemo();
    expect(session.peek()).toBe(second);
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).not.toHaveBeenCalled();
  });

  it('does not update a replacement session when an old profile switch finishes', async () => {
    const first = keyboard(true).s, second = keyboard(true).s;
    const selecting = deferred<void>();
    vi.mocked(first.selectProfile).mockReturnValue(selecting.promise);
    core.openDemo.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await startDemo();
    const changing = switchProfile(1);
    await startDemo();
    selecting.resolve();
    await changing;
    expect(activeProfile.peek()).toBe(2);
  });

  it('keeps all scheduled replug retries until one reconnect succeeds', async () => {
    const first = keyboard().s, replacement = keyboard().s;
    const listeners = new Set<(event: SessionEvent) => void>();
    vi.mocked(first.on).mockImplementation((listener) => { listeners.add(listener); return () => listeners.delete(listener); });
    core.requestKeyboard.mockResolvedValue({ status: 'connected', session: first });
    await connectKeyboard();
    listeners.forEach((listener) => listener({ kind: 'disconnected' }));
    core.reconnectKnown.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 'connected', session: replacement });
    await vi.advanceTimersByTimeAsync(1000);
    expect(core.reconnectKnown).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(core.reconnectKnown).toHaveBeenCalledTimes(2);
    expect(session.peek()).toBe(replacement);
    await vi.advanceTimersByTimeAsync(3000);
    expect(core.reconnectKnown).toHaveBeenCalledTimes(2);
  });

  it('does not close a shared session claimed by the newest connect', async () => {
    const pending = deferred<{ status: 'connected'; session: KeyboardSession }>();
    const shared = keyboard().s;
    core.reconnectKnown.mockReturnValue(pending.promise);
    core.requestKeyboard.mockReturnValue(pending.promise);
    const reconnect = tryReconnect();
    await Promise.resolve();
    const picking = connectKeyboard();
    pending.resolve({ status: 'connected', session: shared });
    await Promise.all([reconnect, picking]);
    expect(session.peek()).toBe(shared);
    expect(shared.close).not.toHaveBeenCalled();
  });

});
