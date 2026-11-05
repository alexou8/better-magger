import { MODELS, VENDOR_ID, type ModelRecord } from './gen/models';

export { VENDOR_ID, type ModelRecord };

/** Every known model, Magger68 first, then Magger 60, then other LUMINKEY boards. */
export const ALL_MODELS: readonly ModelRecord[] = MODELS;

/** Model for a normal-mode PID; `productName` disambiguates PIDs shared by several boards. */
export function findModel(pid: number, productName = ''): ModelRecord | undefined {
  const candidates = MODELS.filter((m) => m.pid === pid || m.altPids.includes(pid));
  if (candidates.length <= 1) return candidates[0];
  return (
    candidates.find((m) => m.productNames.includes(productName)) ??
    candidates.find((m) => m.productNames.some((n) => productName.startsWith(n))) ??
    candidates[0]
  );
}

/** Model whose firmware-update (bootloader) PID this is. */
export function findModelByBootPid(pid: number): ModelRecord | undefined {
  return MODELS.find((m) => m.bootPid === pid);
}

export function isBootloaderPid(pid: number): boolean {
  return MODELS.some((m) => m.bootPid === pid);
}
