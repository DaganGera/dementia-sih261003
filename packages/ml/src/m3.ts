import { DOMAINS, STAGES, type Domain } from '@hillpath/contracts';
import type { AbilityModel } from './m1';

export const M3_VERSION = 'm3-kalman-bocpd-ts-0.1';

/** Standard normal CDF (Abramowitz and Stegun 7.1.26). */
export function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp((-x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Precision-weighted composite of the domain abilities. */
export function composite(m: AbilityModel): { mean: number; sd: number } {
  let sw = 0;
  let sm = 0;
  m.mu.forEach((mu, i) => {
    const w = 1 / m.cov[i]![i]!;
    sw += w;
    sm += w * mu;
  });
  return { mean: sm / sw, sd: Math.sqrt(1 / sw) };
}

/** Weekly slope priors by stage band, in ability units per week. Assumed values, tagged assumed. */
export const SLOPE_PRIOR: Record<number, { mean: number; sd: number }> = {
  0: { mean: 0, sd: 0.004 },
  1: { mean: -0.004, sd: 0.005 },
  2: { mean: -0.008, sd: 0.006 },
  3: { mean: -0.012, sd: 0.008 },
};

export interface WeeklyObs {
  week: number;
  value: number;
  sd: number;
}

export interface TrendState {
  level: number;
  slope: number;
  /** Covariance [[ll, ls], [ls, ss]]. */
  p: [[number, number], [number, number]];
  week: number;
  n: number;
}

export function initTrend(first: WeeklyObs, stage: number): TrendState {
  const sp = SLOPE_PRIOR[stage] ?? SLOPE_PRIOR[0]!;
  return { level: first.value, slope: sp.mean, p: [[first.sd ** 2 + 0.05, 0], [0, sp.sd ** 2]], week: first.week, n: 1 };
}

const Q_LEVEL = 0.004;
const Q_SLOPE = 1e-6;

function predict(s: TrendState, weeks: number): TrendState {
  let { level, slope, p } = s;
  for (let k = 0; k < weeks; k++) {
    level += slope;
    const [[ll, ls], [, ss]] = p;
    p = [
      [ll + 2 * ls + ss + Q_LEVEL, ls + ss],
      [ls + ss, ss + Q_SLOPE],
    ];
  }
  return { ...s, level, slope, p };
}

export function updateTrend(s: TrendState, o: WeeklyObs): TrendState {
  const pred = predict(s, Math.max(0, o.week - s.week));
  const r = o.sd ** 2 + 0.02;
  const [[ll, ls], [, ss]] = pred.p;
  const sInnov = ll + r;
  const kl = ll / sInnov;
  const ks = ls / sInnov;
  const resid = o.value - pred.level;
  return {
    level: pred.level + kl * resid,
    slope: pred.slope + ks * resid,
    p: [
      [(1 - kl) * ll, (1 - kl) * ls],
      [(1 - kl) * ls, ss - ks * ls],
    ],
    week: o.week,
    n: s.n + 1,
  };
}

export interface HorizonForecast {
  months: number;
  mean: number;
  low80: number;
  high80: number;
}

export function forecastHorizons(s: TrendState, months = [3, 6, 12]): HorizonForecast[] {
  return months.map((mo) => {
    const weeks = Math.round(mo * 4.345);
    const f = predict(s, weeks);
    const sd = Math.sqrt(f.p[0][0]);
    return { months: mo, mean: f.level, low80: f.level - 1.2816 * sd, high80: f.level + 1.2816 * sd };
  });
}

/** True when the personal slope is steeper than the stage's 90th percentile with posterior probability above 0.9. */
export function fasterThanTypical(s: TrendState, stage: number): boolean {
  const sp = SLOPE_PRIOR[stage] ?? SLOPE_PRIOR[0]!;
  const threshold = sp.mean - 1.2816 * sp.sd;
  const sd = Math.sqrt(s.p[1][1]);
  return s.n >= 8 && phi((threshold - s.slope) / sd) > 0.9;
}

/** Fewer than 8 weeks of data means the band is mostly the population prior. */
export const isPriorDominated = (s: TrendState) => s.n < 8;

// ---------- Bayesian online change-point detection ----------

export interface BocpdOptions {
  hazard?: number;
  obsVar?: number;
  priorMean?: number;
  priorVar?: number;
  maxRun?: number;
}

/** Probability, after each observation, that a change happened within the last 3 observations. */
export function bocpd(values: number[], o: BocpdOptions = {}): number[] {
  const hazard = o.hazard ?? 1 / 60;
  const obsVar = o.obsVar ?? 0.05;
  const maxRun = o.maxRun ?? 120;
  let mean = [o.priorMean ?? values[0] ?? 0];
  let pvar = [o.priorVar ?? 1];
  let probs = [1];
  const out: number[] = [];
  for (const x of values) {
    const pred = probs.map((_, r) => {
      const v = pvar[r]! + obsVar;
      return Math.exp(-((x - mean[r]!) ** 2) / (2 * v)) / Math.sqrt(2 * Math.PI * v);
    });
    const growth = probs.map((p, r) => p * pred[r]! * (1 - hazard));
    const cp = probs.reduce((s, p, r) => s + p * pred[r]! * hazard, 0);
    let next = [cp, ...growth];
    const z = next.reduce((a, b) => a + b, 0) || 1;
    next = next.map((p) => p / z);
    const nm = [o.priorMean ?? values[0] ?? 0];
    const nv = [o.priorVar ?? 1];
    for (let r = 0; r < mean.length; r++) {
      const post = 1 / (1 / pvar[r]! + 1 / obsVar);
      nm.push(post * (mean[r]! / pvar[r]! + x / obsVar));
      nv.push(post);
    }
    mean = nm.slice(0, maxRun);
    pvar = nv.slice(0, maxRun);
    probs = next.slice(0, maxRun);
    out.push(probs.slice(0, 3).reduce((a, b) => a + b, 0));
  }
  return out;
}

export function firstChange(values: number[], threshold = 0.5, options?: BocpdOptions): number {
  const p = bocpd(values, options);
  for (let i = 3; i < p.length; i++) if (p[i]! > threshold && p[i - 1]! > threshold) return i;
  return -1;
}

// ---------- Abrupt change path (delirium, stroke, acute illness) ----------

export interface DayValue {
  day: number;
  value: number;
}

export interface AcuteChecklist {
  sudden_confusion?: boolean;
  drowsiness?: boolean;
  agitation?: boolean;
  fever?: boolean;
  new_medicine?: boolean;
  fall?: boolean;
  poor_sleep?: boolean;
  not_drinking?: boolean;
  face_drooping?: boolean;
  arm_weakness?: boolean;
  speech_difficulty?: boolean;
}

export interface AbruptResult {
  flag: boolean;
  stroke: boolean;
  reasons: string[];
  domains: Domain[];
}

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1));
};

