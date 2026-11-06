import { describe, expect, it } from 'vitest';
import type { LayoutKey, LightingSettings } from '../../core/types';
import { previewColor } from './lightingPreview';
import { LIGHT_EFFECTS } from '../../data/lighting';
const key: LayoutKey = { id: 1, index: 1, x: 2, y: 1, w: 1, h: 1, code: 4, label: 'A' };
const light: LightingSettings = { effect: 3, brightness: 100, speed: 2, direction: 0, multicolor: false, r: 255, g: 100, b: 0, sleepMinutes: 0 };
describe('lighting preview', () => {
  it('static colours honour brightness and never animate', () => {
    expect(previewColor({ ...light, brightness: 0 }, key, 1)).toEqual([0, 0, 0]);
    expect(previewColor({ ...light, brightness: 50 }, key, 1)).toEqual([128, 50, 0]);
    expect(previewColor(light, key, 1)).toEqual(previewColor(light, key, 20));
  });
  it('custom uses key colours rather than the single-colour setting', () => {
    expect(previewColor({ ...light, effect: 0 }, key, 0, [0, 200, 255])).toEqual([0, 200, 255]);
    expect(previewColor({ ...light, effect: 0 }, key, 0)).toEqual([0, 0, 0]);
  });
  it('speed and direction change the moving pattern', () => {
    const wave = { ...light, effect: 6 };
    const normal = previewColor(wave, key, .43);
    expect(previewColor({ ...wave, speed: 4 }, key, .43)).not.toEqual(normal);
    expect(previewColor({ ...wave, direction: 1 }, key, .43)).not.toEqual(normal);
  });
  it('all moving patterns change over time and stay within RGB bounds', () => {
    for (const effect of LIGHT_EFFECTS.filter(e => e.speed)) {
      const frames = [0, .33, .8, 1.5].map(t => previewColor({ ...light, effect: effect.id }, key, t));
      expect(new Set(frames.map(c => c.join(','))).size, effect.name).toBeGreaterThan(1);
      expect(frames.flat().every(v => Number.isInteger(v) && v >= 0 && v <= 255)).toBe(true);
    }
  });
});
