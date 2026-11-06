import { describe, expect, it } from 'vitest';
import { encodeMacros } from '../../core/protocol';
import type { MacroStep } from '../../core/types';
import { MACRO_STEP_CAPACITY } from './macro';

describe('macro capacity', () => {
  it('offers exactly the number of steps that the device encoder can hold', () => {
    const step: MacroStep = { kind: 'key', code: 4, pressed: true, delayMs: 0 };
    expect(() => encodeMacros([{ steps: Array.from({ length: MACRO_STEP_CAPACITY }, () => step) }])).not.toThrow();
    expect(() => encodeMacros([{ steps: Array.from({ length: MACRO_STEP_CAPACITY + 1 }, () => step) }])).toThrow(/2 KB/);
  });
});
