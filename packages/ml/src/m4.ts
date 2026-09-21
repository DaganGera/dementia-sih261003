import type { StageEstimate } from '@hillpath/contracts';
import { STAGE_LABELS, stageName } from './m2';

/**
 * Plain-language explanations. Wording rules: never "diagnosis", never "you have", never reassurance.
 * English only in this build; other languages are Planned.
 */
const FEATURE_TEXT: Record<string, { later: string; earlier: string }> = {
  informant: {
    later: 'Family answers suggest more change in memory and thinking than ten years ago.',
    earlier: 'Family answers suggest little change from ten years ago.',
  },
  adl: {
    later: 'Daily tasks seem to need more help than before.',
    earlier: 'Daily tasks seem to be managed without extra help.',
  },
  fluency_z: {
    later: 'Naming animals was harder than for most people with similar schooling.',
    earlier: 'Naming animals went well compared with people with similar schooling.',
  },
  recall_z: {
    later: 'Remembering words after a break was harder than for most people with similar schooling.',
    earlier: 'Remembering words after a break went well compared with people with similar schooling.',
  },
  orientation: {
    later: 'Some answers about the day and place were uncertain.',
    earlier: 'Answers about the day and place were mostly sure.',
  },
  age: {
    later: 'Age is taken into account.',
    earlier: 'Age is taken into account.',
  },
};

export interface FamilyExplanation {
  headline: string;
  reasons: string[];
  action: string;
}

export function explainForFamily(e: StageEstimate): FamilyExplanation {
  if (e.abstain) return { headline: 'No range is shown right now.', reasons: [e.abstain], action: 'Please arrange a check with a doctor or health worker.' };
  const names = e.set.map((i) => STAGE_LABELS[stageName(i)]);
  const headline = `Answers look similar to people in ${names.length > 1 ? `${names[0]} to ${names[names.length - 1]}` : names[0]}. This is a screening estimate, not a diagnosis.`;
  const reasons = e.contributions
    .filter((c) => c.feature !== 'age')
    .slice(0, 3)
    .map((c) => FEATURE_TEXT[c.feature]?.[c.effect > 0 ? 'later' : 'earlier'])
    .filter((t): t is string => Boolean(t));
  const worse = e.set.some((i) => i >= 1);
  return {
    headline,
    reasons,
    action: worse ? 'Please arrange a check with a doctor or health worker.' : 'No changes were found in these activities. This is not a medical check.',
  };
}

export interface ClinicianRow {
  feature: string;
  effect: number;
}

export function explainForClinician(e: StageEstimate): { probs: Array<{ stage: string; p: number }>; set: string[]; contributions: ClinicianRow[]; note: string } {
  return {
    probs: e.probs.map((p, i) => ({ stage: stageName(i), p })),
    set: e.set.map((i) => stageName(i)),
    contributions: e.contributions.map((c) => ({ feature: c.feature, effect: c.effect })),
    note: `Model ${e.model_version}, ${e.maturity}. Trained on simulator output only. Not validated for use with tablet-delivered instruments.`,
  };
}

export function abruptMessage(stroke: boolean): string {
  if (stroke) return 'Call 108 now. Face drooping, arm weakness or trouble speaking can be signs of a stroke.';
  return 'A sudden change like this can have a treatable cause, such as an infection, dehydration or a medicine side effect. Please arrange a health check today.';
}
