import { Question } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { makeWeave, tileKey, tileLabel } from '../../content/patterns';
import { TileSvg } from '../../ui/TileSvg';
import type { RoundProps } from './engine';

/** Finish a pattern of tiles. A wrong pick shows the tile that completes it and nothing else. */
export function G6Weave({ level, onDone, speak }: RoundProps) {
  const { length = 4, motifs = 2, options = 3 } = level.design;
  const weave = useMemo(() => makeWeave(length, motifs, options, Math.random), [length, motifs, options]);
  const [picked, setPicked] = useState<string | null>(null);
  const started = useRef(Date.now());

  useEffect(() => {
    speak('Look at the pattern. Which tile comes next?');
  }, [speak]);

  const pick = (k: string) => {
    if (picked) return;
    setPicked(k);
    window.setTimeout(() => onDone([{ correct: k === tileKey(weave.answer), rt_ms: Date.now() - started.current, hint_used: false, chance: 1 / weave.options.length }]), k === tileKey(weave.answer) ? 1200 : 2800);
  };

  return (
    <section aria-label="Pattern weave">
      <p className="mb-4 text-2xl font-bold">Which tile comes next?</p>
      <ol className="mb-6 flex flex-wrap items-center gap-2" aria-label="The pattern so far">
        {weave.shown.map((t, i) => (
          <li key={i} aria-label={tileLabel(t)}>
            <TileSvg tile={t} size={56} />
          </li>
        ))}
        <li aria-label="The missing tile" className="flex size-14 items-center justify-center rounded-input border-2 border-dashed border-line">
          {picked ? <TileSvg tile={weave.answer} size={52} /> : <Question size={32} aria-hidden />}
        </li>
      </ol>
      <ul className="flex flex-wrap gap-3">
        {weave.options.map((t) => {
          const k = tileKey(t);
          const right = picked !== null && k === tileKey(weave.answer);
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => pick(k)}
                disabled={picked !== null && !right}
                aria-label={tileLabel(t)}
                className={`rounded-ctl border-2 p-2 ${right ? 'border-accent' : 'border-line'}`}
                style={{ minWidth: 64, minHeight: 64 }}
              >
                <TileSvg tile={t} size={64} />
              </button>
            </li>
          );
        })}
      </ul>
      {picked && picked !== tileKey(weave.answer) && (
        <p className="card mt-4" role="status">
          This tile completes the pattern.
        </p>
      )}
    </section>
  );
}
