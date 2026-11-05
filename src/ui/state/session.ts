import { signal, computed } from '@preact/signals';
import type { FirmwareInfo, KeyboardSession } from '../../core/types';

export type ConnState = 'idle' | 'connecting' | 'connected' | 'lost';

export interface ConnectNotice {
  tone: 'info' | 'warn' | 'error';
  title: string;
  body: string;
}

export const session = signal<KeyboardSession | null>(null);
export const connState = signal<ConnState>('idle');
export const connectNotice = signal<ConnectNotice | null>(null);
export const firmware = signal<FirmwareInfo | null>(null);
/** 0-based active profile on the keyboard. */
export const activeProfile = signal(0);
/** Name of the last connected model, for the "reconnecting" banner. */
export const lastModelName = signal<string | null>(null);

export const model = computed(() => session.value?.model ?? null);
