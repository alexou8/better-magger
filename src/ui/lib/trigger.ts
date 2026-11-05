import type { DeviceModel, KeyMode, KeyTrigger } from '../../core/types';
import { mmToRaw, rtMode } from '../../core/units';

export const MODES: { id: KeyMode; name: string; help: string }[] = [
  { id: 0, name: 'Normal', help: 'The key turns on at the actuation point and off when it rises back above it. Like a regular keyboard.' },
  {
    id: 1,
    name: 'Rapid Trigger',
    help: 'After actuating, the key turns off as soon as it starts rising and on again as soon as it goes down, no matter where it is. Great for fast repeated taps and strafing.',
  },
  {
    id: 2,
    name: 'Continuous RT',
    help: 'Like Rapid Trigger, but it stays active all the way up until the key is fully released, so very light lifts never reset it.',
  },
];

/** Full travel (raw, base unit) of a key's switch. */
export function fullTravel(model: DeviceModel, switchType: number): number {
  const sw = model.features.switchTypes.find((s) => s.value === switchType);
  return sw?.fullTravelRaw ?? model.features.travel.maxRaw;
}

/** Highest allowed actuation: full travel minus the bottom dead zone (official UI clamp). */
export function maxActuation(model: DeviceModel, t: KeyTrigger): number {
  return Math.max(model.features.travel.minActuationRaw, fullTravel(model, t.switchType) - t.releaseDeadzone);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/** Makes a trigger valid for the model (ranges, ordering). */
export function clampTrigger(model: DeviceModel, t: KeyTrigger): KeyTrigger {
  const lim = model.features.travel;
  const press = rtMode(model, t.pressPrecision);
  const release = rtMode(model, t.releasePrecision);
  const next = {
    ...t,
    pressDeadzone: clamp(t.pressDeadzone, 0, lim.deadzoneMaxRaw),
    releaseDeadzone: clamp(t.releaseDeadzone, 0, lim.deadzoneMaxRaw),
    rtPress: clamp(t.rtPress, 1, press.maxRaw),
    rtRelease: clamp(t.rtRelease, 1, release.maxRaw),
  };
  next.actuation = clamp(t.actuation, lim.minActuationRaw, maxActuation(model, next));
  return next;
}

/** Converts an RT value between precision modes, keeping the same distance in mm. */
export function convertRt(model: DeviceModel, raw: number, fromMode: number, toMode: number): number {
  const from = rtMode(model, fromMode);
  const to = rtMode(model, toMode);
  return Math.round((raw / from.rawPerMm) * to.rawPerMm);
}

export interface Preset {
  id: string;
  name: string;
  help: string;
  actuationMm: number;
  mode: KeyMode;
  rtMm?: number;
}

export const PRESETS: Preset[] = [
  { id: 'typing', name: 'Typing', help: '2.0 mm, normal. Comfortable, fewer accidental presses.', actuationMm: 2.0, mode: 0 },
  { id: 'gaming', name: 'Gaming', help: '1.2 mm with Rapid Trigger 0.15 mm. Responsive but forgiving.', actuationMm: 1.2, mode: 1, rtMm: 0.15 },
  { id: 'competitive', name: 'Competitive', help: '0.5 mm with Rapid Trigger 0.05 mm. Hair-trigger; rest fingers lightly.', actuationMm: 0.5, mode: 1, rtMm: 0.05 },
];

export function applyPreset(model: DeviceModel, t: KeyTrigger, p: Preset): KeyTrigger {
  const next: KeyTrigger = { ...t, mode: p.mode, actuation: mmToRaw(p.actuationMm, model.features.travel.rawPerMm) };
  if (p.rtMm !== undefined) {
    next.rtPress = Math.max(1, mmToRaw(p.rtMm, rtMode(model, t.pressPrecision).rawPerMm));
    next.rtRelease = Math.max(1, mmToRaw(p.rtMm, rtMode(model, t.releasePrecision).rawPerMm));
  }
  return clampTrigger(model, next);
}

/** Heatmap colour for an actuation depth: shallow = warm, deep = cool. */
export function actuationColor(model: DeviceModel, raw: number): string {
  const lim = model.features.travel;
  const f = Math.min(1, Math.max(0, (raw - lim.minActuationRaw) / Math.max(1, lim.maxRaw - lim.minActuationRaw)));
  return `hsl(${Math.round(10 + f * 200)} 70% 45% / 0.55)`;
}
