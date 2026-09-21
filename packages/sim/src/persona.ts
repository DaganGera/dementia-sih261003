import { DOMAINS, type Domain } from '@hillpath/contracts';
import { normal, rng } from '@hillpath/ml';

/**
 * Simulated people. Every number here is an assumed value, not fitted to any dataset.
 * All output carries `synthetic: true`.
 */
export const SIM_VERSION = 'sim-0.1';

export type Scenario = 'S1_stable' | 'S2_slow' | 'S3_fast' | 'S4_depression' | 'S5_delirium' | 'S6_hearing' | 'S7_nonadherent' | 'S8_evening';
export const SCENARIOS: Scenario[] = ['S1_stable', 'S2_slow', 'S3_fast', 'S4_depression', 'S5_delirium', 'S6_hearing', 'S7_nonadherent', 'S8_evening'];

/** Stage index: 0 none, 1 MCI range, 2 mild range, 3 moderate or severe range. */
export interface Persona {
  id: string;
  age: number;
  schooling: number;
  literate: boolean;
  stage: number;
  /** Latent ability per domain on the game scale, before schooling shift. */
  theta0: Record<Domain, number>;
  /** Weekly decline on the ability scale. */
  slopePerWeek: number;
  scenario: Scenario;
  /** Day the acute episode starts (S5 only). */
  episodeStart: number;
  episodeLength: number;
  seed: number;
}

const STAGE_MEAN = [0.3, -0.5, -1.2, -2.0];
const SLOPE = [0, -0.004, -0.008, -0.012];

export function makePersona(index: number, scenario: Scenario, seed: number, stage?: number): Persona {
  const r = rng(seed * 7919 + index);
  const st = stage ?? [0, 0, 1, 1, 2, 3][Math.floor(r() * 6)]!;
  const schooling = [0, 0, 2, 5, 8, 10, 12][Math.floor(r() * 7)]!;
  const shared = normal(r) * 0.4;
  const theta0 = Object.fromEntries(DOMAINS.map((d) => [d, STAGE_MEAN[st]! + shared + normal(r) * 0.5])) as Record<Domain, number>;
  const rateScale = scenario === 'S2_slow' ? 1 : scenario === 'S3_fast' ? 3 : 1;
  return {
    id: `sim-${scenario}-${index}`,
    age: 62 + Math.floor(r() * 30),
    schooling,
    literate: schooling >= 5,
    stage: st,
    theta0,
    slopePerWeek: scenario === 'S1_stable' ? 0 : SLOPE[st]! * rateScale,
    scenario,
    episodeStart: 60 + Math.floor(r() * 60),
    episodeLength: 7 + Math.floor(r() * 24),
    seed: seed * 104729 + index,
  };
}

/** Domain ability for a persona on a given day, including scenario effects. */
export function abilityOn(p: Persona, domain: Domain, day: number): number {
  let theta = p.theta0[domain] + (p.slopePerWeek * day) / 7;
  if (p.scenario === 'S4_depression') theta -= 0.3;
  if (p.scenario === 'S5_delirium' && day >= p.episodeStart && day < p.episodeStart + p.episodeLength) {
    const into = day - p.episodeStart;
    const depth = 2.8 * Math.max(0, 1 - Math.max(0, into - 2) / p.episodeLength);
    theta -= depth;
  }
  if (p.scenario === 'S6_hearing' && (domain === 'verbal_memory' || domain === 'associative_memory')) theta -= 0.6;
  return theta;
}

/** Sessions played on a day: adherence and time-of-day effects. */
export function playsOn(p: Persona, day: number, r: () => number): boolean {
  const base = p.scenario === 'S7_nonadherent' ? 0.25 : p.scenario === 'S4_depression' ? 0.5 : 0.75;
  return r() < base;
}
