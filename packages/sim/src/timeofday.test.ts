import { timeOfDay, type TimeSample } from '@hillpath/ml';
import { describe, expect, it } from 'vitest';
import { makePersona } from './persona';
import { runPersona } from './telemetry';

/** F24 (Simulated): the time-of-day view against S8_evening personas versus stable people. */
describe('time-of-day pattern in simulation', () => {
  const N = 30;

  const samplesOf = (days: ReturnType<typeof runPersona>['days']): TimeSample[] =>
    days.filter((d) => d.hour !== undefined && d.excess).map((d) => ({ hour: d.hour!, excess: Object.values(d.excess!)[0]! }));

  it('flags most simulated evening dippers over a season of play', () => {
    let hit = 0;
    for (let i = 0; i < N; i++) {
      const p = makePersona(i, 'S8_evening', 50, i % 3);
      const days = runPersona(p, { days: 120, policy: 'm1' }).days;
      if (timeOfDay(samplesOf(days)).eveningDip) hit += 1;
    }
    console.log(`S8 sensitivity: ${hit}/${N}`);
    expect(hit / N).toBeGreaterThanOrEqual(0.6);
  }, 120_000);

  it('rarely flags stable people who play at all hours', () => {
    let flagged = 0;
    for (let i = 0; i < N; i++) {
      const p = makePersona(i, 'S1_stable', 51, i % 3);
      const days = runPersona(p, { days: 120, policy: 'm1' }).days;
      if (timeOfDay(samplesOf(days)).eveningDip) flagged += 1;
    }
    console.log(`S1 false positives: ${flagged}/${N}`);
    expect(flagged / N).toBeLessThanOrEqual(0.15);
  }, 120_000);
});
