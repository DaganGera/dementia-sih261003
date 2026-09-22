/**
 * Orientation board (F23): day, date, season, and the next festival the family has approved. Everything here is
 * plain calendar arithmetic, never a model estimate, so it carries no Simulated label.
 */

export type Season = 'winter' | 'summer' | 'monsoon' | 'autumn';

/** Indian meteorological seasons by month (1-12). A simple, named-region convention, not a claim about every locale. */
export function seasonFor(month: number): Season {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'summer';
  if (month <= 9) return 'monsoon';
  return 'autumn';
}

export const SEASON_LABEL: Record<Season, string> = { winter: 'Winter', summer: 'Summer', monsoon: 'Monsoon', autumn: 'Autumn' };

export interface FestivalEntry {
  id: string;
  name: string;
  /** Month 1-12 and day 1-31, repeating every year. A movable (lunar) festival needs the family to update the date each year; that is a caregiver task, not something this module guesses. */
  month: number;
  day: number;
  source: string;
  /** Hidden from the person until a family member approves it. Every new entry starts unapproved. */
  approved: boolean;
  addedAt: number;
}

export function isValidFestivalDate(month: number, day: number): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1) return false;
  return day <= new Date(2001, month, 0).getDate();
}

export interface UpcomingFestival {
  entry: FestivalEntry;
  daysAway: number;
}

/** The nearest approved festival on or after today, wrapping into next year if none remain this year. */
export function nextFestival(list: FestivalEntry[], now = new Date()): UpcomingFestival | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let best: { entry: FestivalEntry; date: Date } | null = null;
  for (const f of list) {
    if (!f.approved || !isValidFestivalDate(f.month, f.day)) continue;
    for (const yearOffset of [0, 1]) {
      const d = new Date(today.getFullYear() + yearOffset, f.month - 1, f.day);
      if (d.getTime() >= today.getTime() && (!best || d.getTime() < best.date.getTime())) best = { entry: f, date: d };
    }
  }
  if (!best) return null;
  return { entry: best.entry, daysAway: Math.round((best.date.getTime() - today.getTime()) / 86_400_000) };
}
