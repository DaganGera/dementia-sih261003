/** Everything a doctor needs on one page. Built on the family phone and never sent anywhere without consent. */
export interface ReportInput {
  generatedAt: number;
  patient: { id: string; name: string; age: number; schoolingYears: number };
  carerName: string;
  author: { deviceId: string; role: string };
  /** Screening range from the simulated model, or null when no range is shown. */
  stage: {
    modelVersion: string;
    maturity: 'Simulated';
    probs: number[];
    setLabels: string[];
    abstain: string | null;
    contributions: Array<{ feature: string; effect: number }>;
  } | null;
  instruments: {
    at: number;
    informant: number;
    adl: number;
    fluency: number;
    recall: number;
    orientation: number;
    visionHearingProblem: boolean;
    moodScreenPositive: boolean;
    acute: string[];
  } | null;
  abilities: Array<{ area: string; mean: number; low: number; high: number }>;
  forecast: Array<{ months: number; mean: number; low80: number; high80: number }> | null;
  forecastNote: string | null;
  alerts: Array<{ tier: string; text: string; at: number }>;
  adherence: { scheduled: number; taken: number; unconfirmed: number };
  activity: { sessionsThisWeek: number; daysActive: number; memoriesAndMusic: number };
  speech: { samples: number; meanPauseRatio: number } | null;
  reversibleCausesNote: string;
}

export const STAGE_ORDER = ['no_impairment', 'mci_range', 'mild_range', 'moderate_or_severe_range'] as const;

export const CAVEATS = [
  'Screening estimate from a simulated model trained on synthetic data only. Not validated on real patients. Not a diagnosis.',
  'The family and task questions are Hillpath\'s own items, not a validated instrument.',
  'Scores are affected by mood, sleep, illness, vision, hearing and schooling. Consider reversible causes as part of a standard work-up.',
];

export const REVERSIBLE_NOTE = 'Reversible causes such as infection, dehydration, medicine effects, thyroid or B12 problems, depression and sensory loss should be considered as part of a standard work-up. Hillpath does not test for them.';
