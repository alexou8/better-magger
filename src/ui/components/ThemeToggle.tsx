import { theme, toggleTheme } from '../state/theme';

export function ThemeToggle() {
  const dark = theme.value === 'dark';
  return (
    <button
      type="button"
      class="btn btn--ghost btn--icon"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}
