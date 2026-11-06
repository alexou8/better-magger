import type { Rgb } from './color';

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
      timer = setTimeout(() => void tick(), 100);
      return;
    }
    try {
      const colors = await read(controller.signal);
      if (controller.signal.aborted) return;
      onFrame(colors);
      if (!once) timer = setTimeout(() => void tick(), 300);
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
      // Stop on the first failed frame; no background retry loop on unsupported firmware.
    }
  };
  void tick();
  return () => { controller.abort(); clearTimeout(timer); };
}
