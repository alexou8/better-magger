import { describe, expect, it } from 'vitest';
import { ALL_MODELS } from '../../data/models';
import { defaultTrigger } from '../../core/units';
import { clampTrigger, fullTravel, maxActuation } from './trigger';

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
