import type { Rgb } from './color';

// Start-to-start budget: USB read time is included, not added to the interval.
export const LED_FRAME_INTERVAL_MS = 1000 / 30;
const BUSY_RECHECK_MS = 8;

interface Options {
  read: (signal: AbortSignal) => Promise<Rgb[]>;
  onFrame: (colors: Rgb[]) => void;
  onError: (error: unknown) => void;
  canRead: () => boolean;
  once?: boolean;
}

/** At most one read in flight. Cancellation also suppresses stale completions. */
export function watchLiveLighting({ read, onFrame, onError, canRead, once }: Options): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (controller.signal.aborted) return;
    if (!canRead()) {
      timer = setTimeout(() => void tick(), BUSY_RECHECK_MS);
      return;
    }
    const started = performance.now();
    try {
      const colors = await read(controller.signal);
      if (controller.signal.aborted) return;
      onFrame(colors);
      if (!once) {
        // Slow hardware runs at its own pace. Never queue a backlog or "catch up" old frames.
        const remaining = LED_FRAME_INTERVAL_MS - (performance.now() - started);
        timer = setTimeout(() => void tick(), Math.max(1, remaining));
      }
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
      // Stop on the first failed frame; no background retry loop on unsupported firmware.
    }
  };
  void tick();
  return () => { controller.abort(); clearTimeout(timer); };
}
