import { describe, expect, it } from 'vitest';
import { maskToRow, rowToMask, type DksRow } from './dks';

describe('DKS mask encoding', () => {
  it('matches the official normalisation for a full-length hold', () => {
    // UI state downStart==4 -> fields (3,3,2): thermometer 7 | 7<<3 | 3<<6
    expect(rowToMask(['hold', 'hold', 'hold', 'hold'])).toBe(7 | (7 << 3) | (3 << 6));
  });

  it('round-trips typical rows', () => {
    const rows: DksRow[] = [
      ['tap', 'off', 'off', 'off'],
      ['off', 'off', 'off', 'tap'],
      ['hold', 'hold', 'off', 'off'],
      ['off', 'hold', 'hold', 'hold'],
      ['tap', 'off', 'tap', 'tap'],
      ['hold', 'hold', 'hold', 'off'],
    ];
    for (const r of rows) expect(maskToRow(rowToMask(r))).toEqual(r);
  });
});
