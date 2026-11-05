import { useEffect, useMemo, useRef } from 'preact/hooks';
import { debounce } from '../lib/debounce';

/**
 * Accumulates patches and writes them after `ms` of quiet (slider drags). The merged patch is
 * passed to `write`; pending patches are flushed on unmount so nothing is lost.
 */
export function useDebouncedWriter<P>(write: (patch: P) => void, merge: (a: P, b: P) => P, ms: number) {
  const pending = useRef<P | null>(null);
  const writeRef = useRef(write);
  writeRef.current = write;

  const flusher = useMemo(
    () =>
      debounce(() => {
        const p = pending.current;
        pending.current = null;
        if (p !== null) writeRef.current(p);
      }, ms),
    [ms],
  );

  useEffect(() => () => flusher.flush(), [flusher]);

  return (patch: P) => {
    pending.current = pending.current === null ? patch : merge(pending.current, patch);
    flusher();
  };
}
