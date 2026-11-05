import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface Props {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  wide?: boolean;
}

/** Native <dialog> modal: focus trapping, Esc to close, backdrop click closes. */
export function Modal({ title, onClose, children, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      class={`modal${wide ? ' modal--wide' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div class="modal__inner">
        <header class="modal__header">
          <h2>{title}</h2>
          <button type="button" class="btn btn--ghost btn--icon" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
