import { DOMAINS, type Domain, type GameId } from '@hillpath/contracts';
import { GAMES, type Level } from './games';
import { identity, normal, sigmoid, type Mat, type Vec } from './linalg';

export const M1_VERSION = 'm1-adf-ts-0.1';
export const TARGET_SUCCESS = 0.8;
export const DRIFT_PER_DAY = 0.002;

export interface AbilityModel {
  mu: Vec;
  cov: Mat;
  /** Completed sessions per game, for the practice term. */
  exposures: Partial<Record<GameId, number>>;
  rounds: number;
}

const D = DOMAINS.length;
const dIndex = (d: Domain) => DOMAINS.indexOf(d);

export function initialModel(prior = { shared: 0.25, own: 0.49 }): AbilityModel {
  const cov = identity(D, prior.own).map((row, i) => row.map((v, j) => v + (i === j ? prior.shared : prior.shared)));
  return { mu: Array<number>(D).fill(0), cov, exposures: {}, rounds: 0 };
}

/** Practice lowers apparent difficulty over the first sessions; it is discounted so it is not read as ability. */
export function practiceGain(sessions: number): number {
  return 0.4 * (1 - Math.exp(-sessions / 5));
}

export function successProbability(theta: number, level: Pick<Level, 'b' | 'chance'>, a: number, practice = 0): number {
  const s = sigmoid(a * (theta + practice - level.b));
  return level.chance + (1 - level.chance) * s;
}

/** Between-session drift: uncertainty grows with days since the last update. */
export function advanceDays(m: AbilityModel, days: number): AbilityModel {
  if (days <= 0) return m;
  const cov = m.cov.map((r, i) => r.map((v, j) => v + (i === j ? DRIFT_PER_DAY * days : 0)));
  return { ...m, cov };
}

/**
 * One assumed-density-filtering step for a single trial. The trial only depends on one domain,
 * so the update is a scalar Fisher-scoring solve followed by a conditional-Gaussian update of the rest.
 */
export function updateTrial(m: AbilityModel, gameId: GameId, level: Pick<Level, 'b' | 'chance'>, correct: boolean): AbilityModel {
  // A trial that cannot be failed (chance of 1, such as the last pair on a board) carries no information.
  if (level.chance >= 0.99) return { ...m, rounds: m.rounds + 1 };
  const g = GAMES[gameId];
  const d = dIndex(g.domain);
  const practice = practiceGain(m.exposures[gameId] ?? 0);
  const mean = m.mu[d]!;
  const s2 = m.cov[d]![d]!;
  const y = correct ? 1 : 0;
  let z = mean;
  let info = 0;
  for (let it = 0; it < 12; it++) {
    const s = sigmoid(g.a * (z + practice - level.b));
    const p = level.chance + (1 - level.chance) * s;
    const dp = (1 - level.chance) * g.a * s * (1 - s);
    const grad = -(z - mean) / s2 + ((y - p) / (p * (1 - p))) * dp;
    info = (dp * dp) / (p * (1 - p));
    const step = Math.max(-1, Math.min(1, grad / (1 / s2 + info)));
    z += step;
    if (Math.abs(step) < 1e-9) break;
  }
  const h = 1 / s2 + info;
  const v = 1 / h;
  const col = m.cov.map((r) => r[d]!);
  const gain = (z - mean) / s2;
  const mu = m.mu.map((x, i) => x + col[i]! * gain);
  const k = (v - s2) / (s2 * s2);
  const cov = m.cov.map((r, i) => r.map((x, j) => x + col[i]! * col[j]! * k));
  return { ...m, mu, cov, rounds: m.rounds + 1 };
}

export function isFiniteModel(m: AbilityModel): boolean {
  return m.mu.every(Number.isFinite) && m.cov.every((r, i) => r.every(Number.isFinite) && r[i]! > 0);
}

export function finishSession(m: AbilityModel, gameId: GameId): AbilityModel {
  return { ...m, exposures: { ...m.exposures, [gameId]: (m.exposures[gameId] ?? 0) + 1 } };
}

export function abilitySummary(m: AbilityModel): Record<Domain, { mean: number; sd: number }> {
  return Object.fromEntries(DOMAINS.map((dom, i) => [dom, { mean: m.mu[i]!, sd: Math.sqrt(m.cov[i]![i]!) }])) as Record<Domain, { mean: number; sd: number }>;
}

export interface Choice {
  index: number;
  level: Level;
  predicted: number;
  reason: string;
}

export interface ChooseInput {
  model: AbilityModel;
  gameId: GameId;
  lastIndex: number | null;
  /** Success rate of the previous round, if there was one. */
  lastRoundRate: number | null;
  rand: () => number;
  target?: number;
}

/** Thompson sampling over neighbouring levels with the errorless constraints from the plan. */
export function chooseLevel(i: ChooseInput): Choice {
  const g = GAMES[i.gameId];
  const d = dIndex(g.domain);
  const target = i.target ?? TARGET_SUCCESS;
  const practice = practiceGain(i.model.exposures[i.gameId] ?? 0);
  const theta = i.model.mu[d]! + Math.sqrt(i.model.cov[d]![d]!) * normal(i.rand);
  const last = i.lastIndex;
  const cold = i.model.rounds < 3 || last === null;
  const lo = cold ? 0 : Math.max(0, last - 1);
  const hi = cold ? Math.min(1, g.levels.length - 1) : Math.min(g.levels.length - 1, last + 1);
  let candidates = g.levels.map((level, index) => ({ level, index })).filter((c) => c.index >= lo && c.index <= hi);
  const p = (lv: Level) => successProbability(theta, lv, g.a, practice);
  if (i.lastRoundRate !== null && i.lastRoundRate < 0.6) {
    // After a hard round: never step up, and prefer a level with predicted success of 0.85 or more.
    const notUp = candidates.filter((c) => c.index <= (last ?? hi));
    const pool = notUp.length ? notUp : [candidates[0]!];
    const easier = pool.filter((c) => p(c.level) >= 0.85);
    candidates = easier.length ? easier : [pool[0]!];
  }
  let best = candidates[0]!;
  for (const c of candidates) {
    const gap = Math.abs(p(c.level) - target);
    const bestGap = Math.abs(p(best.level) - target);
    if (gap < bestGap - 1e-9) best = c;
  }
  const expected = successProbability(i.model.mu[d]!, best.level, g.a, practice);
  const tenths = Math.round(expected * 10);
  return {
    index: best.index,
    level: best.level,
    predicted: expected,
    reason: `Chose ${best.level.label} because recent rounds suggest about ${tenths} successes in 10 at this level.`,
  };
}
