export type IconName =
  | 'keyboard'
  | 'performance'
  | 'advanced'
  | 'lighting'
  | 'macros'
  | 'settings'
  | 'usb'
  | 'arrow'
  | 'external'
  | 'moon'
  | 'sun'
  | 'disconnect'
  | 'check'
  | 'pointer'
  | 'help'
  | 'download';

const paths: Record<IconName, string> = {
  keyboard:
    'M3 6h18v12H3z M6 9h1m3 0h1m3 0h1m3 0h1 M6 12h1m3 0h1m3 0h1m3 0h1 M7 15h10',
  performance: 'M4 18V6m0 12h16 M7 15l4-7 4 4 5-8',
  advanced: 'M4 5h6v6H4z M14 13h6v6h-6z M7 11v5h7 M14 5h6m-3-3v6',
  lighting: 'M9 18h6m-5 3h4 M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2z',
  macros: 'M5 5v14l6-4 6 4V5z M8 8h6m-6 3h6',
  settings: 'M4 7h16M4 17h16 M8 4v6m8 4v6',
  usb: 'M12 21V3m0 0-3 3m3-3 3 3 M12 16l-5-4V9 M12 13l5-4V6 M5.5 6h3v3h-3z M15.5 3h3v3h-3z',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  external: 'M9 5H4v15h15v-5 M13 4h7v7 M20 4 10 14',
  moon: 'M20 14.3A8.5 8.5 0 0 1 9.7 4a8.5 8.5 0 1 0 10.3 10.3z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2m0 16v2M2 12h2m16 0h2 M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  disconnect: 'M10 4H4v16h6 M8 12h13m-4-4 4 4-4 4',
  check: 'M5 12l4 4L19 6',
  pointer: 'M5 3v17l5-5 4 6 3-2-4-6h7z',
  help: 'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  download: 'M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5',
};

/** One stroke language; every icon supplements visible text or a named control. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
