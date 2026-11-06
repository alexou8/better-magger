import type { DeviceModel } from '../../core/types';
import type { PageId } from '../state/route';
import type { IconName } from '../components/Icon';

export interface PageInfo {
  id: PageId;
  name: string;
  icon: IconName;
  help: string;
}

const ALL: PageInfo[] = [
  {
    id: 'keymap',
    name: 'Keymap',
    icon: 'keyboard',
    help: 'Give every key a job',
  },
  {
    id: 'performance',
    name: 'Performance',
    icon: 'performance',
    help: 'Find your feel',
  },
  {
    id: 'advanced',
    name: 'Advanced keys',
    icon: 'advanced',
    help: 'Go beyond one action',
  },
  {
    id: 'lighting',
    name: 'Lighting',
    icon: 'lighting',
    help: 'Set the atmosphere',
  },
  { id: 'macros', name: 'Macros', icon: 'macros', help: 'Build a sequence' },
  {
    id: 'settings',
    name: 'Settings',
    icon: 'settings',
    help: 'Look after your setup',
  },
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
