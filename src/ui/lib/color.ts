export type Rgb = [number, number, number];

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace('#', ''), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Black or white text, whichever reads better on the colour. */
export function textOn([r, g, b]: Rgb): string {
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111' : '#fff';
}

export const SWATCHES: Rgb[] = [
  [255, 255, 255],
  [255, 40, 40],
  [255, 140, 0],
  [255, 220, 0],
  [40, 220, 90],
  [0, 200, 255],
  [40, 90, 255],
  [170, 60, 255],
  [255, 60, 170],
  [0, 0, 0],
];
