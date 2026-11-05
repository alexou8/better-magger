import type { DksSlot, KeyAction } from '../../core/types';
import { EMPTY_ACTION } from '../../data/keycodes';

/**
 * DKS phase masks (PROTOCOL.md §4.6). Per action a u16 holds 3-bit thermometer fields for
 * phases 0..2 (bits 0-2, 3-5, 6-8) and a single bit for phase 3 (bit 9). Field values:
 * 1 = tap at this point, 2 = press here and release at the next point, 3 = press here and keep
 * holding past the next point. The UI models each phase cell as off / tap / hold, where a run of
 * consecutive "hold" cells means "press at the first, release at the last".
 */
export type DksCell = 'off' | 'tap' | 'hold';
export type DksRow = [DksCell, DksCell, DksCell, DksCell];

export const DKS_PHASES = [
  { name: 'Press', help: 'Key passes the first point on the way down' },
  { name: 'Bottom', help: 'Key reaches the second (deep) point' },
  { name: 'Lift', help: 'Key starts coming back up from the bottom' },
  { name: 'Release', help: 'Key is fully released past the last point' },
] as const;

export const DKS_MAX_POINT = 30; // 3.0 mm, the official UI limit

function thermo(v: number): number {
  return (v > 0 ? 1 : 0) | (v > 1 ? 2 : 0) | (v > 2 ? 4 : 0);
}

function unthermo(bits: number): number {
  return bits & 4 ? 3 : bits & 2 ? 2 : bits & 1 ? 1 : 0;
}

function fields(mask: number): number[] {
  return [unthermo(mask & 7), unthermo((mask >> 3) & 7), unthermo((mask >> 6) & 7), (mask >> 9) & 1];
}

export function maskToRow(mask: number): DksRow {
  const f = fields(mask);
  const row: DksRow = ['off', 'off', 'off', 'off'];
  let p = 0;
  while (p < 4) {
    if (f[p] === 1) {
      row[p] = 'tap';
      p++;
    } else if (f[p] >= 2 && p < 3) {
      let n = 1;
      while (p + n - 1 < 3 && f[p + n - 1] === 3) n++;
      if (f[p + n - 1] === 2) n++;
      n = Math.min(n, 4 - p);
      for (let i = 0; i < n; i++) row[p + i] = 'hold';
      p += n;
    } else p++;
  }
  return row;
}

export function rowToMask(row: DksRow): number {
  const f = [0, 0, 0, 0];
  let p = 0;
  while (p < 4) {
    if (row[p] === 'tap') {
      f[p] = 1;
      p++;
    } else if (row[p] === 'hold') {
      let n = 1;
      while (p + n < 4 && row[p + n] === 'hold') n++;
      if (n === 1) f[p] = 1; // a lone hold cell is a tap
      for (let i = 0; i < n - 1; i++) f[p + i] = n - i >= 3 ? 3 : 2;
      p += n;
    } else p++;
  }
  return thermo(f[0]) | (thermo(f[1]) << 3) | (thermo(f[2]) << 6) | ((f[3] ? 1 : 0) << 9);
}

export function emptyDks(): DksSlot {
  return {
    points: [10, 30, 30, 10],
    actions: Array.from({ length: 4 }, () => ({ action: { ...EMPTY_ACTION }, mask: 0 })),
  };
}

/** Normalises a slot read from the device to exactly 4 actions. */
export function normaliseDks(slot: DksSlot | undefined): DksSlot {
  const base = emptyDks();
  if (!slot) return base;
  const actions = base.actions.map((a, i) => slot.actions[i] ?? a);
  return { points: [...slot.points] as DksSlot['points'], actions };
}

export function dksActionUsed(a: { action: KeyAction; mask: number }): boolean {
  return a.mask !== 0 && (a.action.type !== 0 || a.action.code1 !== 0 || a.action.code2 !== 0);
}
