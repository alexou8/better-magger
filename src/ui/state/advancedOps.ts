import type { AdvancedKind, DksSlot, KeyAction, KeyboardSession } from '../../core/types';
import { EMPTY_ACTION } from '../../data/keycodes';
import { KIND_TYPE, socdNibbles, type Binding, type SocdPriority } from '../lib/advanced';
import { loadTable, setCached } from './cache';
import { applyKeys, applyTriggers } from './writes';

const ADVANCED_TYPES = new Set([144, 145, 146, 147, 148, 149, 150]);

/** The key's own action: its current mapping, or its default when it already holds an advanced binding. */
export async function baseAction(s: KeyboardSession, profile: number, layer: number, index: number): Promise<KeyAction> {
  const map = await loadTable(s, profile, 'keymap', layer);
  if (!ADVANCED_TYPES.has(map[index].type)) return map[index];
  const defaults = await loadTable(s, profile, 'defaults', layer);
  return defaults[index];
}

export async function assignDks(s: KeyboardSession, p: number, layer: number, index: number, slot: number, dks: DksSlot) {
  await s.writeDks(p, slot, dks);
  const all = await loadTable(s, p, 'dks');
  setCached(p, 'dks', all.map((d, i) => (i === slot ? dks : d)));
  await applyKeys(s, p, layer, [{ index, action: { type: KIND_TYPE.dks, code1: slot, code2: 0 } }]);
}

export async function assignTgl(s: KeyboardSession, p: number, layer: number, index: number, slot: number, action: KeyAction) {
  await s.writeTgl(p, slot, action);
  const all = await loadTable(s, p, 'tgl');
  setCached(p, 'tgl', all.map((a, i) => (i === slot ? action : a)));
  await applyKeys(s, p, layer, [{ index, action: { type: KIND_TYPE.tgl, code1: slot, code2: 0 } }]);
}

async function writeMtSlots(s: KeyboardSession, p: number, slots: Map<number, { tap: KeyAction; hold: KeyAction }>) {
  const all = await loadTable(s, p, 'mt');
  const next = all.map((m, i) => slots.get(i) ?? m);
  await s.writeMt(p, next);
  setCached(p, 'mt', next);
}

export async function assignMt(
  s: KeyboardSession,
  p: number,
  layer: number,
  index: number,
  slot: number,
  tap: KeyAction,
  hold: KeyAction,
  holdMs: number,
) {
  await writeMtSlots(s, p, new Map([[slot, { tap, hold }]]));
  const code2 = Math.min(255, Math.max(1, Math.round(holdMs / 10)));
  await applyKeys(s, p, layer, [{ index, action: { type: KIND_TYPE.mt, code1: slot, code2 } }]);
}

export interface PairOptions {
  kind: AdvancedKind;
  layer: number;
  a: number;
  b: number;
  slots: [number, number];
  priority?: SocdPriority;
  /** Copy key A's actuation / RT settings to key B (SOCD). */
  matchTriggers?: boolean;
}

export async function assignPair(s: KeyboardSession, p: number, o: PairOptions) {
  const [actA, actB] = [await baseAction(s, p, o.layer, o.a), await baseAction(s, p, o.layer, o.b)];
  const [sa, sb] = o.slots;
  await writeMtSlots(
    s,
    p,
    new Map([
      [sa, { tap: actA, hold: actB }],
      [sb, { tap: actB, hold: actA }],
    ]),
  );
  if (o.kind === 'socd') {
    const triggers = await loadTable(s, p, 'triggers');
    const [na, nb] = socdNibbles(o.priority ?? 'last');
    const tA = { ...triggers[o.a], priority: na };
    const tB = o.matchTriggers ? { ...tA, switchType: triggers[o.b].switchType, priority: nb } : { ...triggers[o.b], priority: nb };
    await applyTriggers(s, p, [
      { index: o.a, trigger: tA },
      { index: o.b, trigger: tB },
    ]);
  }
  const type = KIND_TYPE[o.kind];
  await applyKeys(s, p, o.layer, [
    { index: o.a, action: { type, code1: sa, code2: o.b } },
    { index: o.b, action: { type, code1: sb, code2: o.a } },
  ]);
}

/** Removes a binding and restores the key(s) to their default action. */
export async function removeBinding(s: KeyboardSession, p: number, b: Binding) {
  const defaults = await loadTable(s, p, 'defaults', b.layer);
  const keys = b.partner !== undefined ? [b.index, b.partner] : [b.index];
  if (b.kind === 'socd') {
    const triggers = await loadTable(s, p, 'triggers');
    await applyTriggers(
      s,
      p,
      keys.map((index) => ({ index, trigger: { ...triggers[index], priority: 0 } })),
    );
  }
  await applyKeys(
    s,
    p,
    b.layer,
    keys.map((index) => ({ index, action: defaults[index] })),
  );
  if (b.kind === 'mt' || b.partner !== undefined) {
    const cleared = new Map<number, { tap: KeyAction; hold: KeyAction }>();
    for (const slot of [b.slot, b.partnerSlot]) {
      if (slot !== undefined) cleared.set(slot, { tap: { ...EMPTY_ACTION }, hold: { ...EMPTY_ACTION } });
    }
    await writeMtSlots(s, p, cleared);
  }
}
