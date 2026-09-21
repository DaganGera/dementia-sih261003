import { useEffect, useMemo, useRef, useState } from 'react';
import { listFaces, type Face } from '../../lib/care';
import type { RoundProps } from './engine';

export function Avatar({ face, size = 160 }: { face: Face; size?: number }) {
  if (face.thumb) return <img src={face.thumb} alt={`Photo of ${face.name}`} width={size} height={size} className="rounded-ctl object-cover" style={{ width: size, height: size }} />;
  return (
    <div role="img" aria-label={`Picture of ${face.name}`} className="flex items-center justify-center rounded-ctl bg-surface text-5xl font-bold" style={{ width: size, height: size }}>
      {face.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

/**
 * Who is this? A wrong pick never shows a cross: the right name is shown warmly and the person
 * comes back a little later (spaced retrieval), so the answer is learned without failure.
 */
export function G2Faces({ core, level, onDone, speak }: RoundProps) {
  const { options = 3, cue = 1 } = level.design;
  const faces = useMemo(() => listFaces(core), [core]);
  const person = useMemo(() => faces[Math.floor(Math.random() * faces.length)]!, [faces]);
  const choices = useMemo(() => {
    const others = faces.filter((f) => f.id !== person.id).sort(() => Math.random() - 0.5).slice(0, Math.max(1, options - 1));
    return [person, ...others].sort(() => Math.random() - 0.5);
  }, [faces, person, options]);
  const [picked, setPicked] = useState<string | null>(null);
  const started = useRef(Date.now());
  const done = useRef(false);

  useEffect(() => {
    speak('Who is this?');
  }, [speak]);

  const pick = (f: Face) => {
    if (done.current) return;
    done.current = true;
    setPicked(f.id);
    const correct = f.id === person.id;
    speak(`This is ${person.name}${person.relation ? `, your ${person.relation}` : ''}.`);
    window.setTimeout(() => onDone([{ correct, rt_ms: Date.now() - started.current, hint_used: cue >= 2, chance: 1 / choices.length }]), 2200);
  };

  const cueText = cue >= 2 ? `The name starts with ${person.name.slice(0, 1)}.` : cue === 1 && person.relation ? `This is someone in your family: your ${person.relation}.` : '';
  return (
    <section aria-label="Who is this">
      <div className="mb-4 flex justify-center">
        <Avatar face={person} />
      </div>
      <p className="mb-2 text-center text-2xl font-bold">Who is this?</p>
      {cueText && <p className="mb-4 text-center text-muted">{cueText}</p>}
      <ul className="flex flex-col gap-3">
        {choices.map((f) => {
          const isRight = f.id === person.id;
          const revealed = picked !== null;
          return (
            <li key={f.id}>
              <button
                type="button"
                className={`btn w-full ${revealed && isRight ? 'btn-primary' : ''}`}
                disabled={revealed && !isRight}
                onClick={() => pick(f)}
              >
                {f.name}
              </button>
            </li>
          );
        })}
      </ul>
      {picked && (
        <p className="mt-4 text-center text-xl" role="status">
          This is {person.name}{person.relation ? `, your ${person.relation}` : ''}.
        </p>
      )}
    </section>
  );
}
