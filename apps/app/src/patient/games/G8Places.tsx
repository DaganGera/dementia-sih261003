import { useEffect, useMemo, useRef, useState } from 'react';
import { listPlaces, listWords, wordId, type Place } from '../../lib/care';
import { VoiceAnswer } from '../../ui/VoiceAnswer';
import type { RoundProps } from './engine';

function PlaceImage({ place, size = 160 }: { place: Place; size?: number }) {
  if (place.thumb) return <img src={place.thumb} alt={`Photo of ${place.name}`} width={size} height={size} className="rounded-ctl object-cover" style={{ width: size, height: size }} />;
  return (
    <div role="img" aria-label={`Picture of ${place.name}`} className="flex items-center justify-center rounded-ctl bg-surface text-5xl font-bold" style={{ width: size, height: size }}>
      {place.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Where is this? A place the family has added. A wrong pick only names the right place. */
export function G8Places({ core, level, onDone, speak }: RoundProps) {
  const { options = 3, cue = 1 } = level.design;
  const places = useMemo(() => listPlaces(core), [core]);
  const place = useMemo(() => places[Math.floor(Math.random() * places.length)]!, [places]);
  const choices = useMemo(() => {
    const others = places.filter((p) => p.id !== place.id).sort(() => Math.random() - 0.5).slice(0, Math.max(1, options - 1));
    return [place, ...others].sort(() => Math.random() - 0.5);
  }, [places, place, options]);
  const [picked, setPicked] = useState<string | null>(null);
  const started = useRef(Date.now());
  const done = useRef(false);

  useEffect(() => {
    speak('Where is this?');
  }, [speak]);

  const pick = (p: Place, voice?: { latencyMs: number; pauseRatio: number }) => {
    if (done.current) return;
    done.current = true;
    setPicked(p.id);
    speak(`This is ${place.name}.`);
    window.setTimeout(() => onDone([{ correct: p.id === place.id, rt_ms: Date.now() - started.current, hint_used: cue >= 2, chance: 1 / choices.length, ...(voice ? { voice } : {}) }]), 2200);
  };
  const words = useMemo(() => listWords(core).filter((w) => choices.some((c) => wordId('place', c.id) === w.id)), [core, choices]);
  const labels = Object.fromEntries(choices.map((c) => [wordId('place', c.id), c.name]));

  const cueText = cue >= 2 ? `The name starts with ${place.name.slice(0, 1)}.` : cue === 1 ? `The name has ${place.name.length} letters.` : '';
  return (
    <section aria-label="Where is this">
      <div className="mb-4 flex justify-center">
        <PlaceImage place={place} />
      </div>
      <p className="mb-2 text-center text-2xl font-bold">Where is this?</p>
      {cueText && <p className="mb-4 text-center text-muted">{cueText}</p>}
      <ul className="flex flex-col gap-3">
        {choices.map((p) => (
          <li key={p.id}>
            <button type="button" className={`btn w-full ${picked !== null && p.id === place.id ? 'btn-primary' : ''}`} disabled={picked !== null && p.id !== place.id} onClick={() => pick(p)}>
              {p.name}
            </button>
          </li>
        ))}
      </ul>
      <VoiceAnswer
        words={words}
        labels={labels}
        disabled={picked !== null}
        onAnswer={(r) => {
          const p = choices.find((c) => wordId('place', c.id) === r.id);
          if (p) pick(p, { latencyMs: r.latencyMs, pauseRatio: r.pauseRatio });
        }}
      />
      {picked && (
        <p className="mt-4 text-center text-xl" role="status">
          This is {place.name}.
        </p>
      )}
    </section>
  );
}
