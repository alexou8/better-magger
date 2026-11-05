import { signal } from '@preact/signals';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; run: () => void };
}

export const toasts = signal<Toast[]>([]);
/** Number of writes in flight (drives the busy indicator together with reads). */
export const pendingWrites = signal(0);

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function dismissToast(id: number): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

export function showToast(tone: ToastTone, message: string, action?: Toast['action'], ttlMs?: number): number {
  // Collapse repeated success toasts (slider drags) into one instead of stacking them.
  if (tone === 'success') {
    for (const t of toasts.value) if (t.tone === 'success') dismissToast(t.id);
  }
  const id = nextId++;
  toasts.value = [...toasts.value.slice(-3), { id, tone, message, action }];
  const ttl = ttlMs ?? (tone === 'error' ? 10000 : action ? 6000 : 2500);
  timers.set(id, setTimeout(() => dismissToast(id), ttl));
  return id;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unknown error';
}

interface SaveOptions {
  /** Called when the user clicks "Undo" on the success toast. */
  undo?: () => Promise<unknown>;
  success?: string;
}

/**
 * Runs a keyboard write with visible feedback: "Saved to keyboard" on success,
 * a clear error with a Retry button on failure. Resolves to whether the write succeeded.
 */
export async function save(what: string, fn: () => Promise<unknown>, opts: SaveOptions = {}): Promise<boolean> {
  pendingWrites.value++;
  try {
    await fn();
    const undo = opts.undo;
    showToast(
      'success',
      opts.success ?? 'Saved to keyboard',
      undo ? { label: 'Undo', run: () => void save(`undo ${what}`, undo, { success: 'Change undone' }) } : undefined,
    );
    return true;
  } catch (err) {
    showToast('error', `Couldn't save ${what}: ${errorMessage(err)}`, {
      label: 'Retry',
      run: () => void save(what, fn, opts),
    });
    return false;
  } finally {
    pendingWrites.value--;
  }
}
