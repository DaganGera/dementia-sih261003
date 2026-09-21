import { DOMAINS, type GameId, type Trial } from '@hillpath/contracts';
import { chooseLevel, finishSession, GAMES, initialModel, normal, rng, successProbability, thresholdNext, updateTrial, type AbilityModel } from '@hillpath/ml';
import { abilityOn, playsOn, type Persona } from './persona';

export type ResponseFamily = 'logistic' | 'probit';

/** Probit link with a different slope, used to test M1 when its own model form is wrong. */
function trueSuccess(theta: number, level: { b: number; chance: number }, a: number, family: ResponseFamily): number {
  if (family === 'logistic') return successProbability(theta, level, a);
  const z = 0.9 * a * (theta - level.b - 0.15);
  const cdf = 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3)));
  return level.chance + (1 - level.chance) * cdf;
}

export interface DayLog {
  day: number;
  rounds: number;
  successes: number;
  inBand: number;
  trials: Trial[];
}

export interface RunOptions {
  days: number;
  policy: 'm1' | 'threshold' | 'fixed';
  family?: ResponseFamily;
  sessionsPerDay?: number;
}

export interface RunResult {
  days: DayLog[];
  model: AbilityModel;
  /** RMSE between M1 mean and true ability, per checkpoint round count. */
  errors: Array<{ rounds: number; rmse: number }>;
  frustration: number;
  sessions: number;
}

const ORDER: GameId[] = ['G1', 'G2', 'G3', 'G4', 'G7'];
const ROUNDS_PER_SESSION = 5;

/** Play a persona forward. Trials use the true ability; M1 never sees it. */
export function runPersona(p: Persona, o: RunOptions): RunResult {
  const r = rng(p.seed);
  const family = o.family ?? 'logistic';
  let model = initialModel();
  const idx: Partial<Record<GameId, number>> = {};
  const lastRate: Partial<Record<GameId, number>> = {};
  const sessionAcc: Partial<Record<GameId, number>> = {};
  const days: DayLog[] = [];
  const errors: RunResult['errors'] = [];
  let frustration = 0;
  let sessions = 0;
  let rounds = 0;
  const fixedIndex = 3;

  for (let day = 0; day < o.days; day++) {
    const log: DayLog = { day, rounds: 0, successes: 0, inBand: 0, trials: [] };
    days.push(log);
    if (!playsOn(p, day, r)) continue;
    const gid = ORDER[(sessions + Math.floor(r() * 5)) % ORDER.length]!;
    const game = GAMES[gid];
    const domain = game.domain;
    const sessionId = `${p.id}-d${day}`;
    let streak = 0;
    let sessionSuccesses = 0;
    // The old engine changes level once per session, from that game's previous session accuracy.
    const sessionIndex =
      sessionAcc[gid] === undefined
        ? Math.min(1, game.levels.length - 1)
        : thresholdNext(sessionAcc[gid]! * 100, idx[gid] ?? 1, game.levels.length - 1);
    for (let round = 0; round < ROUNDS_PER_SESSION; round++) {
      const prev = idx[gid] ?? null;
      let index: number;
      if (o.policy === 'm1') {
        index = chooseLevel({ model, gameId: gid, lastIndex: prev, lastRoundRate: lastRate[gid] ?? null, rand: r }).index;
      } else if (o.policy === 'fixed') {
        index = Math.min(fixedIndex, game.levels.length - 1);
      } else {
        index = sessionIndex;
      }
      const level = game.levels[index]!;
      const theta = abilityOn(p, domain, day);
      const prob = trueSuccess(theta + 0.4 * (1 - Math.exp(-(model.exposures[gid] ?? 0) / 5)), level, game.a, family);
      const correct = r() < prob;
      log.rounds += 1;
      rounds += 1;
      if (correct) {
        log.successes += 1;
        sessionSuccesses += 1;
      }
      if (prob >= 0.75 && prob <= 0.85) log.inBand += 1;
      streak = correct ? 0 : streak + 1;
      if (streak === 3) frustration += 1;
      log.trials.push({
        session_id: sessionId,
        idx: round,
        game_id: gid,
        domain,
        design: level.design,
        difficulty: level.b,
        chance: level.chance,
        correct,
        rt_ms: Math.round(1400 + 500 * (level.b + 2) + (p.stage * 300) + 250 * normal(r)),
        hint_used: false,
        input_mode: 'tap',
        synthetic: true,
      });
      model = updateTrial(model, gid, level, correct);
      idx[gid] = index;
      lastRate[gid] = correct ? 1 : 0;
      if (rounds % 20 === 0) {
        const se = DOMAINS.reduce((s, d, i) => s + (model.mu[i]! - abilityOn(p, d, day)) ** 2, 0) / DOMAINS.length;
        errors.push({ rounds, rmse: Math.sqrt(se) });
      }
    }
    model = finishSession(model, gid);
    sessionAcc[gid] = sessionSuccesses / ROUNDS_PER_SESSION;
    sessions += 1;
  }
  return { days, model, errors, frustration, sessions };
}
