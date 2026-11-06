import { navigate, type PageId } from '../state/route';
import type { PageInfo } from '../lib/pages';
import { Icon } from './Icon';

interface Props {
  pages: PageInfo[];
  current: PageId;
}

/** Sidebar on wide screens, horizontal tabs on narrow ones (CSS). */
export function Nav({ pages, current }: Props) {
  return (
    <nav class="nav" aria-label="Sections">
      <span class="nav__eyebrow index-label">Your workspace</span>
      <ul>
        {pages.map((p, i) => (
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
                <Icon name={p.icon} size={20} />
              </span>
              <span class="nav__number" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span class="nav__text">
                <span class="nav__name">{p.name}</span>
                <span class="nav__help">{p.help}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div class="nav__foot">
        <span class="nav__foot-line" />
        <span>
          Small changes.
          <br />A different feel.
        </span>
      </div>
    </nav>
  );
}
