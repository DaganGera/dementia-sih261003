import type { ReminderKind } from '@hillpath/contracts';

export interface ReminderRule {
  id: string;
  kind: ReminderKind;
  title: string;
  /** Local time of day, 24 h, "HH:MM". */
  time: string;
  /** 0 = Sunday. Empty means every day. */
  days: number[];
  /** Minutes after the scheduled time during which a confirmation counts. */
  window_min: number;
  /** Hydration only: true turns "drink more" into "small sips". */
  fluid_restriction: boolean;
  active: boolean;
  /** When the caregiver created it. Earlier days are never counted as missed. */
  created_at?: number;
}

export interface ReminderEvent {
  reminder_id: string;
  scheduled_for: number;
  status: 'taken' | 'skipped';
  confirmed_at: number;
}

export type ReminderStatus = 'upcoming' | 'due' | 'unconfirmed' | 'taken' | 'skipped';

export function eventKey(reminderId: string, scheduledFor: number): string {
  return `${reminderId}@${scheduledFor}`;
}

/** Scheduled instants (ms) for a rule between two instants, in the device's local time. */
export function occurrences(rule: ReminderRule, fromMs: number, toMs: number): number[] {
  if (!rule.active) return [];
  // A reminder cannot have been missed before it existed.
  fromMs = Math.max(fromMs, rule.created_at ?? 0);
  const [h, m] = rule.time.split(':').map(Number) as [number, number];
  const out: number[] = [];
  const day = new Date(fromMs);
  day.setHours(0, 0, 0, 0);
  for (let d = new Date(day); d.getTime() <= toMs; d.setDate(d.getDate() + 1)) {
    if (rule.days.length && !rule.days.includes(d.getDay())) continue;
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
    if (t >= fromMs && t <= toMs) out.push(t);
  }
  return out;
}

export function statusAt(rule: ReminderRule, scheduledFor: number, ev: ReminderEvent | undefined, nowMs: number): ReminderStatus {
  if (ev) return ev.status;
  if (nowMs < scheduledFor) return 'upcoming';
  if (nowMs <= scheduledFor + rule.window_min * 60_000) return 'due';
  return 'unconfirmed';
}

export type ConfirmResult =
  | { result: 'recorded'; message: string }
  | { result: 'already_taken'; message: string };

function clock(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Confirm a dose. A second confirmation for the same scheduled time never records
 * anything and tells the person not to take it again. The app never proposes a catch-up dose.
 */
export function confirmDose(existing: ReminderEvent | undefined, rule: ReminderRule, scheduledFor: number, nowMs: number): { event?: ReminderEvent } & ConfirmResult {
  if (existing?.status === 'taken') {
    return { result: 'already_taken', message: `Already taken at ${clock(existing.confirmed_at)}. No need to take it again.` };
  }
  const event: ReminderEvent = { reminder_id: rule.id, scheduled_for: scheduledFor, status: 'taken', confirmed_at: nowMs };
  return { result: 'recorded', message: 'Thank you. This is written down.', event };
}

/** Text for the patient when a window has passed without a confirmation. */
export function unconfirmedMessageForPatient(kind: ReminderKind, carerName: string): string {
  if (kind === 'medicine') return `If you are not sure whether you took it, do not take another. ${carerName} will check with you.`;
  if (kind === 'hydration') return `${carerName} will check with you about your drink.`;
  return `${carerName} will check with you.`;
}

export function hydrationPrompt(rule: ReminderRule): string {
  return rule.fluid_restriction ? 'Time for a small sip, as planned with your doctor.' : 'Time for a drink of water.';
}
