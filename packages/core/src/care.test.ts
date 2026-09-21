import { describe, expect, it } from 'vitest';
import { ATTENTION_PUSH_BUDGET_PER_DAY, escalation, planDelivery, snooze, type AlertItem } from './alerts';
import { appendAudit, verifyChain, type AuditEvent } from './audit';
import { grantConsent, hasConsent, revokeConsent } from './consent';
import { confirmDose, occurrences, statusAt, unconfirmedMessageForPatient, type ReminderRule } from './reminders';
import { Replica } from './replica';

const rule: ReminderRule = { id: 'r1', kind: 'medicine', title: 'Morning tablet', time: '08:00', days: [], window_min: 60, fluid_restriction: false, active: true };
const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();

describe('reminders', () => {
  it('lists occurrences in local time and honours weekday filters', () => {
    const week = occurrences(rule, at(0), at(0) + 7 * 86400_000 - 1);
    expect(week).toHaveLength(7);
    expect(occurrences({ ...rule, days: [1] }, at(0), at(0) + 7 * 86400_000 - 1)).toHaveLength(1);
    expect(occurrences({ ...rule, active: false }, at(0), at(0) + 86400_000)).toHaveLength(0);
  });

  it('moves from upcoming to due to unconfirmed', () => {
    const s = at(8);
    expect(statusAt(rule, s, undefined, at(7, 59))).toBe('upcoming');
    expect(statusAt(rule, s, undefined, at(8, 30))).toBe('due');
    expect(statusAt(rule, s, undefined, at(9, 1))).toBe('unconfirmed');
  });

  it('never records a second dose and never offers a catch-up', () => {
    const first = confirmDose(undefined, rule, at(8), at(8, 5));
    expect(first.result).toBe('recorded');
    const again = confirmDose(first.event, rule, at(8), at(8, 40));
    expect(again.result).toBe('already_taken');
    expect(again.message).toContain('No need to take it again');
    expect(again.event).toBeUndefined();
    const miss = unconfirmedMessageForPatient('medicine', 'Anita');
    expect(miss).toContain('do not take another');
    expect(miss.toLowerCase()).not.toContain('catch up');
  });
});

describe('alerts', () => {
  const mk = (id: string, tier: AlertItem['tier'], kind: string, atMs = at(10)): AlertItem => ({ id, tier, kind, at: atMs, text: kind });

  it('always pushes urgent, never snoozes it, and caps attention pushes', () => {
    const list = [mk('u', 'urgent', 'help'), ...['a', 'b', 'c', 'd', 'e'].map((k, i) => mk(`t${i}`, 'attention', `kind-${k}`)), mk('i', 'info', 'weekly')];
    const plan = planDelivery(list, at(11));
    expect(plan.push.filter((x) => x.tier === 'urgent')).toHaveLength(1);
    expect(plan.push.filter((x) => x.tier === 'attention')).toHaveLength(ATTENTION_PUSH_BUDGET_PER_DAY);
    expect(plan.digest.map((x) => x.id)).toContain('i');
    expect(snooze(mk('u', 'urgent', 'help'), at(20)).snoozed_until).toBeUndefined();
  });

  it('merges duplicates of the same kind on one day and respects snooze', () => {
    const plan = planDelivery([mk('1', 'attention', 'missed-dose'), mk('2', 'attention', 'missed-dose')], at(11));
    expect(plan.push).toHaveLength(1);
    const snoozed = snooze(mk('3', 'attention', 'hydration'), at(12));
    expect(planDelivery([snoozed], at(11)).push).toHaveLength(0);
  });

  it('escalates by tier and age', () => {
    expect(escalation(mk('a', 'attention', 'k', at(8)), at(9))).toEqual(['primary']);
    expect(escalation(mk('a', 'attention', 'k', at(8)), at(12, 30))).toEqual(['primary', 'secondary']);
    expect(escalation(mk('u', 'urgent', 'k', at(8)), at(8, 20))).toEqual(['all', 'offer_sms']);
    expect(escalation({ ...mk('u', 'urgent', 'k'), acknowledged_at: 1 }, at(23))).toEqual([]);
  });
});

describe('audit and consent', () => {
  it('detects an edited audit event', () => {
    let chain: AuditEvent[] = [];
    for (let i = 0; i < 5; i++) chain = appendAudit(chain, 'anita', 'view_dashboard', 'ama', 1000 + i);
    expect(verifyChain(chain)).toBe(-1);
    const edited = chain.map((e, i) => (i === 2 ? { ...e, actor: 'someone-else' } : e));
    expect(verifyChain(edited)).toBe(2);
  });

  it('blocks outside sharing on unverified family consent and honours revocation', () => {
    const r = new Replica('d');
    expect(grantConsent(r, 'c1', 'ama', 'family', 'family_supported_unverified', 1).ok).toBe(true);
    expect(grantConsent(r, 'c2', 'ama', 'clinician_report', 'family_supported_unverified', 1).ok).toBe(false);
    expect(grantConsent(r, 'c3', 'ama', 'clinician_report', 'self_supported', 1).ok).toBe(true);
    expect(hasConsent(r, 'ama', 'clinician_report')).toBe(true);
    revokeConsent(r, 'c3', 2);
    expect(hasConsent(r, 'ama', 'clinician_report')).toBe(false);
  });
});
