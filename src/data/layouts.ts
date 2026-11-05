import type { Layout } from '../core/types';
import { LAYOUTS, type LayoutData } from './gen/layouts';

export interface LayoutDef {
  id: string;
  width: number;
  height: number;
  keys: { id: number; label: string; x: number; y: number; w: number; h: number; code: number; demoIndex: number }[];
  /**
   * N() codes of the default layer-0 keymap per slot, as in the official demo data
   * (synthetic for layouts the site has no demo data for). Used by the simulator.
   */
  defaults: number[];
}

function toDef(d: LayoutData): LayoutDef {
  return {
    id: d.id,
    width: d.width,
    height: d.height,
    keys: d.keys.map(([label, x, y, w, h, code, demoIndex], id) => ({ id, label, x, y, w, h, code, demoIndex })),
    defaults: d.defaults,
  };
}

const DEFS = new Map(LAYOUTS.map((d) => [d.id, toDef(d)]));

export function getLayoutDef(id: string): LayoutDef {
  const def = DEFS.get(id) ?? DEFS.get('K68');
  if (!def) throw new Error(`Unknown layout ${id}`);
  return def;
}

export function layoutIds(): string[] {
  return [...DEFS.keys()];
}

/** A fresh Layout with the given slot indices (default: unresolved). */
export function buildLayout(def: LayoutDef, indices: number[] = []): Layout {
  return {
    id: def.id,
    width: def.width,
    height: def.height,
    keys: def.keys.map((k, i) => ({
      id: k.id,
      label: k.label,
      x: k.x,
      y: k.y,
      w: k.w,
      h: k.h,
      code: k.code,
      index: indices[i] ?? -1,
    })),
  };
}
