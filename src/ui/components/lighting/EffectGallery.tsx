import { LIGHT_EFFECTS } from '../../../data/lighting';

interface Props {
  value: number;
  disabled: boolean;
  onChange: (id: number) => void;
}

/** Static diagrams describe structure, rather than pretending to simulate firmware animation. */
function patternLevel(id: number, x: number, y: number): number {
  const dx = x - 5.5,
    dy = y - 1.5;
  switch (id) {
    case 0:
      return (x + y * 2) % 4;
    case 1:
      return x % 4;
    case 2:
      return x <= y * 3 + 2 ? 3 : 0;
    case 3:
      return 3;
    case 4:
      return x > 2 && x < 9 ? 3 : 1;
    case 5:
      return x % 4 === y || x % 4 === 3 - y ? 3 : 0;
    case 6:
      return (x + y) % 5 < 2 ? 3 : 0;
    case 7:
      return y;
    case 8:
      return Math.abs(dx) <= y + 1 ? 3 - (y % 2) : 0;
    case 9:
      return (x * 7 + y * 11) % 9 > 5 ? 3 : 0;
    case 10:
      return dx > 0 === dy > 0 ? 3 : 1;
    case 11:
      return x < 3 + y * 2 ? 3 : 0;
    case 12:
      return Math.abs(dx + (y - 1.5) * 2) < 2 ? 3 : 0;
    case 13:
      return Math.round(Math.abs(dx) + Math.abs(dy)) % 3 === 0 ? 3 : 0;
    case 14:
      return Math.abs(dx) < 3 && Math.abs(dy) < 1 ? 3 : 1;
    case 15:
      return y === 1 && x >= 2 && x < 10 ? 3 : 0;
    case 16:
      return x % 3 === 0 || y === 0 || y === 3 ? 3 : 0;
    case 17:
      return x % 3 === 0 ? 3 : y > 1 ? 1 : 0;
    case 18:
      return x - y * 2 >= 0 && x - y * 2 < 4 ? 3 : 0;
    case 19:
      return (x * 3 + y) % 7 < 2 ? 3 - (y % 2) : 0;
    case 20:
      return (x * 13 + y * 7) % 17 < 3 ? 3 : 0;
    case 21:
      return Math.abs(dx) < 1 ||
        Math.abs(dx) === Math.abs(dy) ||
        (y === 1 && x % 2 === 0)
        ? 3
        : 0;
    case 22:
      return Math.floor(x / 3) === y ? 3 : 1;
    default:
      return 0;
  }
}

function EffectPattern({ id }: { id: number }) {
  const paths = ['', '', '', ''];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 12; x++) {
      paths[patternLevel(id, x, y)] += `M${x * 10 + 1},${y * 10 + 2}h8v6h-8Z`;
    }
  }
  return (
    <svg
      class="effect__pattern"
      viewBox="0 0 120 40"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d, level) => (
        <path
          key={level}
          d={d}
          fill="currentColor"
          opacity={[0.12, 0.35, 0.6, 1][level]}
        />
      ))}
    </svg>
  );
}

export function EffectGallery({ value, disabled, onChange }: Props) {
  return (
    <div class="effects" role="radiogroup" aria-label="Lighting effect">
      {LIGHT_EFFECTS.map((e) => (
        <label
          key={e.id}
          class={`effect effect--${e.id}${value === e.id ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
        >
          <input
            class="effect__radio"
            type="radio"
            name="lighting-effect"
            aria-label={e.name}
            checked={value === e.id}
            disabled={disabled}
            onChange={() => onChange(e.id)}
          />
          <span class="effect__meta" aria-hidden="true">
            <span>{String(e.id).padStart(2, '0')}</span>
            <span class="effect__indicator">{value === e.id ? 'On' : ''}</span>
          </span>
          <EffectPattern id={e.id} />
          <span class="effect__name">{e.name}</span>
        </label>
      ))}
    </div>
  );
}
