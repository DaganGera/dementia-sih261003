import { rng } from '@hillpath/ml';
import { describe, expect, it } from 'vitest';
import { comparePolicies } from './eval';
import { instrumentsFor } from './instruments';
import { abilityOn, makePersona } from './persona';
import { runPersona } from './telemetry';

describe('simulator', () => {
  it('is reproducible and marks every trial synthetic', () => {
    const p = makePersona(1, 'S2_slow', 3);
    const a = runPersona(p, { days: 20, policy: 'm1' });
    const b = runPersona(p, { days: 20, policy: 'm1' });
    expect(JSON.stringify(a.days)).toBe(JSON.stringify(b.days));
    const trials = a.days.flatMap((d) => d.trials);
    expect(trials.length).toBeGreaterThan(10);
    expect(trials.every((t) => t.synthetic)).toBe(true);
  });

  it('injects the delirium episode and recovers after it', () => {
    const p = makePersona(2, 'S5_delirium', 4, 1);
    const before = abilityOn(p, 'attention', p.episodeStart - 1);
    const during = abilityOn(p, 'attention', p.episodeStart + 3);
    const after = abilityOn(p, 'attention', p.episodeStart + p.episodeLength + 5);
    expect(during).toBeLessThan(before - 1);
    expect(after).toBeGreaterThan(during + 1);
  });

  it('makes instrument scores worse at later stages on average', () => {
    const r = rng(2);
    const mean = (stage: number) => {
      let s = 0;
      for (let i = 0; i < 300; i++) s += instrumentsFor(makePersona(i, 'S1_stable', 9, stage), r).recall;
      return s / 300;
    };
    expect(mean(0)).toBeGreaterThan(mean(1));
    expect(mean(1)).toBeGreaterThan(mean(2));
    expect(mean(2)).toBeGreaterThan(mean(3));
  });

  it('keeps more rounds in the target band than the old threshold rule (AT-04, Simulated)', () => {
    const c = comparePolicies(24, 60, 'logistic', 5);
    expect(c.diff.mean).toBeGreaterThan(0);
    expect(c.diff.low).toBeGreaterThan(0);
  }, 60_000);

  it('still helps when the response form is wrong (probit check)', () => {
    const c = comparePolicies(24, 60, 'probit', 6);
    expect(c.diff.mean).toBeGreaterThan(0);
  }, 60_000);
});
