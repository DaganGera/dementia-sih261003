import { Microphone } from '@phosphor-icons/react';
import { decide, timingOf, type EnrolledWord } from '@hillpath/audio';
import { useState } from 'react';
import { recordUtterance } from '../audio/mic';
import { BigButton } from './kit';

export interface VoiceResult {
  id: string;
  latencyMs: number;
  pauseRatio: number;
}

type State = { kind: 'idle' } | { kind: 'listening' } | { kind: 'confirm'; id: string; latencyMs: number; pauseRatio: number } | { kind: 'nothing' } | { kind: 'error'; message: string };

/**
 * Answer by voice with words the family enrolled. The device only says what it heard, and the person or family confirms
 * with a tap. It never decides alone, and tapping the answer always works.
 */
export function VoiceAnswer({ words, labels, disabled, onAnswer }: { words: EnrolledWord[]; labels: Record<string, string>; disabled?: boolean; onAnswer: (r: VoiceResult) => void }) {
  const [s, setS] = useState<State>({ kind: 'idle' });
  if (words.length === 0) return null;

  const listen = async () => {
    setS({ kind: 'listening' });
    try {
      const rec = await recordUtterance({ maxMs: 6000, stopAfterSilenceMs: 800, waitForSpeechMs: 4500 });
      const d = decide(words, rec.samples);
      const t = timingOf(rec.samples);
      if (d.match && t) setS({ kind: 'confirm', id: d.match, latencyMs: t.latencyMs, pauseRatio: t.pauseRatio });
      else setS({ kind: 'nothing' });
    } catch {
      setS({ kind: 'error', message: 'Hillpath cannot use the microphone. You can tap your answer instead.' });
    }
  };

  return (
    <div className="mt-4" data-testid="voice-answer">
      {(s.kind === 'idle' || s.kind === 'nothing' || s.kind === 'error') && (
        <BigButton className="btn-quiet w-full" onClick={() => void listen()} disabled={disabled}>
          <Microphone size={32} aria-hidden />
          Say the name
        </BigButton>
      )}
      {s.kind === 'listening' && <p role="status" className="card">Listening. Say the name now.</p>}
      {s.kind === 'nothing' && <p role="status" className="mt-2">I did not catch that. You can try again, or tap.</p>}
      {s.kind === 'error' && <p role="alert" className="mt-2">{s.message}</p>}
      {s.kind === 'confirm' && (
        <div role="status" className="card">
          <p className="text-xl">I heard: <strong>{labels[s.id] ?? s.id}</strong>. Is that right?</p>
          <div className="mt-3 flex gap-3">
            <BigButton primary onClick={() => onAnswer({ id: s.id, latencyMs: s.latencyMs, pauseRatio: s.pauseRatio })}>Yes</BigButton>
            <BigButton onClick={() => setS({ kind: 'idle' })}>No, I will tap</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
