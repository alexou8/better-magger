import { signal } from '@preact/signals';
import { rgbToHex, type Rgb } from '../lib/color';
import { parseRecentColors } from '../lib/recentColors';
import { readPref, writePref } from '../lib/storage';

const KEY = 'better-magger.recent-colors.v1';
export const recentColors = signal(parseRecentColors(readPref(KEY)));
export function rememberColor(rgb: Rgb): void {
  const hex = rgbToHex(rgb);
  recentColors.value = [hex, ...recentColors.peek().filter(c => c !== hex)].slice(0, 6);
  writePref(KEY, JSON.stringify(recentColors.peek()));
}
