import { describe, expect, it } from 'vitest';
import { normal, rng } from './linalg';
import {
  abruptChange,
  ASSUMED_ANNUAL_TRANSITIONS,
  bocpd,
  fasterThanTypical,
  firstChange,
  forecastHorizons,
  initTrend,
  isPriorDominated,
  maskAcute,
  stageForecast,
  updateTrend,
  type DayValue,
} from './m3';

function series(days: number, slopePerDay: number, noise: number, seed: number, start = 0): DayValue[] {
  const r = rng(seed);
  return Array.from({ length: days }, (_, day) => ({ day, value: start + slopePerDay * day + noise * normal(r) }));
}

describe('Kalman trend', () => {
  it('recovers a declining slope and widens the band with the horizon', () => {
    const r = rng(5);
    let s = initTrend({ week: 0, value: 0, sd: 0.2 }, 1);
    for (let w = 1; w <= 40; w++) s = updateTrend(s, { week: w, value: -0.01 * w + 0.1 * normal(r), sd: 0.2 });
    expect(s.slope).toBeLessThan(-0.004);
    expect(s.slope).toBeGreaterThan(-0.02);
    const f = forecastHorizons(s);
    expect(f[2]!.high80 - f[2]!.low80).toBeGreaterThan(f[0]!.high80 - f[0]!.low80);
    expect(f[2]!.mean).toBeLessThan(f[0]!.mean);
  });

  it('flags prior-dominated forecasts before 8 weeks of data', () => {
    let s = initTrend({ week: 0, value: 0, sd: 0.2 }, 0);
    for (let w = 1; w < 5; w++) s = updateTrend(s, { week: w, value: 0, sd: 0.2 });
    expect(isPriorDominated(s)).toBe(true);
    for (let w = 5; w < 12; w++) s = updateTrend(s, { week: w, value: 0, sd: 0.2 });
    expect(isPriorDominated(s)).toBe(false);
  });

  it('does not call a stable person faster than typical', () => {
    const r = rng(9);
    let s = initTrend({ week: 0, value: 0, sd: 0.2 }, 1);
    for (let w = 1; w <= 30; w++) s = updateTrend(s, { week: w, value: 0.1 * normal(r), sd: 0.2 });
    expect(fasterThanTypical(s, 1)).toBe(false);
  });
});

describe('change detection', () => {
  it('finds a level shift soon after it happens', () => {
    const r = rng(21);
    const v = [...Array.from({ length: 50 }, () => 0.1 * normal(r)), ...Array.from({ length: 30 }, () => -1 + 0.1 * normal(r))];
    const at = firstChange(v, 0.5, { obsVar: 0.02 });
    expect(at).toBeGreaterThanOrEqual(50);
    expect(at).toBeLessThan(60);
  });

  it('stays quiet on a stable series', () => {
    let alarms = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = rng(seed * 13);
      const v = Array.from({ length: 180 }, () => 0.1 * normal(r));
      if (firstChange(v, 0.5, { obsVar: 0.02 }) >= 0) alarms += 1;
    }
    expect(alarms).toBeLessThanOrEqual(2);
  });

  it('gives probabilities', () => {
    for (const p of bocpd([0, 0.1, -0.1, 0.05])) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1.0000001);
    }
  });
});

describe('abrupt change path', () => {
  const stable = (seed: number) => series(40, 0, 0.1, seed);
  const dropped = (seed: number) => stable(seed).map((d) => (d.day >= 37 ? { ...d, value: d.value - 1.2 } : d));

  it('flags a sharp multi-domain drop and not a stable series', () => {
    const drop = { visual_memory: dropped(1), attention: dropped(2), verbal_memory: stable(3) };
    const r = abruptChange(drop, 39);
    expect(r.flag).toBe(true);
    expect(r.domains).toEqual(expect.arrayContaining(['visual_memory', 'attention']));
    const calm = abruptChange({ visual_memory: stable(4), attention: stable(5) }, 39);
    expect(calm.flag).toBe(false);
  });

  it('flags on a caregiver report and shows the stroke path separately', () => {
    expect(abruptChange({}, 10, { sudden_confusion: true }).flag).toBe(true);
    const s = abruptChange({}, 10, { face_drooping: true });
    expect(s.stroke).toBe(true);
    expect(abruptChange({}, 10, { poor_sleep: true }).flag).toBe(false);
  });

  it('keeps acute windows out of trend estimation', () => {
    const obs = Array.from({ length: 30 }, (_, day) => ({ day, value: day >= 10 && day <= 20 ? -2 : 0 }));
    const kept = maskAcute(obs, [{ start: 10, end: 20 }]);
    expect(kept).toHaveLength(19);
    expect(kept.every((o) => o.value === 0)).toBe(true);
  });
});

describe('stage forecast (assumed matrix)', () => {
  it('has rows that sum to 1 and forecasts that stay valid distributions', () => {
    for (const row of ASSUMED_ANNUAL_TRANSITIONS) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    for (const months of [0, 3, 6, 12]) {
      const p = stageForecast([0.2, 0.5, 0.25, 0.05], months);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
    expect(stageForecast([0.2, 0.5, 0.25, 0.05], 0)).toEqual([0.2, 0.5, 0.25, 0.05]);
  });
});
