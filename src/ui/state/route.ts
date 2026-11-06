import { signal } from '@preact/signals';

export type PageId = 'keymap' | 'performance' | 'advanced' | 'lighting' | 'macros' | 'settings';
const PAGES: PageId[] = ['keymap', 'performance', 'advanced', 'lighting', 'macros', 'settings'];

function fromHash(): PageId {
  const id = location.hash.replace(/^#\/?/, '') as PageId;
  return PAGES.includes(id) ? id : 'keymap';
}

/** Current page, mirrored in the URL hash so back/forward work without reloads. */
export const page = signal<PageId>(fromHash());

window.addEventListener('hashchange', () => {
  if (location.hash === '#main') return; // The skip link must not change the selected section.
  page.value = fromHash();
});

export function navigate(id: PageId): void {
  if (location.hash !== `#/${id}`) location.hash = `#/${id}`;
  page.value = id;
}
