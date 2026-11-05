import { signal, type Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { BaseSettings, DksSlot, KeyAction, KeyboardSession, KeyTrigger, Macro, MtSlot } from '../../core/types';
import type { Rgb } from '../lib/color';
import { activeProfile, session } from './session';

export interface TableTypes {
  settings: BaseSettings;
  keymap: KeyAction[];
  defaults: KeyAction[];
  triggers: KeyTrigger[];
  colors: Rgb[];
  macros: Macro[];
  dks: DksSlot[];
  mt: MtSlot[];
  tgl: KeyAction[];
}
export type TableId = keyof TableTypes;

interface EntryState {
  data?: unknown;
  error?: string;
}

const entries = new Map<string, Signal<EntryState>>();
const inflight = new Map<string, Promise<unknown>>();
/** Bumped when the cache is cleared so late replies from an old session are dropped. */
let generation = 0;

/** Reads in flight (busy indicator). */
export const pendingReads = signal(0);

function keyOf(profile: number, table: TableId, layer: number): string {
  return table === 'keymap' || table === 'defaults' ? `${profile}/${table}/${layer}` : `${profile}/${table}`;
}

function entry(key: string): Signal<EntryState> {
  let e = entries.get(key);
  if (!e) {
    e = signal<EntryState>({});
    entries.set(key, e);
  }
  return e;
}

function read<K extends TableId>(s: KeyboardSession, profile: number, table: K, layer: number): Promise<TableTypes[K]> {
  const loaders: { [T in TableId]: () => Promise<TableTypes[T]> } = {
    settings: () => s.readSettings(profile),
    keymap: () => s.readKeymap(profile, layer),
    defaults: () => s.readDefaultKeymap(profile, layer),
    triggers: () => s.readTriggers(profile),
    colors: () => s.readKeyColors(profile),
    macros: () => s.readMacros(profile),
    dks: () => s.readDks(profile),
    mt: () => s.readMt(profile),
    tgl: () => s.readTgl(profile),
  };
  return loaders[table]() as Promise<TableTypes[K]>;
}

/** Loads a table (cached; concurrent calls share one device read). */
export function loadTable<K extends TableId>(
  s: KeyboardSession,
  profile: number,
  table: K,
  layer = 0,
  force = false,
): Promise<TableTypes[K]> {
  const key = keyOf(profile, table, layer);
  const e = entry(key);
  if (!force && e.peek().data !== undefined) return Promise.resolve(e.peek().data as TableTypes[K]);
  const running = inflight.get(key);
  if (running) return running as Promise<TableTypes[K]>;
  const gen = generation;
  pendingReads.value++;
  const p = read(s, profile, table, layer)
    .then((data) => {
      if (gen === generation) e.value = { data };
      return data;
    })
    .catch((err: unknown) => {
      if (gen === generation) e.value = { ...e.peek(), error: err instanceof Error ? err.message : String(err) };
      throw err;
    })
    .finally(() => {
      pendingReads.value--;
      if (inflight.get(key) === p) inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export function getCached<K extends TableId>(profile: number, table: K, layer = 0): TableTypes[K] | undefined {
  return entry(keyOf(profile, table, layer)).peek().data as TableTypes[K] | undefined;
}

export function setCached<K extends TableId>(profile: number, table: K, value: TableTypes[K], layer = 0): void {
  entry(keyOf(profile, table, layer)).value = { data: value };
}

/** Drops cached data for one profile (or everything) so it is re-read on next use. */
export function invalidate(profile?: number): void {
  if (profile === undefined) generation++;
  for (const [key, e] of entries) {
    if (profile === undefined || key.startsWith(`${profile}/`)) e.value = {};
  }
  if (profile === undefined) inflight.clear();
}

export interface TableHandle<T> {
  data: T | undefined;
  error: string | undefined;
  reload: () => void;
}

/** Subscribes a component to one table of the active profile, loading it on demand. */
export function useTable<K extends TableId>(table: K, layer = 0, enabled = true): TableHandle<TableTypes[K]> {
  const s = session.value;
  const profile = activeProfile.value;
  const key = keyOf(profile, table, layer);
  const state = entry(key).value;
  const missing = state.data === undefined && state.error === undefined;

  useEffect(() => {
    if (s && enabled && missing) loadTable(s, profile, table, layer).catch(() => undefined);
  }, [s, key, enabled, missing]);

  return {
    data: state.data as TableTypes[K] | undefined,
    error: state.error,
    reload: () => {
      if (s) loadTable(s, profile, table, layer, true).catch(() => undefined);
    },
  };
}
