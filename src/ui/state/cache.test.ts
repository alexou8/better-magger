import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardSession, KeyAction } from '../../core/types';
import { getCached, invalidate, loadTable, pendingReads, setCached } from './cache';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const oldMap: KeyAction[] = [{ type: 0, code1: 4, code2: 0 }];
const freshMap: KeyAction[] = [{ type: 0, code1: 5, code2: 0 }];
afterEach(() => invalidate());

describe('table cache invalidation', () => {
  it('starts a fresh read after profile invalidation and ignores the old late reply', async () => {
    const old = deferred<KeyAction[]>();
    const fresh = deferred<KeyAction[]>();
    const readKeymap = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const s = { readKeymap } as unknown as KeyboardSession;
    const first = loadTable(s, 0, 'keymap');
    invalidate(0);
    const second = loadTable(s, 0, 'keymap');
    expect(readKeymap).toHaveBeenCalledTimes(2);
    fresh.resolve(freshMap); await second;
    old.resolve(oldMap); await first;
    expect(getCached(0, 'keymap')).toEqual(freshMap);
    expect(pendingReads.value).toBe(0);
  });

  it('does not overwrite a successful write with an earlier read', async () => {
    const old = deferred<KeyAction[]>();
    const s = { readKeymap: () => old.promise } as unknown as KeyboardSession;
    const first = loadTable(s, 0, 'keymap');
    setCached(0, 'keymap', freshMap);
    old.resolve(oldMap); await first;
    expect(getCached(0, 'keymap')).toEqual(freshMap);
  });

  it('leaves other profiles and shared reads intact', async () => {
    const read = deferred<KeyAction[]>();
    const readKeymap = vi.fn().mockReturnValue(read.promise);
    const s = { readKeymap } as unknown as KeyboardSession;
    const first = loadTable(s, 1, 'keymap');
    invalidate(0);
    const second = loadTable(s, 1, 'keymap');
    expect(second).toBe(first);
    read.resolve(freshMap); await first;
    expect(getCached(1, 'keymap')).toEqual(freshMap);
  });

  it('ignores errors from reads invalidated before completion', async () => {
    const old = deferred<KeyAction[]>();
    const s = { readKeymap: vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(freshMap) } as unknown as KeyboardSession;
    const first = loadTable(s, 0, 'keymap');
    invalidate(0);
    await loadTable(s, 0, 'keymap');
    old.reject(new Error('old session lost'));
    await expect(first).rejects.toThrow('old session lost');
    expect(getCached(0, 'keymap')).toEqual(freshMap);
  });
});
