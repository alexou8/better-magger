import type { DeviceModel, KeyAction } from '../../../core/types';
import { DKS_PHASES, type DksCell, type DksRow } from '../../lib/dks';
import { ActionField } from './ActionField';

export interface DksLine {
  action: KeyAction;
  row: DksRow;
}

interface Props {
  model: DeviceModel;
  lines: DksLine[];
  onChange: (lines: DksLine[]) => void;
}

const NEXT: Record<DksCell, DksCell> = { off: 'tap', tap: 'hold', hold: 'off' };
const TEXT: Record<DksCell, string> = { off: '', tap: 'Tap', hold: 'Hold' };

/** 4 actions × 4 phases. Each cell cycles off → tap → hold; adjacent holds form one long press. */
export function DksGrid({ model, lines, onChange }: Props) {
  const set = (i: number, patch: Partial<DksLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div class="dks-grid" role="table" aria-label="DKS actions per phase">
      <div class="dks-grid__row dks-grid__head" role="row">
        <span role="columnheader">Action</span>
        {DKS_PHASES.map((p, i) => (
          <span role="columnheader" key={p.name} title={p.help}>
            {i + 1}. {p.name}
            <small>{p.help}</small>
          </span>
        ))}
      </div>
      {lines.map((line, i) => (
        <div class="dks-grid__row" role="row" key={i}>
          <span role="cell">
            <ActionField model={model} label={`Action ${i + 1}`} action={line.action} clearable onChange={(action) => set(i, { action })} />
          </span>
          {line.row.map((cell, p) => (
            <span role="cell" key={p}>
              <button
                type="button"
                class={`dks-cell dks-cell--${cell}${line.row[p - 1] === 'hold' && cell === 'hold' ? ' dks-cell--cont' : ''}`}
                aria-label={`Action ${i + 1}, ${DKS_PHASES[p].name}: ${cell === 'off' ? 'nothing' : TEXT[cell]}. Click to change`}
                onClick={() => {
                  const row = [...line.row] as DksRow;
                  row[p] = NEXT[cell];
                  set(i, { row });
                }}
              >
                {TEXT[cell]}
              </button>
            </span>
          ))}
        </div>
      ))}
      <p class="help">
        <b>Tap</b> = press and release at that moment. <b>Hold</b> on neighbouring phases = keep the action held from the first to the last one.
      </p>
    </div>
  );
}
