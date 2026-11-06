import type { LayoutKey, LightingSettings } from '../../core/types';
import type { Rgb } from './color';

/** Illustrative patterns, not a firmware simulation. Time is in seconds. */
export function previewColor(light: LightingSettings, key: LayoutKey, seconds: number, custom?: Rgb): Rgb {
  const t = seconds * (0.35 + light.speed * 0.3);
  const x = key.x + key.w / 2, y = key.y + key.h / 2;
  const dx = x - 7, dy = y - 2.5;
  const radius = Math.hypot(dx, dy);
  const sign = light.direction === 1 ? -1 : 1;
  const pulse = (phase: number) => (Math.sin(phase * Math.PI * 2) + 1) / 2;
  let level = 1;
  switch (light.effect) {
    case 2: level = pulse(y / 5 - t); break;
    case 4: level = 0.05 + 0.95 * pulse(t); break;
    case 5: level = pulse(radius / 4 - t); break;
    case 6: level = pulse(x / 9 - t * sign); break;
    case 7: level = pulse(y / 5 - t * sign); break;
    case 8: level = pulse(radius / 6 - t * sign); break;
    case 9: level = pulse(radius - t + Math.atan2(dy, dx)); break;
    case 10: level = pulse(Math.atan2(dy, dx) / Math.PI - t * sign); break;
    case 11: level = pulse(x / 12 + y / 6 - t); break;
    case 12: level = pulse(x / 12 + Math.sin(t)); break;
    case 13: case 14: case 21: level = pulse(radius / 4 - t) ** 6; if (light.effect === 14) level = 0.25 + level * 0.75; break;
    case 15: level = pulse((key.id / 15) - t) ** 8; break;
    case 16: level = pulse(Math.max(Math.abs(dx), Math.abs(dy)) / 4 - t); break;
    case 17: level = pulse(key.id * 0.7 - t) ** 12; break;
    case 18: level = pulse(x / 8 + y / 3 - t) ** 3; break;
    case 19: level = pulse(y / 4 - t + Math.sin(x * 43)) ** 8; break;
    case 20: level = pulse(key.id * 1.618 + t / 2) ** 16; break;
    case 22: level = pulse(x / 6 - t + Math.floor(y / 2)) ** 3; break;
  }
  const rainbow = light.effect === 1 || light.effect === 5 || light.multicolor;
  const hue = (x / 15 + y / 10 + t / 4) % 1;
  const rainbowRgb = [0, 2/3, 1/3].map(offset => {
    const h = ((hue + offset) % 1) * 6;
    return Math.round(255 * Math.max(0, Math.min(1, Math.abs(h - 3) - 1)));
  }) as Rgb;
  const color: Rgb = light.effect === 0 ? (custom ?? [0, 0, 0]) : rainbow ? rainbowRgb : [light.r, light.g, light.b];
  return color.map(v => Math.round(v * level * light.brightness / 100)) as Rgb;
}
