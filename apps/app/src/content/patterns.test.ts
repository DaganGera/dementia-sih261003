import { describe, expect, it } from 'vitest';
import { makeWeave, tileKey } from './patterns';

describe('pattern weave generator', () => {
  const rand = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  it('always has exactly one correct option, unique options, and the requested counts', () => {
    for (let s = 1; s <= 200; s++) {
      const length = 3 + (s % 4);
      const motifs = 2 + (s % 3);
      const options = 2 + (s % 3);
      const w = makeWeave(length, motifs, options, rand(s));
      expect(w.shown).toHaveLength(length - 1);
      expect(w.options).toHaveLength(options);
      expect(new Set(w.options.map(tileKey)).size).toBe(options);
      expect(w.options.filter((o) => tileKey(o) === tileKey(w.answer))).toHaveLength(1);
    }
  });

  it('the answer continues the repeating rule of the tiles shown', () => {
    for (let s = 1; s <= 200; s++) {
      const w = makeWeave(6, 3, 3, rand(s));
      const seq = [...w.shown, w.answer].map(tileKey);
      // Some period p up to 4 must reproduce the whole sequence.
      const ok = [2, 3, 4, 5].some((p) => seq.every((k, i) => i < p || k === seq[i - p]));
      expect(ok, seq.join(' ')).toBe(true);
    }
  });
});
