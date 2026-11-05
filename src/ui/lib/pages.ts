import type { DeviceModel } from '../../core/types';
import type { PageId } from '../state/route';

export interface PageInfo {
  id: PageId;
  name: string;
  icon: string;
  help: string;
}

const ALL: PageInfo[] = [
  { id: 'keymap', name: 'Keymap', icon: '⌨', help: 'Change what each key does' },
  { id: 'performance', name: 'Performance', icon: '⇣', help: 'Actuation point & Rapid Trigger' },
  { id: 'advanced', name: 'Advanced keys', icon: '✦', help: 'DKS, Mod-Tap, Toggle, SOCD…' },
  { id: 'lighting', name: 'Lighting', icon: '☀', help: 'Effects, colours, per-key RGB' },
  { id: 'macros', name: 'Macros', icon: '↻', help: 'Record key sequences' },
  { id: 'settings', name: 'Settings', icon: '⚙', help: 'Polling rate, calibration, backup' },
];

/** Pages the connected model actually supports. */
export function pagesFor(model: DeviceModel): PageInfo[] {
  const f = model.features;
  return ALL.filter((p) => {
    if (p.id === 'advanced') return f.advanced.length > 0;
    if (p.id === 'lighting') return f.lighting;
    if (p.id === 'macros') return f.macros;
    return true;
  });
}
