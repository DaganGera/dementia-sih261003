import { normal } from '@hillpath/ml';
import type { Persona } from './persona';

/**
 * Instrument analogues for M2. Distributions are ASSUMED, chosen so adjacent stages overlap
 * (a person-level effect moves every test together) and lower scores go with later stage and with less schooling.
 * They are not fitted to any dataset. Schooling shifts the raw scores of the cognitive tasks, not the stage.
 */
export interface InstrumentRow {
  age: number;
  schooling: number;
  literate: number;
  informant: number;
  adl: number;
  fluency: number;
  recall: number;
  orientation: number;
}

export const FEATURES = ['age', 'schooling', 'literate', 'informant', 'adl', 'fluency', 'recall', 'orientation'] as const;
export type FeatureName = (typeof FEATURES)[number];

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function instrumentsFor(p: Persona, r: () => number, weekOffset = 0): InstrumentRow {
  const drift = p.slopePerWeek * weekOffset;
  const s = p.stage;
  const schoolShift = Math.min(p.schooling, 12) / 12;
  const g = normal(r);
  const informant = clamp(2.9 + 0.38 * s + 0.55 * normal(r) - 0.15 * g - drift * 6, 1, 5);
  const adl = clamp(Math.round(0.6 + 1.0 * s + 1.3 * normal(r) - 0.35 * g - drift * 6), 0, 8);
  const fluency = clamp(Math.round(19 - 3.0 * s + 3 * schoolShift + 3.6 * normal(r) + 2.2 * g + drift * 30), 0, 40);
  const recall = clamp(Math.round(6.5 - 1.2 * s + 1 * schoolShift + 1.6 * normal(r) + 0.8 * g + drift * 10), 0, 10);
  const orientation = clamp(Math.round(3.8 - 0.55 * s + 0.65 * normal(r) + 0.25 * g), 0, 4);
  return { age: p.age, schooling: p.schooling, literate: p.literate ? 1 : 0, informant, adl, fluency, recall, orientation };
}
