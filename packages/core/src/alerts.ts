import type { AlertTier } from '@hillpath/contracts';

export interface AlertItem {
  id: string;
  tier: AlertTier;
  kind: string;
  at: number;
  text: string;
  acknowledged_at?: number;
  snoozed_until?: number;
}

export const ATTENTION_PUSH_BUDGET_PER_DAY = 3;
export const SECONDARY_ESCALATION_MS = 4 * 3600_000;
export const URGENT_SMS_OFFER_MS = 15 * 60_000;

export interface Plan {
  push: AlertItem[];
  digest: AlertItem[];
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Decide what is pushed now and what waits for the daily digest.
 * Info always waits. Attention is merged by kind per day and capped per day.
 * Urgent is always pushed and can never be snoozed or batched.
 */
export function planDelivery(alerts: AlertItem[], now: number, alreadyPushedToday = 0): Plan {
  const push: AlertItem[] = [];
  const digest: AlertItem[] = [];
  const seenKinds = new Set<string>();
  let budget = Math.max(0, ATTENTION_PUSH_BUDGET_PER_DAY - alreadyPushedToday);
  const ordered = [...alerts].sort((a, b) => a.at - b.at);
  for (const a of ordered) {
    if (a.acknowledged_at) continue;
    if (a.tier === 'urgent') {
      push.push(a);
      continue;
    }
    if (a.snoozed_until && a.snoozed_until > now) continue;
    if (a.tier === 'info') {
      digest.push(a);
      continue;
    }
    const key = `${a.kind}|${dayKey(a.at)}`;
    if (seenKinds.has(key)) continue;
    seenKinds.add(key);
    if (budget > 0) {
      push.push(a);
      budget -= 1;
    } else digest.push(a);
  }
  return { push, digest };
}

export function snooze(a: AlertItem, until: number): AlertItem {
  if (a.tier === 'urgent') return a;
  return { ...a, snoozed_until: until };
}

export type Audience = 'primary' | 'secondary' | 'health_worker' | 'all' | 'offer_sms';

/** Who should hear about an unacknowledged alert right now. */
export function escalation(a: AlertItem, now: number): Audience[] {
  if (a.acknowledged_at) return [];
  const age = now - a.at;
  if (a.tier === 'urgent') return age >= URGENT_SMS_OFFER_MS ? ['all', 'offer_sms'] : ['all'];
  if (a.tier === 'attention') return age >= SECONDARY_ESCALATION_MS ? ['primary', 'secondary'] : ['primary'];
  return [];
}
