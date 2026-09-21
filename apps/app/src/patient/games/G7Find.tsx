import { useEffect, useMemo, useRef, useState } from 'react';
import { pickItems } from '../../content/items';
import type { RoundProps, TrialResult } from './engine';

/** Find one thing among several. The first tap is the trial. Wrong taps only dim the tile, and three misses make the target pulse gently. */
export function G7Find({ level, onDone, speak }: RoundProps) {
  const { set_size = 6, similarity = 0 } = level.design;
  const items = useMemo(() => pickItems(set_size, similarity, Math.random), [set_size, similarity]);
  const target = useMemo(() => items[Math.floor(Math.random() * items.length)]!, [items]);
  const [dim, setDim] = useState<Set<string>>(new Set());
  const [found, setFound] = useState(false);
  const started = useRef(Date.now());
  const first = useRef<TrialResult | null>(null);
  const misses = useRef(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    speak(`Find the ${target.label}.`);
  }, [speak, target]);

  const tap = (id: string) => {
    if (found) return;
    if (!first.current) first.current = { correct: id === target.id, rt_ms: Date.now() - started.current, hint_used: false, chance: 1 / items.length };
    if (id === target.id) {
      setFound(true);
      window.setTimeout(() => onDone([first.current!]), 900);
    } else {
      misses.current += 1;
      setDim(new Set(dim).add(id));
      if (misses.current >= 3) {
        setPulse(true);
        first.current.hint_used = true;
      }
    }
  };

  const cols = items.length <= 6 ? 3 : items.length <= 12 ? 4 : 5;
  return (
    <section aria-label="Find the picture">
      <p className="mb-4 text-2xl font-bold" aria-live="polite">
        {found ? `Yes. That is the ${target.label}.` : `Find the ${target.label}.`}
      </p>
      {misses.current > 0 && !found && <p className="mb-4 text-muted">Let us look again.</p>}
      <ul className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => tap(it.id)}
              aria-label={it.label}
              className={`flex aspect-square w-full items-center justify-center rounded-ctl border-2 ${found && it.id === target.id ? 'border-accent bg-surface' : 'border-line bg-bg'} ${pulse && it.id === target.id && !found ? 'border-accent' : ''}`}
              style={{ minHeight: 64, opacity: dim.has(it.id) ? 0.35 : 1 }}
            >
              <it.Icon size={48} weight="duotone" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
