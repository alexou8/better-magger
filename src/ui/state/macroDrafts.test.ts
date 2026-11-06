import { describe, expect, it } from 'vitest';
import type { KeyboardSession, MacroStep } from '../../core/types';
import { hasMacroDrafts, macroDrafts } from './macroDrafts';

describe('macro drafts', () => {
  it('preserves each macro draft across page/profile remounts within its session', () => {
    const s = {} as KeyboardSession;
    const steps: MacroStep[] = [{ kind: 'key', code: 4, pressed: true, delayMs: 10 }];
    const p0 = macroDrafts(s, 0);
    p0.current.value = 3;
    p0.steps.value = new Map([[3, steps]]);
    macroDrafts(s, 1).steps.value = new Map([[0, []]]);
    expect(macroDrafts(s, 0).current.value).toBe(3);
    expect(macroDrafts(s, 0).steps.value.get(3)).toEqual(steps);
    expect(macroDrafts(s, 1).steps.value.get(0)).toEqual([]);
    expect(hasMacroDrafts(s)).toBe(true);
  });

  it('isolates sessions and clears the unsaved indicator after saving/discarding', () => {
    const s = {} as KeyboardSession, other = {} as KeyboardSession;
    const drafts = macroDrafts(s, 0);
    drafts.steps.value = new Map([[1, []]]);
    expect(hasMacroDrafts(other)).toBe(false);
    expect(hasMacroDrafts(null)).toBe(false);
    drafts.steps.value = new Map();
    expect(hasMacroDrafts(s)).toBe(false);
  });
});
