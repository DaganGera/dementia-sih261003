import { useEffect, useMemo, useRef, useState } from 'react';
import { ROUTINES } from '../../content/items';
import type { RoundProps, TrialResult } from './engine';

/** What comes next? Each step is one trial. A wrong pick only reveals the right step, so the routine is rehearsed without failing. */
export function G4Routine({ level, onDone, speak }: RoundProps) {
  const { steps = 3, options = 2, hint = 2 } = level.design;
  const routine = useMemo(() => ROUTINES[Math.floor(Math.random() * ROUTINES.length)]!, []);
  const total = Math.min(steps, routine.steps.length);
  const list = useMemo(() => routine.steps.slice(0, total), [routine, total]);
  const [done, setDone] = useState(1);
  const [picked, setPicked] = useState<number | null>(null);
  const results = useRef<TrialResult[]>([]);
  const startedAt = useRef(Date.now());

  const choices = useMemo(() => {
    const correct = done;
    const pool = list.map((_, i) => i).filter((i) => i > done && i !== correct);
    const extra = (pool.length >= options - 1 ? pool : list.map((_, i) => i).filter((i) => i !== correct)).sort(() => Math.random() - 0.5).slice(0, options - 1);
    return [correct, ...extra].sort(() => Math.random() - 0.5);
  }, [done, list, options]);

  useEffect(() => {
    startedAt.current = Date.now();
    speak(done === 1 ? `${routine.title}. First: ${list[0]!.label}. What comes next?` : 'What comes next?');
  }, [done, routine, list, speak]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    results.current.push({ correct: i === done, rt_ms: Date.now() - startedAt.current, hint_used: hint >= 2, chance: 1 / choices.length });
    window.setTimeout(() => {
      setPicked(null);
      if (done + 1 >= total) onDone(results.current);
      else setDone(done + 1);
    }, i === done ? 900 : 2600);
  };

  const shownChain = hint >= 2 ? list.slice(0, done) : list.slice(done - 1, done);
  return (
    <section aria-label={routine.title}>
      <h2 className="mb-3">{routine.title}</h2>
      <ol className="mb-4 flex flex-col gap-2">
        {shownChain.map((s, i) => (
          <li key={s.label} className="card flex items-center gap-3 py-3">
            <s.Icon size={36} aria-hidden />
            <span>{hint >= 2 ? i + 1 : done}. {s.label}</span>
          </li>
        ))}
      </ol>
      <p className="mb-2 text-2xl font-bold">What comes next?</p>
      <ul className="flex flex-col gap-3">
        {choices.map((i) => {
          const s = list[i]!;
          const revealRight = picked !== null && i === done;
          return (
            <li key={i}>
              <button type="button" className={`btn w-full justify-start ${revealRight ? 'btn-primary' : ''}`} disabled={picked !== null && i !== done} onClick={() => pick(i)} aria-label={s.label}>
                <s.Icon size={36} aria-hidden />
                {hint >= 1 && <span>{s.label}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null && picked !== done && (
        <p className="card mt-4" role="status">
          Next comes: {list[done]!.label}.
        </p>
      )}
    </section>
  );
}
