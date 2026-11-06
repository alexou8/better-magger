import { expect, it } from 'vitest';
import { parseRecentColors } from './recentColors';
it('rejects corrupt or unexpected stored preferences', () => {
  for (const raw of [null, 'broken', '{}', 'true', '123', '"#ffffff"']) expect(parseRecentColors(raw)).toEqual([]);
});
it('validates, normalizes, deduplicates and bounds recent colours', () => {
  expect(parseRecentColors(JSON.stringify(['#FF0011', '#ff0011', null, 12, 'red', '#123', '<script>', '#00FF00']))).toEqual(['#ff0011', '#00ff00']);
  expect(parseRecentColors(JSON.stringify(Array.from({ length: 10 }, (_, i) => `#00000${i}`)))).toHaveLength(6);
});
