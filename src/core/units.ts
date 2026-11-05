import type { DeviceModel, KeyTrigger, RtPrecisionMode } from './types';

export function rawToMm(raw: number, rawPerMm: number): number {
  return raw / rawPerMm;
}

export function mmToRaw(mm: number, rawPerMm: number): number {
  return Math.round(mm * rawPerMm);
}

/** RT precision mode by id; falls back to mode 0 (models without precision settings). */
export function rtMode(model: DeviceModel, id: number): RtPrecisionMode {
  const modes = model.features.rtPrecisionModes;
  return modes.find((m) => m.id === id) ?? modes[0];
}

/** "2.00 mm", or three decimals when needed ("0.125 mm"). */
export function formatMm(mm: number): string {
  const needsThousandths = Math.abs(Math.round(mm * 1000) - Math.round(mm * 100) * 10) > 0;
  return `${mm.toFixed(needsThousandths ? 3 : 2)} mm`;
}

/** Factory-like trigger: 2.0 mm actuation, rapid trigger off, 0.3 mm RT sensitivity, no dead zones. */
export function defaultTrigger(model: DeviceModel): KeyTrigger {
  const base = model.features.travel.rawPerMm;
  const rt = rtMode(model, 0);
  return {
    switchType: 0,
    mode: 0,
    priority: 0,
    actuation: mmToRaw(2, base),
    pressPrecision: 0,
    releasePrecision: 0,
    rtPress: mmToRaw(0.3, rt.rawPerMm),
    rtRelease: mmToRaw(0.3, rt.rawPerMm),
    pressDeadzone: 0,
    releaseDeadzone: 0,
  };
}
