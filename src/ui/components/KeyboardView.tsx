import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { HTMLAttributes } from 'preact';
import type { Layout, LayoutKey } from '../../core/types';

export interface KeyVisual {
  label?: string;
  sub?: string;
  /** Background / text colour overrides (CSS colours). */
  color?: string;
  textColor?: string;
  className?: string;
  /** 0..1 live depth bar. */
  depth?: number;
  /** Extra text for screen readers / tooltip. */
  title?: string;
}

interface Props {
  layout: Layout;
  /** Selected protocol key indices. */
  selected: ReadonlySet<number>;
  onSelect?: (next: Set<number>) => void;
  /** Allow shift/ctrl multi-select and box select. */
  multi?: boolean;
  visual?: (key: LayoutKey) => KeyVisual;
  ariaLabel: string;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  additive: boolean;
}

const DRAG_THRESHOLD = 6;

/** Physical keyboard drawn from layout units; keys are buttons keyed by protocol index. */
export function KeyboardView({
  layout,
  selected,
  onSelect,
  multi = false,
  visual,
  ariaLabel,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const helpId = useId();
  const enabledKeys = layout.keys.filter((k) => k.index >= 0);
  const tabStop =
    enabledKeys.find((k) => k.id === focusedId)?.id ?? enabledKeys[0]?.id;
  const [box, setBox] = useState<Box | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    id: number;
    active: boolean;
    additive: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const unit = width / layout.width;
  const gap = Math.max(2, unit * 0.07);
  const fontSize = Math.min(14, Math.max(11, unit * 0.23));

  const select = (next: Set<number>) => onSelect?.(next);

  const onKeyClick = (key: LayoutKey, e: MouseEvent) => {
    if (suppressClick.current || key.index < 0) return;
    if (multi && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      const next = new Set(selected);
      if (next.has(key.index)) next.delete(key.index);
      else next.add(key.index);
      select(next);
    } else select(new Set([key.index]));
  };

  const local = (e: PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!multi || e.button !== 0 || e.pointerType === 'touch') return;
    suppressClick.current = false;
    const p = local(e);
    drag.current = {
      ...p,
      id: e.pointerId,
      active: false,
      additive: e.shiftKey || e.ctrlKey || e.metaKey,
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = local(e);
    if (!d.active) {
      if (Math.hypot(p.x - d.x, p.y - d.y) < DRAG_THRESHOLD) return;
      d.active = true;
      wrap.current!.setPointerCapture(e.pointerId);
    }
    setBox({ x0: d.x, y0: d.y, x1: p.x, y1: p.y, additive: d.additive });
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active || !box || unit <= 0) {
      setBox(null);
      return;
    }
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    const [l, r] = [
      Math.min(box.x0, box.x1) / unit,
      Math.max(box.x0, box.x1) / unit,
    ];
    const [t, b] = [
      Math.min(box.y0, box.y1) / unit,
      Math.max(box.y0, box.y1) / unit,
    ];
    const next = new Set(box.additive ? selected : []);
    for (const k of layout.keys) {
      if (k.index >= 0 && k.x < r && k.x + k.w > l && k.y < b && k.y + k.h > t)
        next.add(k.index);
    }
    setBox(null);
    if (wrap.current?.hasPointerCapture(e.pointerId))
      wrap.current.releasePointerCapture(e.pointerId);
    select(next);
  };

  /** One Tab stop; arrows explore spatially, Shift extends selection, Ctrl+A selects all. */
  const onKeyDown = (e: KeyboardEvent) => {
    if (!onSelect) return;
    if (multi && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      select(
        new Set(layout.keys.filter((k) => k.index >= 0).map((k) => k.index)),
      );
      return;
    }
    const dir = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key];
    const target = e.target as HTMLElement;
    const id = Number(target.dataset.keyId);
    if (Number.isNaN(id) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Home' || e.key === 'End') {
      const edge =
        e.key === 'Home' ? enabledKeys[0] : enabledKeys[enabledKeys.length - 1];
      if (edge) {
        e.preventDefault();
        wrap.current
          ?.querySelector<HTMLElement>(`[data-key-id="${edge.id}"]`)
          ?.focus();
      }
      return;
    }
    if (!dir) return;
    e.preventDefault();
    const from = layout.keys.find((k) => k.id === id);
    if (!from) return;
    const cx = from.x + from.w / 2;
    const cy = from.y + from.h / 2;
    let best: LayoutKey | null = null;
    let bestScore = Infinity;
    for (const k of enabledKeys) {
      const dx = k.x + k.w / 2 - cx;
      const dy = k.y + k.h / 2 - cy;
      const along = dx * dir[0] + dy * dir[1];
      if (along <= 0.1) continue;
      const score = along + 3 * Math.abs(dir[0] ? dy : dx);
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
    if (best) {
      wrap.current
        ?.querySelector<HTMLElement>(`[data-key-id="${best.id}"]`)
        ?.focus();
      if (multi && e.shiftKey)
        select(new Set([...selected, from.index, best.index]));
    }
  };

  return (
    <div class="keyboard-scroll">
      <div
        ref={wrap}
        class={`kbd${multi ? ' kbd--multi' : ''}`}
        style={{ height: `${layout.height * unit}px` }}
        role="group"
        aria-label={ariaLabel}
        aria-describedby={onSelect ? helpId : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setBox(null);
        }}
        onKeyDown={onKeyDown}
      >
        {onSelect && (
          <span id={helpId} class="visually-hidden">
            Use arrow keys to explore keys, Home and End to jump, and Enter or
            Space to select.
            {multi
              ? ' Hold Shift with arrows to select more keys. Control or Command plus A selects all keys.'
              : ''}
          </span>
        )}
        {unit > 0 &&
          layout.keys.map((k) => {
            const v = visual?.(k) ?? {};
            const isSel = selected.has(k.index);
            const label = v.label ?? k.label;
            const keyProps: Pick<
              HTMLAttributes<HTMLElement>,
              'class' | 'style' | 'aria-label' | 'title'
            > & { 'data-key-id': number } = {
              'data-key-id': k.id,
              class: `kbd__key${isSel ? ' is-selected' : ''}${k.index < 0 ? ' is-disabled' : ''}${v.className ? ` ${v.className}` : ''}`,
              style: {
                left: `${k.x * unit + gap / 2}px`,
                top: `${k.y * unit + gap / 2}px`,
                width: `${k.w * unit - gap}px`,
                height: `${k.h * unit - gap}px`,
                fontSize: `${fontSize}px`,
                ...(v.color ? { '--key-bg': v.color } : {}),
                ...(v.textColor ? { '--key-fg': v.textColor } : {}),
              },
              'aria-label': `${k.label}${label !== k.label ? `: ${label}` : ''}${v.sub ? `, ${v.sub}` : ''}${v.title ? `, ${v.title}` : ''}${isSel && !onSelect ? ', selected' : ''}`,
              title:
                v.title ??
                (label !== k.label ? `${k.label} → ${label}` : k.label),
            };
            const content = (
              <>
                <span class="kbd__label">{label}</span>
                {v.sub && <span class="kbd__sub">{v.sub}</span>}
                {v.depth !== undefined && (
                  <span
                    class="kbd__depth"
                    style={{ height: `${Math.round(v.depth * 100)}%` }}
                  />
                )}
              </>
            );
            return onSelect ? (
              <button
                {...keyProps}
                key={k.id}
                type="button"
                tabIndex={k.id === tabStop ? 0 : -1}
                onFocus={() => setFocusedId(k.id)}
                disabled={k.index < 0}
                aria-pressed={isSel}
                onClick={(e) => onKeyClick(k, e)}
              >
                {content}
              </button>
            ) : (
              <span {...keyProps} key={k.id} role="img">
                {content}
              </span>
            );
          })}
        {box && (
          <div
            class="kbd__box"
            style={{
              left: `${Math.min(box.x0, box.x1)}px`,
              top: `${Math.min(box.y0, box.y1)}px`,
              width: `${Math.abs(box.x1 - box.x0)}px`,
              height: `${Math.abs(box.y1 - box.y0)}px`,
            }}
          />
        )}
      </div>
    </div>
  );
}
