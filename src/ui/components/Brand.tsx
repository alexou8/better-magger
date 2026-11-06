export function Brand() {
  return (
    <div class="brand" aria-label="Better Magger">
      <svg
        class="brand__mark"
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 30V6h8l8 10L26 6h8v24h-8V18L18 28 10 18v12z"
          fill="currentColor"
        />
      </svg>
      <span class="brand__wordmark">
        better
        <span>
          magger<span class="brand__period">.</span>
        </span>
      </span>
    </div>
  );
}
