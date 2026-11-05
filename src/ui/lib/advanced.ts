import type { AdvancedKind, KeyAction } from '../../core/types';

export const SLOT_COUNT = 32;

export const KIND_TYPE: Record<AdvancedKind, number> = { dks: 144, tgl: 145, mt: 146, rs: 147, socd: 148, oks: 149 };

/** Types that share the MT slot table (PROTOCOL.md §4.7). */
export const MT_TABLE_TYPES = [146, 147, 148, 149];

export const PAIR_KINDS: AdvancedKind[] = ['rs', 'socd', 'oks'];

export const KIND_INFO: Record<AdvancedKind, { name: string; title: string; description: string; example: string }> = {
  dks: {
    name: 'DKS',
    title: 'Dynamic keystroke',
    description: 'Up to four different actions on one key, depending on how deep you press and when you release.',
    example: 'Light press = walk, full press = sprint.',
  },
  mt: {
    name: 'Mod-Tap',
    title: 'Tap for one thing, hold for another',
    description: 'A quick tap sends one action; holding the key longer than the hold time sends another.',
    example: 'Tap Caps Lock for Esc, hold it for Ctrl.',
  },
  tgl: {
    name: 'Toggle',
    title: 'Tap to lock a key down',
    description: 'Tapping the key locks its action on until you tap again. Holding it works like a normal key.',
    example: 'Toggle crouch or auto-run in games.',
  },
  socd: {
    name: 'SOCD / Snap Tap',
    title: 'Decide what happens when two opposite keys are held',
    description: 'When both keys of the pair are held, only one is sent: the most recently pressed one, or always the one you choose.',
    example: 'A + D for instant counter-strafing.',
  },
  rs: {
    name: 'Rappy Snappy',
    title: 'The deeper-pressed key wins',
    description: 'Watches two keys and only sends the one that is pressed down further. When both are fully pressed, both are sent.',
    example: 'Smooth left/right strafing with analog-like control.',
  },
  oks: {
    name: 'OKS',
    title: 'Trigger a key on release',
    description: 'Binds a second key to this one: the bound key fires when this key is released.',
    example: 'Release A to tap D.',
  },
};

export interface Binding {
  kind: AdvancedKind;
  layer: number;
  index: number;
  slot: number;
  /** Partner key index for pair kinds. */
  partner?: number;
  partnerSlot?: number;
  /** Mod-tap hold time in ms. */
  holdMs?: number;
}

function kindOfType(type: number): AdvancedKind | undefined {
  return (Object.keys(KIND_TYPE) as AdvancedKind[]).find((k) => KIND_TYPE[k] === type);
}

/** Finds advanced bindings in the keymap layers; pairs are reported once. */
export function findBindings(keymaps: (KeyAction[] | undefined)[], kinds: AdvancedKind[]): Binding[] {
  const out: Binding[] = [];
  keymaps.forEach((map, layer) => {
    map?.forEach((a, index) => {
      const kind = kindOfType(a.type);
      if (!kind || !kinds.includes(kind)) return;
      if (PAIR_KINDS.includes(kind)) {
        const partner = a.code2;
        const back = map[partner];
        const paired = back && back.type === a.type && back.code2 === index;
        if (paired && partner < index) return; // reported from the partner's side
        out.push({ kind, layer, index, slot: a.code1, partner, partnerSlot: paired ? back.code1 : undefined });
      } else {
        out.push({ kind, layer, index, slot: a.code1, holdMs: kind === 'mt' ? a.code2 * 10 : undefined });
      }
    });
  });
  return out;
}

/** Slots referenced by entries of the given action types, across all layers. */
export function usedSlots(keymaps: (KeyAction[] | undefined)[], types: number[]): Set<number> {
  const used = new Set<number>();
  for (const map of keymaps) map?.forEach((a) => types.includes(a.type) && used.add(a.code1));
  return used;
}

export function freeSlots(used: Set<number>, count: number, reuse: number[] = []): number[] {
  const out = [...reuse];
  for (let i = 0; i < SLOT_COUNT && out.length < count; i++) if (!used.has(i) && !out.includes(i)) out.push(i);
  return out.length >= count ? out.slice(0, count) : [];
}

/** SOCD priority options. Trigger byte1 high nibble: 1 = this key wins, 2 = partner wins (UNVERIFIED). */
export type SocdPriority = 'last' | 'a' | 'b';

export const SOCD_OPTIONS: { id: SocdPriority; name: string; help: string }[] = [
  { id: 'last', name: 'Last input wins', help: 'The most recently pressed key is sent (Snap Tap behaviour).' },
  { id: 'a', name: 'Key A always wins', help: 'While key A is held, key B is ignored.' },
  { id: 'b', name: 'Key B always wins', help: 'While key B is held, key A is ignored.' },
];

export function socdNibbles(p: SocdPriority): [number, number] {
  return p === 'a' ? [1, 2] : p === 'b' ? [2, 1] : [0, 0];
}

export function socdFromNibble(a: number): SocdPriority {
  return a === 1 ? 'a' : a === 2 ? 'b' : 'last';
}
