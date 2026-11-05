import { EFFECTS, type LightEffect } from './gen/lighting';

export type { LightEffect };

/** Lighting effects 0..22 (func block byte 8). Effect 0 "Custom" uses the per-key colours. */
export const LIGHT_EFFECTS: LightEffect[] = EFFECTS;

/** Labels for direction values 0 and 1, keyed by an effect's `direction` control set. */
export const DIRECTION_LABELS: Record<number, [string, string]> = {
  1: ['Right', 'Left'],
  2: ['Down', 'Up'],
  3: ['Outward', 'Inward'],
  4: ['Counter-clockwise', 'Clockwise'],
};

/** Light sleep options in minutes as offered by the official UI; 0 = never. */
export const SLEEP_OPTIONS_MIN: number[] = [0, 1, 10, 15, 30];
