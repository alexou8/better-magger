import { useEffect, useRef, useState } from 'preact/hooks';
import type { KeyboardSession } from '../../core/types';

export interface TravelSample {
  raw: number;
  calibrationStatus?: number;
}

/**
 * Collects 'travel' events into a map (key index -> latest sample), re-rendering at most once per
 * animation frame. Keeps the peak depth per key when `trackPeak` is set (calibration progress).
 */
export function useTravelEvents(s: KeyboardSession | null, active: boolean, trackPeak = false): ReadonlyMap<number, TravelSample> {
  const [snapshot, setSnapshot] = useState<ReadonlyMap<number, TravelSample>>(new Map());
  const data = useRef(new Map<number, TravelSample>());

  useEffect(() => {
    data.current = new Map();
    setSnapshot(new Map());
    if (!s || !active) return;
    let frame = 0;
    const off = s.on((e) => {
      if (e.kind !== 'travel') return;
      const prev = data.current.get(e.index);
      const raw = trackPeak && prev ? Math.max(prev.raw, e.raw) : e.raw;
      data.current.set(e.index, { raw, calibrationStatus: e.calibrationStatus ?? prev?.calibrationStatus });
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        setSnapshot(new Map(data.current));
      });
    });
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, [s, active, trackPeak]);

  return snapshot;
}
