import { afterEach, expect, it, vi } from 'vitest';
import { watchLiveLighting } from './liveLighting';
import type { Rgb } from './color';

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); });

it('never overlaps slow reads and ignores an in-flight reply after cancellation', async () => {
  vi.useFakeTimers();
  let complete!: (frame: Rgb[]) => void;
  const read = vi.fn((_signal: AbortSignal) => new Promise<Rgb[]>(resolve => { complete = resolve; }));
  const onFrame = vi.fn(), onError = vi.fn();
  stop = watchLiveLighting({ read, onFrame, onError, canRead: () => true });
  await vi.advanceTimersByTimeAsync(5000);
  expect(read).toHaveBeenCalledTimes(1);
  complete([[1, 2, 3]]);
  await vi.advanceTimersByTimeAsync(299);
  expect(onFrame).toHaveBeenCalledWith([[1, 2, 3]]);
  expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(read).toHaveBeenCalledTimes(2);
  stop();
  expect(read.mock.calls[1][0].aborted).toBe(true);
  complete([[4, 5, 6]]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(onFrame).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});

it('yields to writes/profile transitions and supports a single still snapshot', async () => {
  vi.useFakeTimers();
  let busy = true;
  const read = vi.fn(async () => [[1, 2, 3]] as Rgb[]);
  stop = watchLiveLighting({ read, onFrame: vi.fn(), onError: vi.fn(), canRead: () => !busy, once: true });
  await vi.advanceTimersByTimeAsync(500);
  expect(read).not.toHaveBeenCalled();
  busy = false;
  await vi.advanceTimersByTimeAsync(100);
  expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(read).toHaveBeenCalledTimes(1);
});

it('stops after a failed read instead of filling the command queue with retries', async () => {
  vi.useFakeTimers();
  const failure = new Error('Unsupported');
  const read = vi.fn(async () => { throw failure; });
  const onError = vi.fn();
  stop = watchLiveLighting({ read, onError, onFrame: vi.fn(), canRead: () => true });
  await vi.advanceTimersByTimeAsync(10000);
  expect(read).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(failure);
});