/**
 * A drop of more than 2 personal standard deviations in the last 3 days against the previous 3 weeks,
 * in 2 or more domains, or a caregiver report of sudden confusion, drowsiness or agitation.
 */
export function abruptChange(series: Partial<Record<Domain, DayValue[]>>, today: number, acute: AcuteChecklist = {}): AbruptResult {
  const reasons: string[] = [];
  const domains: Domain[] = [];
  for (const d of DOMAINS) {
    const s = series[d];
    if (!s) continue;
    const base = s.filter((x) => x.day >= today - 24 && x.day < today - 3).map((x) => x.value);
    const recent = s.filter((x) => x.day > today - 3 && x.day <= today).map((x) => x.value);
    if (base.length < 8 || recent.length < 1) continue;
    const personalSd = Math.max(sd(base), 0.15);
    if (mean(base) - mean(recent) > 2 * personalSd) domains.push(d);
  }
  if (domains.length >= 2) reasons.push('Scores dropped sharply in several areas within a few days.');
  if (acute.sudden_confusion || acute.drowsiness || acute.agitation) reasons.push('Sudden confusion, drowsiness or agitation was reported.');
  const stroke = Boolean(acute.face_drooping || acute.arm_weakness || acute.speech_difficulty);
  if (stroke) reasons.push('A possible stroke sign was reported.');
  return { flag: reasons.length > 0, stroke, reasons, domains };
}

/** Drop observations inside acute windows so an episode is never learned as progression. */
export function maskAcute<T extends { day: number }>(obs: T[], windows: Array<{ start: number; end: number }>): T[] {
  return obs.filter((o) => !windows.some((w) => o.day >= w.start && o.day <= w.end));
}

// ---------- Stage forecast with an assumed transition matrix ----------

/**
 * Annual stage transition matrix. ASSUMED illustrative values, not estimated from any dataset
 * (no dataset that needs an application is used). Rows sum to 1. Tagged assumed everywhere it is shown.
 */
export const ASSUMED_ANNUAL_TRANSITIONS: number[][] = [
  [0.94, 0.05, 0.009, 0.001],
  [0.1, 0.68, 0.19, 0.03],
  [0, 0.02, 0.72, 0.26],
  [0, 0, 0.02, 0.98],
];

/** Interpolates between "no change" and one year, so 3 and 6 months are valid probability rows too. */
export function stageForecast(probs: number[], months: number, matrix = ASSUMED_ANNUAL_TRANSITIONS): number[] {
  const t = Math.min(1, Math.max(0, months / 12));
  return STAGES.map((_, j) => probs.reduce((s, p, i) => s + p * ((1 - t) * (i === j ? 1 : 0) + t * matrix[i]![j]!), 0));
}
