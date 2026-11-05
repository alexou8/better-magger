import { dismissToast, toasts } from '../state/toast';

const ICON = { success: '✓', error: '!', info: 'i' } as const;

export function Toasts() {
  return (
    <div class="toasts" aria-live="polite" aria-relevant="additions">
      {toasts.value.map((t) => (
        <div key={t.id} class={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
          <span class="toast__icon" aria-hidden="true">
            {ICON[t.tone]}
          </span>
          <span class="toast__msg">{t.message}</span>
          {t.action && (
            <button
              type="button"
              class="btn btn--small"
              onClick={() => {
                dismissToast(t.id);
                t.action!.run();
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" class="btn btn--ghost btn--icon btn--small" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
