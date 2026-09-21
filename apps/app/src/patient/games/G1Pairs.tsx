import { Question } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pickItems, type Item } from '../../content/items';
import type { RoundProps, TrialResult } from './engine';

interface Card {
  key: number;
  item: Item;
}

/** One board is one round. Every attempt (two flips) is one trial. A miss turns back slowly, with no sound. */
export function G1Pairs({ level, onDone, speak }: RoundProps) {
  const { pairs = 3, similarity = 0, preview_s = 4 } = level.design;
  const cards = useMemo<Card[]>(() => {
    const items = pickItems(pairs, similarity, Math.random);
    const deck = [...items, ...items].map((item, i) => ({ key: i, item }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    return deck;
  }, [pairs, similarity]);
  const [previewing, setPreviewing] = useState(true);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [hint, setHint] = useState<string | null>(null);
  const trials = useRef<TrialResult[]>([]);
  const misses = useRef(0);
  const lastAt = useRef(Date.now());
  const hintUsed = useRef(false);

  useEffect(() => {
    speak('Look at the pictures. Then find the pairs.');
    const t = window.setTimeout(() => {
      setPreviewing(false);
      lastAt.current = Date.now();
    }, preview_s * 1000);
    return () => window.clearTimeout(t);
  }, [preview_s, speak]);

  const flip = (key: number) => {
    if (previewing || open.length === 2 || open.includes(key)) return;
    const card = cards.find((c) => c.key === key)!;
    if (matched.has(card.item.id)) return;
    const next = [...open, key];
    setOpen(next);
    if (next.length < 2) return;
    const [a, b] = next.map((k) => cards.find((c) => c.key === k)!) as [Card, Card];
    const remaining = cards.filter((c) => !matched.has(c.item.id)).length;
    const correct = a.item.id === b.item.id;
    trials.current.push({ correct, rt_ms: Date.now() - lastAt.current, hint_used: hintUsed.current, chance: 1 / Math.max(1, remaining - 1) });
    hintUsed.current = false;
    lastAt.current = Date.now();
    if (correct) {
      misses.current = 0;
      const m = new Set(matched).add(a.item.id);
      setMatched(m);
      setOpen([]);
      setHint(null);
      if (m.size === pairs) window.setTimeout(() => onDone(trials.current), 900);
    } else {
      misses.current += 1;
      if (misses.current >= 2) {
        const target = cards.find((c) => !matched.has(c.item.id))!;
        setHint(target.item.id);
        hintUsed.current = true;
      }
      window.setTimeout(() => setOpen([]), 1500);
    }
  };

  const cols = cards.length <= 4 ? 2 : cards.length <= 6 ? 3 : 4;
  return (
    <section aria-label="Pairs board">
      <p className="mb-4">{previewing ? 'Look carefully at the pictures.' : 'Find two that are the same.'}</p>
      <ul className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cards.map((c) => {
          const shown = previewing || open.includes(c.key) || matched.has(c.item.id);
          const glow = hint === c.item.id || matched.has(c.item.id);
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => flip(c.key)}
                aria-label={shown ? c.item.label : 'Hidden card'}
                className={`flex aspect-square w-full items-center justify-center rounded-ctl border-2 ${glow ? 'border-accent bg-surface' : 'border-line bg-bg'}`}
                style={{ minHeight: 64 }}
              >
                {shown ? <c.item.Icon size={56} weight="duotone" aria-hidden /> : <Question size={48} aria-hidden className="text-muted" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
