import { STAGES, type Stage, type StageEstimate } from '@hillpath/contracts';

export const M2_MAX_AGE_DAYS_FOR_INSTRUMENTS = 60;

export interface M2Model {
  version: string;
  maturity: 'Simulated';
  features: string[];
  mean: number[];
  scale: number[];
  beta: number[];
  thresholds: number[];
  temperature: number;
  norms: Record<string, { fluency: { mean: number; sd: number }; recall: { mean: number; sd: number } }>;
  conformal: { alpha: number; fallback: number; bands: Record<string, number> };
}

export interface InstrumentInput {
  age: number;
  schooling: number;
  literate: number;
  informant: number;
  adl: number;
  fluency: number;
  recall: number;
  orientation: number;
}

export interface CaveatFlags {
  /** Fewer than 3 instruments completed in the last 60 days. */
  tooFewInstruments?: boolean;
  noInformant?: boolean;
  acuteInLast14Days?: boolean;
  visionOrHearingProblem?: boolean;
  depressionScreenPositive?: boolean;
}

export function schoolingBand(years: number): string {
  if (years <= 0) return '0';
  if (years <= 4) return '1-4';
  if (years <= 9) return '5-9';
  return '10+';
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function featureVector(m: M2Model, x: InstrumentInput): Record<string, number> {
  const n = m.norms[schoolingBand(x.schooling)]!;
  return {
    age: x.age,
    informant: x.informant,
    adl: x.adl,
    orientation: x.orientation,
    fluency_z: (x.fluency - n.fluency.mean) / n.fluency.sd,
    recall_z: (x.recall - n.recall.mean) / n.recall.sd,
  };
}

export function stageProbabilities(m: M2Model, x: InstrumentInput): { probs: number[]; effects: Array<{ feature: string; effect: number }> } {
  const f = featureVector(m, x);
  const effects = m.features.map((name, i) => ({ feature: name, effect: ((f[name]! - m.mean[i]!) / m.scale[i]!) * m.beta[i]! }));
  const xb = effects.reduce((s, e) => s + e.effect, 0);
  const cum = [0, ...m.thresholds.map((t) => sigmoid((t - xb) / m.temperature)), 1];
  return { probs: cum.slice(1).map((c, i) => Math.max(1e-9, c - cum[i]!)), effects };
}

/** Largest nested interval around the mode whose mass is at most `mass` (always contains the mode). */
export function growInterval(probs: number[], mass: number): number[] {
  let lo = probs.indexOf(Math.max(...probs));
  let hi = lo;
  let m = probs[lo]!;
  while (lo > 0 || hi < probs.length - 1) {
    const left = lo > 0 ? probs[lo - 1]! : -1;
    const right = hi < probs.length - 1 ? probs[hi + 1]! : -1;
    const add = Math.max(left, right);
    if (m + add > mass + 1e-12) break;
    if (left >= right) lo -= 1;
    else hi += 1;
    m += add;
  }
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

export function abstainReason(c: CaveatFlags): string | null {
  if (c.acuteInLast14Days) return 'A recent sudden change was reported. Ask for a health check first.';
  if (c.tooFewInstruments) return 'Not enough checks in the last 60 days to show a range.';
  if (c.noInformant) return 'A family member who knows the person well is needed for this check.';
  if (c.visionOrHearingProblem) return 'Vision or hearing problems can lower scores. Please arrange those checks first.';
  return null;
}

/** Screening estimate. Never a diagnosis. Abstains, or shows the range only to clinicians, when confounders are present. */
export function estimateStage(m: M2Model, x: InstrumentInput, caveats: CaveatFlags, at: number): StageEstimate {
  const abstain = abstainReason(caveats);
  const { probs, effects } = stageProbabilities(m, x);
  const q = m.conformal.bands[schoolingBand(x.schooling)] ?? m.conformal.fallback;
  return {
    model_version: m.version,
    maturity: 'Simulated',
    at,
    probs,
    set: abstain ? [] : growInterval(probs, q),
    abstain,
    contributions: effects.filter((e) => Math.abs(e.effect) > 1e-9).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)),
  };
}

export const STAGE_LABELS: Record<Stage, string> = {
  no_impairment: 'no sign of impairment',
  mci_range: 'a mild change range (possible MCI)',
  mild_range: 'a mild dementia range',
  moderate_or_severe_range: 'a moderate or severe range',
};

export const stageName = (i: number): Stage => STAGES[i]!;
