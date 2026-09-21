import { rng } from '@hillpath/ml';
import { makePersona, type Scenario } from './persona';
import { runPersona, type ResponseFamily, type RunResult } from './telemetry';

export interface PolicyStats {
  inBandShare: number;
  successRate: number;
  frustrationPerSession: number;
}

function stats(r: RunResult): PolicyStats {
  const rounds = r.days.reduce((s, d) => s + d.rounds, 0) || 1;
  return {
    inBandShare: r.days.reduce((s, d) => s + d.inBand, 0) / rounds,
    successRate: r.days.reduce((s, d) => s + d.successes, 0) / rounds,
    frustrationPerSession: r.frustration / Math.max(1, r.sessions),
  };
}

export interface Comparison {
  n: number;
  family: ResponseFamily;
  m1: PolicyStats;
  threshold: PolicyStats;
  fixed: PolicyStats;
  /** Paired difference in in-band share (M1 minus threshold), with a 95% bootstrap interval. */
  diff: { mean: number; low: number; high: number };
  /** Paired difference in frustration events per session (threshold minus M1). */
  frustrationDiff: { mean: number; low: number; high: number };
  rmse: Record<number, number>;
}

function bootstrap(values: number[], seed: number): { mean: number; low: number; high: number } {
  const r = rng(seed);
  const means: number[] = [];
  for (let b = 0; b < 1000; b++) {
    let s = 0;
    for (let i = 0; i < values.length; i++) s += values[Math.floor(r() * values.length)]!;
    means.push(s / values.length);
  }
  means.sort((a, b) => a - b);
  return { mean: values.reduce((a, b) => a + b, 0) / values.length, low: means[25]!, high: means[974]! };
}

const avg = (xs: PolicyStats[]): PolicyStats => ({
  inBandShare: xs.reduce((s, x) => s + x.inBandShare, 0) / xs.length,
  successRate: xs.reduce((s, x) => s + x.successRate, 0) / xs.length,
  frustrationPerSession: xs.reduce((s, x) => s + x.frustrationPerSession, 0) / xs.length,
});

/** Same personas, three policies. The simulator is not evidence about real people. */
export function comparePolicies(n: number, days: number, family: ResponseFamily, seed = 1): Comparison {
  const scenarios: Scenario[] = ['S1_stable', 'S2_slow', 'S3_fast'];
  const m1s: PolicyStats[] = [];
  const ths: PolicyStats[] = [];
  const fxs: PolicyStats[] = [];
  const rmse: Record<number, number[]> = { 20: [], 50: [], 100: [] };
  for (let i = 0; i < n; i++) {
    const p = makePersona(i, scenarios[i % 3]!, seed);
    const a = runPersona(p, { days, policy: 'm1', family });
    m1s.push(stats(a));
    ths.push(stats(runPersona(p, { days, policy: 'threshold', family })));
    fxs.push(stats(runPersona(p, { days, policy: 'fixed', family })));
    for (const e of a.errors) if (e.rounds in rmse) rmse[e.rounds]!.push(e.rmse);
  }
  const m = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  return {
    n,
    family,
    m1: avg(m1s),
    threshold: avg(ths),
    fixed: avg(fxs),
    diff: bootstrap(m1s.map((x, i) => x.inBandShare - ths[i]!.inBandShare), seed + 1),
    frustrationDiff: bootstrap(ths.map((x, i) => x.frustrationPerSession - m1s[i]!.frustrationPerSession), seed + 2),
    rmse: { 20: m(rmse[20]!), 50: m(rmse[50]!), 100: m(rmse[100]!) },
  };
}

export function reportM1(c: Comparison[]): string {
  const f = (x: number) => x.toFixed(3);
  const rows = c
    .map(
      (x) =>
        `| ${x.family} | ${x.n} | ${f(x.m1.inBandShare)} | ${f(x.threshold.inBandShare)} | ${f(x.fixed.inBandShare)} | ${f(x.diff.mean)} (${f(x.diff.low)} to ${f(x.diff.high)}) | ${f(x.frustrationDiff.mean)} (${f(x.frustrationDiff.low)} to ${f(x.frustrationDiff.high)}) | ${f(x.rmse[20]!)} / ${f(x.rmse[50]!)} / ${f(x.rmse[100]!)} |`,
    )
    .join('\n');
  return `# M1 evaluation (Simulated)

Maturity: Simulated. Personas are synthetic. The logistic family matches the model's own form, so it flatters M1; the probit family is a misspecified check. Neither is evidence about real people.

In band means the true success probability of a round was between 0.75 and 0.85.

| Response family | Personas | M1 in band | Threshold in band | Fixed level in band | Paired in-band difference, M1 minus threshold (95% bootstrap) | Frustration events per session saved, threshold minus M1 (95% bootstrap) | Ability RMSE at 20 / 50 / 100 rounds |
|---|---|---|---|---|---|---|---|
${rows}
`;
}
