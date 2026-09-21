import type { GameId } from '@hillpath/contracts';
import { describe, expect, it } from 'vitest';
import { GAMES } from './games';
import { rng } from './linalg';
import { abilitySummary, advanceDays, chooseLevel, finishSession, initialModel, isFiniteModel, successProbability, updateTrial } from './m1';

describe('M1 ability model', () => {
  it('moves the mean up after successes and down after failures, and shrinks uncertainty', () => {
    const lv = GAMES.G1.levels[3]!;
    const start = initialModel();
    const up = updateTrial(start, 'G1', lv, true);
    const down = updateTrial(start, 'G1', lv, false);
    expect(up.mu[0]!).toBeGreaterThan(0);
    expect(down.mu[0]!).toBeLessThan(0);
    expect(up.cov[0]![0]!).toBeLessThan(start.cov[0]![0]!);
    expect(up.cov[0]![0]!).toBeGreaterThan(0);
  });

  it('shares information across domains through the common factor', () => {
    let m = initialModel();
    const lv = GAMES.G1.levels[2]!;
    for (let i = 0; i < 6; i++) m = updateTrial(m, 'G1', lv, true);
    expect(m.mu[1]!).toBeGreaterThan(0);
    expect(m.mu[1]!).toBeLessThan(m.mu[0]!);
  });

  it('keeps the covariance symmetric and positive over many updates', () => {
    let m = initialModel();
    const r = rng(7);
    for (let i = 0; i < 400; i++) {
      const gid = (['G1', 'G2', 'G3', 'G4', 'G7'] as const)[i % 5]!;
      const lv = GAMES[gid].levels[Math.floor(r() * GAMES[gid].levels.length)]!;
      m = updateTrial(m, gid, lv, r() < 0.7);
    }
    for (let i = 0; i < 5; i++) {
      expect(m.cov[i]![i]!).toBeGreaterThan(0);
      for (let j = 0; j < 5; j++) expect(Math.abs(m.cov[i]![j]! - m.cov[j]![i]!)).toBeLessThan(1e-9);
    }
  });

  it('grows uncertainty with days between sessions', () => {
    const m = initialModel();
    expect(advanceDays(m, 14).cov[0]![0]!).toBeGreaterThan(m.cov[0]![0]!);
    expect(advanceDays(m, 0)).toBe(m);
  });

  it('respects the errorless constraints in 1,000 randomised rounds', () => {
    const r = rng(11);
    let m = initialModel();
    const last: Partial<Record<GameId, number>> = {};
    const lastRate: Partial<Record<GameId, number>> = {};
    const ids = ['G1', 'G2', 'G3', 'G4', 'G7'] as const;
    for (let round = 0; round < 1000; round++) {
      const gid = ids[round % 5]!;
      const prev = last[gid] ?? null;
      const prevRate = lastRate[gid] ?? null;
      const c = chooseLevel({ model: m, gameId: gid, lastIndex: prev, lastRoundRate: prevRate, rand: r });
      if (prev !== null && m.rounds >= 3) {
        expect(Math.abs(c.index - prev)).toBeLessThanOrEqual(1);
        if (prevRate !== null && prevRate < 0.6) expect(c.index).toBeLessThanOrEqual(prev);
      }
      const ok = r() < c.predicted;
      m = updateTrial(m, gid, c.level, ok);
      if (round % 5 === 4) m = finishSession(m, gid);
      last[gid] = c.index;
      lastRate[gid] = ok ? 1 : 0;
    }
    expect(abilitySummary(m).attention.sd).toBeLessThan(1);
  });

  it('starts easy and explains itself in plain words', () => {
    const c = chooseLevel({ model: initialModel(), gameId: 'G1', lastIndex: null, lastRoundRate: null, rand: rng(3) });
    expect(c.index).toBeLessThanOrEqual(1);
    expect(c.reason).toMatch(/successes in 10/);
    expect(c.reason).not.toMatch(/[–—]/);
  });

  it('ignores trials that cannot be failed and never produces NaN', () => {
    const m = initialModel();
    const same = updateTrial(m, 'G1', { b: 0, chance: 1 }, true);
    expect(same.mu).toEqual(m.mu);
    expect(same.cov).toEqual(m.cov);
    let x = m;
    for (const chance of [0.98, 0.5, 0.05, 0.9]) for (const ok of [true, false]) x = updateTrial(x, 'G1', { b: 3, chance }, ok);
    expect(isFiniteModel(x)).toBe(true);
  });

  it('gives success probabilities between chance and 1', () => {
    const lv = GAMES.G2.levels[0]!;
    for (const th of [-4, 0, 4]) {
      const p = successProbability(th, lv, GAMES.G2.a);
      expect(p).toBeGreaterThanOrEqual(lv.chance);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});
