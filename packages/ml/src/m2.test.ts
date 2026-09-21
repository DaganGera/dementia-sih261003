import { describe, expect, it } from 'vitest';
import model from '../models/m2/m2-ordinal-sim-0.1.json';
import { abruptMessage, explainForFamily } from './m4';
import { estimateStage, growInterval, stageProbabilities, type M2Model } from './m2';

const m = model as unknown as M2Model & { fixtures: Array<{ x: Parameters<typeof stageProbabilities>[1]; probs: number[]; set: number[] }> };

describe('M2 evaluator parity with the Python export', () => {
  it('reproduces 50 Python fixtures to 1e-6', () => {
    expect(m.fixtures.length).toBe(50);
    for (const fx of m.fixtures) {
      const { probs } = stageProbabilities(m, fx.x);
      probs.forEach((p, i) => expect(Math.abs(p - fx.probs[i]!)).toBeLessThan(1e-6));
    }
  });

  it('gives the same conformal sets as Python for every fixture', () => {
    for (const fx of m.fixtures) {
      const e = estimateStage(m, fx.x, {}, 0);
      expect(e.set).toEqual(fx.set);
    }
  });

  it('is fast enough for a low-end phone', () => {
    const t = performance.now();
    for (let i = 0; i < 2000; i++) estimateStage(m, m.fixtures[i % 50]!.x, {}, 0);
    expect((performance.now() - t) / 2000).toBeLessThan(5);
  });
});

describe('M2 safety behaviour', () => {
  const x = m.fixtures[0]!.x;
  it('abstains with a reason when an acute change was reported, and shows no range', () => {
    const e = estimateStage(m, x, { acuteInLast14Days: true }, 0);
    expect(e.set).toEqual([]);
    expect(e.abstain).toMatch(/health check/);
  });

  it('always tags results Simulated and never uses diagnosis wording', () => {
    const e = estimateStage(m, x, {}, 0);
    expect(e.maturity).toBe('Simulated');
    const text = JSON.stringify(explainForFamily(e)).toLowerCase();
    expect(text).not.toMatch(/you have|diagnos(is|ed) as|is fine|nothing wrong/);
    expect(text).toContain('not a diagnosis');
    expect(text).not.toMatch(new RegExp('[\\u2013\\u2014]'));
  });

  it('grows intervals only up to the mass limit', () => {
    expect(growInterval([0.1, 0.6, 0.2, 0.1], 0)).toEqual([1]);
    expect(growInterval([0.1, 0.6, 0.2, 0.1], 0.8)).toEqual([1, 2]);
    expect(growInterval([0.1, 0.6, 0.2, 0.1], 1)).toEqual([0, 1, 2, 3]);
  });

  it('sends stroke signs to 108 and other sudden change to a same-day check', () => {
    expect(abruptMessage(true)).toContain('108');
    expect(abruptMessage(false)).toContain('today');
  });
});
