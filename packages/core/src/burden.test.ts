import { describe, expect, it } from 'vitest';
import { planDelivery, type AlertItem } from './alerts';
import { BURDEN_ITEMS, BURDEN_MAX, burdenBand, burdenDue, BURDEN_MONTHLY_MS, pushBudgetFor, scoreBurden, supportFor } from './burden';

const answers = (n: number) => BURDEN_ITEMS.map(() => n);

describe('caregiver check-in', () => {
  it('scores and bands', () => {
    expect(BURDEN_MAX).toBe(18);
    expect(scoreBurden(answers(0), 1).band).toBe('steady');
    expect(scoreBurden(answers(1), 1).total).toBe(6);
    expect(scoreBurden(answers(1), 1).band).toBe('stretched');
    expect(scoreBurden(answers(2), 1).band).toBe('strained');
    expect(burdenBand(5)).toBe('steady');
    expect(burdenBand(11)).toBe('stretched');
    expect(burdenBand(12)).toBe('strained');
  });

  it('rejects incomplete or out of range answers', () => {
    expect(() => scoreBurden([1, 2], 1)).toThrow();
    expect(() => scoreBurden([...answers(1).slice(1), 4], 1)).toThrow();
    expect(() => scoreBurden([...answers(1).slice(1), 1.5], 1)).toThrow();
  });

  it('asks again after a month', () => {
    const r = scoreBurden(answers(1), 1000);
    expect(burdenDue([], 5)).toBe(true);
    expect(burdenDue([r], 1000 + BURDEN_MONTHLY_MS - 1)).toBe(false);
    expect(burdenDue([r], 1000 + BURDEN_MONTHLY_MS)).toBe(true);
  });

  it('gives support text that is warm and never a diagnosis', () => {
    const steady = supportFor(scoreBurden(answers(0), 1));
    expect(steady.headline).toMatch(/steady/);
    const heavy = supportFor(scoreBurden(answers(3), 1));
    const text = [heavy.headline, ...heavy.lines].join(' ');
    expect(text).toMatch(/health worker/);
    expect(text).not.toMatch(/depress|disorder|diagnos/i);
    expect(heavy.lines.some((l) => /low or anxious/.test(l))).toBe(true);
  });

  it('lowers the push budget for Attention alerts but never touches Urgent', () => {
    expect(pushBudgetFor(null)).toBe(3);
    expect(pushBudgetFor('steady')).toBe(3);
    expect(pushBudgetFor('stretched')).toBe(2);
    expect(pushBudgetFor('strained')).toBe(1);
    const now = 10 * 3600_000;
    const alerts: AlertItem[] = [
      { id: 'u', tier: 'urgent', kind: 'help', at: now - 1, text: 'help' },
      ...['a', 'b', 'c'].map((k, i): AlertItem => ({ id: k, tier: 'attention', kind: `k-${k}`, at: now - 10 + i, text: k })),
      { id: 'i', tier: 'info', kind: 'note', at: now - 5, text: 'note' },
    ];
    const normal = planDelivery(alerts, now);
    expect(normal.push.map((a) => a.id)).toEqual(['a', 'b', 'c', 'u']);
    const strained = planDelivery(alerts, now, 0, pushBudgetFor('strained'));
    expect(strained.push.map((a) => a.id).sort()).toEqual(['a', 'u']);
    expect(strained.digest.map((a) => a.id).sort()).toEqual(['b', 'c', 'i']);
  });
});
