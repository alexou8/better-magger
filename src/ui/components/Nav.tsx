import { navigate, type PageId } from '../state/route';
import type { PageInfo } from '../lib/pages';

interface Props {
  pages: PageInfo[];
  current: PageId;
}

/** Sidebar on wide screens, horizontal tabs on narrow ones (CSS). */
export function Nav({ pages, current }: Props) {
  return (
    <nav class="nav" aria-label="Sections">
      <ul>
        {pages.map((p) => (
          <li key={p.id}>
            <a
              href={`#/${p.id}`}
              class={`nav__item${p.id === current ? ' is-active' : ''}`}
              aria-current={p.id === current ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(p.id);
              }}
            >
              <span class="nav__icon" aria-hidden="true">
                {p.icon}
              </span>
              <span class="nav__text">
                <span class="nav__name">{p.name}</span>
                <span class="nav__help">{p.help}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
