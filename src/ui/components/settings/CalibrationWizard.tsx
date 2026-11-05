import { useEffect, useRef, useState } from 'preact/hooks';
import type { KeyboardSession, LayoutKey } from '../../../core/types';
import { useTravelEvents } from '../../hooks/useTravelEvents';
import { save } from '../../state/toast';
import { KeyboardView } from '../KeyboardView';

type Step = 'intro' | 'running' | 'done';

/** start → press every key fully and slowly (live progress) → finish. */
export function CalibrationWizard({ session: s }: { session: KeyboardSession }) {
  const [step, setStep] = useState<Step>('intro');
  const samples = useTravelEvents(s, step === 'running', true);
  const keys = s.layout.keys.filter((k) => k.index >= 0);
  const threshold = 0.85 * s.model.features.travel.maxRaw;
  const done = (k: LayoutKey) => {
    const x = samples.get(k.index);
    return !!x && (x.raw >= threshold || !!x.calibrationStatus);
  };
  const count = keys.filter(done).length;

  // Leaving the page mid-calibration must not leave the keyboard in calibration mode.
  const running = useRef(false);
  running.current = step === 'running';
  useEffect(() => () => void (running.current && s.endCalibration().catch(() => undefined)), []);

  const start = async () => {
    if (await save('calibration start', () => s.startCalibration(), { success: 'Calibration started' })) setStep('running');
  };
  const finish = async () => {
    if (await save('calibration', () => s.endCalibration(), { success: 'Calibration saved' })) setStep('done');
  };

  if (step === 'intro' || step === 'done') {
    return (
      <div class="calibration">
        {step === 'done' && <p class="notice notice--success">Calibration finished. Your keys now measure travel accurately.</p>}
        <p class="help">
          Calibrate after changing switches or if keys feel inconsistent. It takes about a minute. Don't type anything else
          meanwhile.
        </p>
        <button type="button" class="btn" onClick={() => void start()}>
          {step === 'done' ? 'Calibrate again' : 'Start calibration'}
        </button>
      </div>
    );
  }

  return (
    <div class="calibration">
      <ol class="tips">
        <li>Press <b>every key</b> all the way down, <b>slowly</b>, then let it come back up.</li>
        <li>Keys turn green once they've been pressed fully.</li>
        <li>Click <b>Finish</b> when you've done them all.</li>
      </ol>
      <KeyboardView
        layout={s.layout}
        selected={new Set()}
        visual={(k) => (k.index >= 0 && done(k) ? { className: 'is-done' } : {})}
        ariaLabel="Calibration progress"
      />
      <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={keys.length} aria-valuenow={count} aria-label="Keys calibrated">
        <span style={{ width: `${keys.length ? (100 * count) / keys.length : 0}%` }} />
      </div>
      <p class="help">
        {samples.size ? `${count} of ${keys.length} keys pressed fully` : 'Waiting for key presses… (some models don\'t report progress; just press every key)'}
      </p>
      <div class="btn-row">
        <button type="button" class="btn btn--primary" onClick={() => void finish()}>
          Finish
        </button>
      </div>
    </div>
  );
}
