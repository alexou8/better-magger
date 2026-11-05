import { signal, effect } from '@preact/signals';
import { readPref, writePref } from '../lib/storage';

export type Theme = 'dark' | 'light';
const KEY = 'better-magger.theme';

function initial(): Theme {
  const saved = readPref(KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  const prefersLight = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'light' : 'dark';
}

export const theme = signal<Theme>(initial());

export function initTheme(): void {
  effect(() => {
    document.documentElement.dataset.theme = theme.value;
  });
}

export function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  writePref(KEY, theme.value);
}
