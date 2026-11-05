interface Props {
  message: string;
  onRetry: () => void;
}

export function LoadError({ message, onRetry }: Props) {
  return (
    <div class="notice notice--error" role="alert">
      <div>
        <strong>Couldn't read from the keyboard.</strong> {message}
      </div>
      <button type="button" class="btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
