import { useState } from 'preact/hooks';
import type { KeyboardSession, LayoutKey } from '../../../core/types';
import { rgbToHex, textOn, type Rgb } from '../../lib/color';
import { setCached, useTable } from '../../state/cache';
import { save } from '../../state/toast';
import { KeyboardView } from '../KeyboardView';
import { LoadError } from '../LoadError';
import { SelectionToolbar } from '../SelectionToolbar';
import { Skeleton } from '../Skeleton';
import { ColorPicker } from './ColorPicker';

interface Props {
  session: KeyboardSession;
  profile: number;
  disabled: boolean;
}

/** Per-key RGB painter, used by the "Custom" effect. */
export function KeyPainter({ session: s, profile, disabled }: Props) {
  const colors = useTable('colors');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [paint, setPaint] = useState<Rgb>([0, 200, 255]);

  if (colors.error) return <LoadError message={colors.error} onRetry={colors.reload} />;
  const all = colors.data;
  if (!all) return <Skeleton keyboard lines={1} />;

  const write = (indices: number[], rgb: Rgb) => {
    const changes = indices.map((index) => ({ index, rgb }));
    const before = indices.map((index) => ({ index, rgb: all[index] }));
    const apply = async (list: typeof changes) => {
      await s.writeKeyColors(profile, list);
      const cur = all.slice();
      for (const c of list) cur[c.index] = c.rgb;
      setCached(profile, 'colors', cur);
    };
    void save('key colours', () => apply(changes), { undo: () => apply(before) });
  };

  const visual = (k: LayoutKey) => {
    if (k.index < 0) return {};
    const c = all[k.index];
    return { color: rgbToHex(c), textColor: textOn(c), title: rgbToHex(c) };
  };

  const everyKey = s.layout.keys.filter((k) => k.index >= 0).map((k) => k.index);

  return (
    <div class="painter">
      <KeyboardView layout={s.layout} selected={selected} onSelect={setSelected} multi visual={visual} ariaLabel="Per-key colours" />
      <SelectionToolbar layout={s.layout} selected={selected} onSelect={setSelected} />
      <div class="painter__controls">
        <ColorPicker id="paint-color" label="Paint colour" value={paint} onChange={setPaint} disabled={disabled} />
        <div class="btn-row">
          <button
            type="button"
            class="btn btn--primary"
            disabled={disabled || !selected.size}
            onClick={() => write([...selected], paint)}
          >
            Paint {selected.size || ''} selected
          </button>
          <button type="button" class="btn" disabled={disabled} onClick={() => write(everyKey, paint)}>
            Fill all keys
          </button>
        </div>
      </div>
    </div>
  );
}
