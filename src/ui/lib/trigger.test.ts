import { describe, expect, it } from 'vitest';
import { ALL_MODELS } from '../../data/models';
import { defaultTrigger } from '../../core/units';
import { clampTrigger, fullTravel, maxActuation, matchReleaseToPress } from './trigger';

describe('switch travel constraints', () => {
  for (const model of ALL_MODELS) {
    for (const sw of model.features.switchTypes) {
      it(`${model.name}: changing to ${sw.name} respects bottom dead zone`, () => {
        const trigger = { ...defaultTrigger(model), switchType: sw.value, actuation: 9999, releaseDeadzone: 10 };
        const valid = clampTrigger(model, trigger);
        expect(fullTravel(model, sw.value)).toBe(sw.fullTravelRaw);
        expect(valid.actuation).toBe(maxActuation(model, valid));
        expect(valid.actuation + valid.releaseDeadzone).toBeLessThanOrEqual(sw.fullTravelRaw);
      });
    }
  }
});

it('matching RT sensitivity preserves the distance when precision modes differ', () => {
  const model = ALL_MODELS.find(m => m.features.rtPrecisionModes.length > 1)!;
  const before = { ...defaultTrigger(model), pressPrecision: 2, releasePrecision: 0, rtPress: 125, rtRelease: 30 };
  const after = matchReleaseToPress(before);
  expect(after.rtRelease).toBe(125);
  expect(after.releasePrecision).toBe(2);
  expect(after.actuation).toBe(before.actuation);
  expect(after.rtPress).toBe(before.rtPress);
});
