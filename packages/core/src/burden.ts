/**
 * Caregiver check-in. Six plain questions written for Hillpath. It is NOT a validated scale (no Zarit or similar was
 * licensed) and it is never a diagnosis. Answers stay on the device of the person who gave them and are not shared.
 */

export interface BurdenItem {
  id: string;
  text: string;
}

export const BURDEN_ITEMS: readonly BurdenItem[] = [
  { id: 'tired', text: 'I feel worn out at the end of the day because of caring.' },
  { id: 'time', text: 'I have too little time for myself.' },
  { id: 'unwell', text: 'I worry about what would happen if I became unwell.' },
  { id: 'keepup', text: 'I feel I cannot keep up with everything that is needed.' },
  { id: 'alone', text: 'I feel alone with this.' },
  { id: 'low', text: 'I feel low or anxious on most days.' },
];

export const BURDEN_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Sometimes' },
  { value: 2, label: 'Often' },
  { value: 3, label: 'Almost always' },
];

export const BURDEN_NOTE = 'These six questions were written for Hillpath. They are not a validated scale and not a diagnosis. Your answers stay on this phone and are not shared with the family circle, the doctor report or the relay.';

export type BurdenBand = 'steady' | 'stretched' | 'strained';

export interface BurdenResult {
  at: number;
  answers: number[];
  total: number;
  band: BurdenBand;
}

export const BURDEN_MAX = BURDEN_ITEMS.length * 3;

export function burdenBand(total: number): BurdenBand {
  return total >= 12 ? 'strained' : total >= 6 ? 'stretched' : 'steady';
}

export function scoreBurden(answers: number[], at: number): BurdenResult {
  if (answers.length !== BURDEN_ITEMS.length) throw new Error('Answer every question.');
  if (answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) throw new Error('Answers are 0 to 3.');
  const total = answers.reduce((s, a) => s + a, 0);
  return { at, answers, total, band: burdenBand(total) };
}

export const BURDEN_MONTHLY_MS = 30 * 86_400_000;

export function burdenDue(history: BurdenResult[], now: number): boolean {
  const last = history[history.length - 1];
  return !last || now - last.at >= BURDEN_MONTHLY_MS;
}

/** How many Attention alerts may be pushed in a day. The busier a carer feels, the fewer interruptions. Urgent is never limited. */
export function pushBudgetFor(band: BurdenBand | null): number {
  return band === 'strained' ? 1 : band === 'stretched' ? 2 : 3;
}

export interface Support {
  headline: string;
  lines: string[];
}

/** Warm, practical, never clinical. The "low" item gets an extra line when answered high. */
export function supportFor(r: BurdenResult): Support {
  const lines: string[] = [];
  if (r.band === 'steady') {
    return { headline: 'You are holding steady.', lines: ['Keep the small habits that work for you. Check in again next month.'] };
  }
  lines.push('Ask one family member to take one regular task, such as the evening medicine reminder. Add them in Share and give them a role.');
  lines.push('Hillpath now sends you fewer non-urgent alerts. Urgent ones always come through.');
  const at = (id: string) => r.answers[BURDEN_ITEMS.findIndex((i) => i.id === id)] ?? 0;
  if (at('alone') >= 2) lines.push('You do not have to do this alone. A community health worker or your doctor can talk through what help is available near you.');
  if (at('unwell') >= 2) lines.push('Write down who could step in for a day if you were ill, and add them to the circle now.');
  if (at('time') >= 2) lines.push('Ask family or a neighbour for two free hours this week. Rest counts as care.');
  if (r.band === 'strained') lines.unshift('This looks heavy. Please speak to your doctor or a health worker about your own health as well.');
  if (at('low') >= 3) lines.push('Feeling low or anxious almost every day is worth telling a doctor about. It is common in carers and it can be helped.');
  return { headline: r.band === 'strained' ? 'You are carrying a lot.' : 'You are stretched.', lines };
}
