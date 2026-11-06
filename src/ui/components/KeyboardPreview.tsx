import { getLayoutDef } from '../../data/layouts';

const layout = getLayoutDef('K68');

/** A static schematic from the actual keyboard geometry, never connected to hardware. */
export function KeyboardPreview() {
  const unit = 34;
  const pad = 18;
  const width = layout.width * unit + pad * 2;
  const height = layout.height * unit + pad * 2;
  return (
    <div class="keyboard-preview">
      <div class="keyboard-preview__label">
        <span>Magger / 68</span>
        <span>Hall effect keyboard</span>
      </div>
      <div class="keyboard-preview__case">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Magger68 keyboard layout, with W, A, S and D highlighted as an example"
        >
          {layout.keys.map((k) => {
            const highlighted = ['W', 'A', 'S', 'D'].includes(k.label);
            return (
              <g
                key={k.id}
                class={
                  highlighted ? 'preview-key is-highlighted' : 'preview-key'
                }
              >
                <rect
                  x={pad + k.x * unit + 2}
                  y={pad + k.y * unit + 2}
                  width={k.w * unit - 4}
                  height={k.h * unit - 4}
                  rx="3"
                />
                <text
                  x={pad + (k.x + k.w / 2) * unit}
                  y={pad + (k.y + k.h / 2) * unit + 3}
                  text-anchor="middle"
                >
                  {k.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div class="keyboard-preview__edge">
          <span class="preview-dot" />
          <span>better magger</span>
          <span>Made for the way you play.</span>
        </div>
      </div>
      <div class="keyboard-preview__caption">
        <span class="index-label">01 / A familiar layout</span>
        <p>Pick the key. Make it yours.</p>
        <span class="preview-caption-line" aria-hidden="true" />
      </div>
    </div>
  );
}
