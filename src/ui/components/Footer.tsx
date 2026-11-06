import { Icon } from './Icon';

export function Footer() {
  return (
    <footer class="footer">
      <span>
        <b>Better Magger</b>{' '}
        <span class="footer__divider" aria-hidden="true">
          /
        </span>{' '}
        An independent workbench for your keyboard.
      </span>
      <span class="footer__links">
        <a
          href="https://github.com/alexou8/better-magger/blob/claude/sleepy-archimedes-i4z9fx/docs/HARDWARE_VALIDATION.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Connection help
        </a>
        <a
          href="https://github.com/alexou8/better-magger"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub <Icon name="external" size={13} />
        </a>
      </span>
    </footer>
  );
}
