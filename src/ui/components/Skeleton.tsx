interface Props {
  lines?: number;
  /** Show a keyboard-shaped block. */
  keyboard?: boolean;
  label?: string;
}

/** Placeholder shown while profile data is read from the keyboard. */
export function Skeleton({ lines = 3, keyboard = false, label = 'Reading from keyboard…' }: Props) {
  return (
    <div class="skeleton" role="status" aria-live="polite">
      <span class="visually-hidden">{label}</span>
      {keyboard && <div class="skeleton__block skeleton__kbd" />}
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} class="skeleton__block skeleton__line" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
