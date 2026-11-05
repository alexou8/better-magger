/** Trailing debounce with an explicit flush (used for slider writes). */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: A | null = null;
  const run = () => {
    timer = null;
    if (last) {
      const args = last;
      last = null;
      fn(...args);
    }
  };
  const call = (...args: A) => {
    last = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, ms);
  };
  call.flush = () => {
    if (timer) clearTimeout(timer);
    run();
  };
  return call;
}
