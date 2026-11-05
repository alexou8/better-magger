export interface LayerInfo {
  name: string;
  help: string;
}

/** Layer 0..3 names with plain-language explanations (PROTOCOL.md §2). */
export const LAYERS: LayerInfo[] = [
  { name: 'Main', help: 'What every key does normally (Windows mode).' },
  { name: 'FN1', help: 'Active while you hold the FN key.' },
  { name: 'Mac / FN2', help: 'Used instead of Main when the keyboard is in Mac mode.' },
  { name: 'FN3', help: 'Active while holding FN in Mac mode, or a second FN key.' },
];
