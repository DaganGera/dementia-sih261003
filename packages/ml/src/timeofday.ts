/**
 * Time-of-day pattern (sundowning). Bins a person's own session results by the hour they were played, and flags
 * when evening sessions score reliably below the rest of the day. Thresholds below are assumed, not fitted to any
 * dataset, and the flag is descriptive only: it never feeds the stage estimate or the trend.
 */

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';
const PARTS: DayPart[] = ['morning', 'afternoon', 'evening', 'night'];
export const DAY_PART_LABEL: Record<DayPart, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };
export const DAY_PART_RANGE: Record<DayPart, string> = { morning: '5am to noon', afternoon: 'Noon to 5pm', evening: '5pm to 9pm', night: '9pm to 5am' };

export function dayPart(hour: number): DayPart {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export interface TimeSample {
  hour: number;
  /** Correct minus expected for that session: positive is better than the model expected. */
  excess: number;
}

export interface PartStat {
  part: DayPart;
  n: number;
  mean: number | null;
}

export interface TimeOfDayResult {
  parts: PartStat[];
  /** Evening sessions score at least DIP_THRESHOLD below the rest of the day, with enough sessions in both to say so. */
  eveningDip: boolean;
  enough: boolean;
  minPerGroup: number;
}

export const MIN_SAMPLES_PER_GROUP = 6;
export const DIP_THRESHOLD = 0.12;

export function timeOfDay(samples: TimeSample[]): TimeOfDayResult {
  const buckets = new Map<DayPart, number[]>(PARTS.map((p) => [p, []]));
  for (const s of samples) buckets.get(dayPart(s.hour))!.push(s.excess);
  const parts: PartStat[] = PARTS.map((part) => {
    const xs = buckets.get(part)!;
    return { part, n: xs.length, mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null };
  });
  const evening = parts.find((p) => p.part === 'evening')!;
  const others = parts.filter((p) => p.part !== 'evening');
  const othersN = others.reduce((s, p) => s + p.n, 0);
  const othersMean = othersN ? others.reduce((s, p) => s + (p.mean ?? 0) * p.n, 0) / othersN : null;
  const enough = evening.n >= MIN_SAMPLES_PER_GROUP && othersN >= MIN_SAMPLES_PER_GROUP;
  const eveningDip = enough && othersMean !== null && evening.mean !== null && othersMean - evening.mean >= DIP_THRESHOLD;
  return { parts, eveningDip, enough, minPerGroup: MIN_SAMPLES_PER_GROUP };
}

/** A short, gentle suggestion for a difficult evening. Rotates by day so the same line does not repeat every time. */
export const CALMING_SUGGESTIONS: readonly string[] = [
  'Try a favourite song from Music, with the lights on and the room calm.',
  'Sit together and look through Memories rather than starting a new activity.',
  'A short walk or a warm drink before anything else can help more than an activity right now.',
  'Play something low-pressure like Sound Match, or stop for the day. Both are fine.',
  'Keep the evening simple and familiar. New places or people can wait for the morning.',
];

export function calmingSuggestion(day = Math.floor(Date.now() / 86_400_000)): string {
  return CALMING_SUGGESTIONS[((day % CALMING_SUGGESTIONS.length) + CALMING_SUGGESTIONS.length) % CALMING_SUGGESTIONS.length]!;
}
