import type { Domain } from '@hillpath/contracts';
import { abruptChange, type DayValue } from '@hillpath/ml';
import type { DayLog } from './telemetry';

/** Options used by the app, tuned for sparse play (about three sessions a week per area). */
export const APP_ABRUPT = { minBase: 6, recentDays: 7, baseDays: 45, pooled: { z: 3.5 } } as const;

export function excessSeries(days: DayLog[], upTo: number): Partial<Record<Domain, DayValue[]>> {
  const series: Partial<Record<Domain, DayValue[]>> = {};
  for (const d of days) {
    if (d.day > upTo) break;
    for (const [dom, v] of Object.entries(d.excess ?? {})) (series[dom as Domain] ??= []).push({ day: d.day, value: v as number });
  }
  return series;
}

/** Days on which the data-only abrupt rule first fires, with a quiet period between alerts. */
export function abruptDays(days: DayLog[], quietDays = 30, options = APP_ABRUPT): number[] {
  const out: number[] = [];
  let last = -1e9;
  for (let t = 10; t < days.length; t++) {
    if (abruptChange(excessSeries(days, t), t, {}, options).flag && t - last > quietDays) {
      out.push(t);
      last = t;
    }
  }
  return out;
}
