import { timingOf } from '@hillpath/audio';
import { Microphone } from '@phosphor-icons/react';
import { useState } from 'react';
import { recordUtterance } from '../audio/mic';
import type { AppCore } from '../lib/core';
import { saveTiming } from '../lib/care';
import { BigButton } from './kit';

/**
 * Optional: the person tells a story or a memory in their own words. Only three numbers are kept (time to start,
 * how long they spoke, share of pauses). The recording is dropped as soon as they are worked out.
 */
export function TimingCapture({ core, context, label = 'Tell it in your own words' }: { core: AppCore; context: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'listening' | 'thanks' | 'quiet' | 'error'>('idle');
  const go = async () => {
    setState('listening');
    try {
      const rec = await recordUtterance({ maxMs: 25_000, stopAfterSilenceMs: 2500, waitForSpeechMs: 8000 });
      const t = timingOf(rec.samples);
      if (!t) return setState('quiet');
      saveTiming(core, { at: Date.now(), context, latency_ms: Math.round(t.latencyMs), speech_ms: Math.round(t.speechMs), pause_ratio: Number(t.pauseRatio.toFixed(3)) });
      setState('thanks');
    } catch {
      setState('error');
    }
  };
  return (
    <div className="mt-4">
      {(state === 'idle' || state === 'quiet' || state === 'error') && (
        <BigButton className="btn-quiet w-full" onClick={() => void go()}>
          <Microphone size={32} aria-hidden />
          {label}
        </BigButton>
      )}
      {state === 'listening' && <p role="status" className="card">Listening. Take your time.</p>}
      {state === 'thanks' && <p role="status" className="card">Thank you for telling me.</p>}
      {state === 'quiet' && <p role="status" className="mt-2">I did not hear anything. That is fine.</p>}
      {state === 'error' && <p role="alert" className="mt-2">Hillpath cannot use the microphone. You can carry on without it.</p>}
    </div>
  );
}
