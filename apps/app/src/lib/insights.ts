import { DOMAINS, type Domain, type StageEstimate } from '@hillpath/contracts';
import { occurrences, statusAt } from '@hillpath/core';
import {
  abilitySummary,
  abruptChange,
  estimateStage,
  fasterThanTypical,
  forecastHorizons,
  initTrend,
  isPriorDominated,
  stageForecast,
  updateTrend,
  type AbruptResult,
  type AcuteChecklist,
  type HorizonForecast,
  type M2Model,
  type TrendState,
} from '@hillpath/ml';
import m2Json from '@hillpath/ml/models/m2/m2-ordinal-sim-0.1.json';
import { APP_ABRUPT } from '@hillpath/sim';
import type { AppCore } from './core';
import { getSettings, listEvents, listInstruments, listReminders, listSessions, loadModel } from './care';

export const M2 = m2Json as unknown as M2Model;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

export function bands(core: AppCore) {
  const s = abilitySummary(loadModel(core));
  return DOMAINS.map((d) => ({ domain: d, mean: s[d].mean, sd: s[d].sd, low: s[d].mean - 1.645 * s[d].sd, high: s[d].mean + 1.645 * s[d].sd }));
}

export function acuteLast14Days(core: AppCore): AcuteChecklist {
  const recent = listInstruments(core).find((r) => Date.now() - r.at < 14 * DAY);
  return (recent?.acute ?? {}) as AcuteChecklist;
}

export function stageNow(core: AppCore): StageEstimate | null {
  const settings = getSettings(core);
  const latest = listInstruments(core).find((r) => Date.now() - r.at < 60 * DAY);
  if (!settings || !latest) return null;
  const acute = acuteLast14Days(core);
  const anyAcute = Object.values(acute).some(Boolean);
  return estimateStage(
    M2,
    { age: settings.age, schooling: settings.schooling, literate: settings.schooling >= 5 ? 1 : 0, informant: latest.informant, adl: latest.adl, fluency: latest.fluency, recall: latest.recall, orientation: latest.orientation },
    { acuteInLast14Days: anyAcute, visionOrHearingProblem: latest.vision_hearing_problem, depressionScreenPositive: latest.depression_positive },
    latest.at,
  );
}

export interface Trend {
  state: TrendState;
  horizons: HorizonForecast[];
  priorDominated: boolean;
  faster: boolean;
  weeks: number;
}

/** Weekly composite from the last snapshot of each week, with the stage slope prior. Acute windows are left out. */
export function trend(core: AppCore, stage: number): Trend | null {
  const snaps = core.replica
    .list('ability_snap')
    .map((r) => ({ at: Number(r.at), mean: Number(r.mean), sd: Number(r.sd) }))
    .sort((a, b) => a.at - b.at);
  if (snaps.length < 2) return null;
  const t0 = snaps[0]!.at;
  const byWeek = new Map<number, (typeof snaps)[number]>();
  for (const s of snaps) byWeek.set(Math.floor((s.at - t0) / WEEK), s);
  const obs = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([week, s]) => ({ week, value: s.mean, sd: s.sd }));
  let st = initTrend(obs[0]!, stage);
  for (const o of obs.slice(1)) st = updateTrend(st, o);
  return { state: st, horizons: forecastHorizons(st), priorDominated: isPriorDominated(st), faster: fasterThanTypical(st, stage), weeks: obs.length };
}

export function stageOutlook(probs: number[]) {
  return [3, 6, 12].map((m) => ({ months: m, probs: stageForecast(probs, m) }));
}

export function abruptNow(core: AppCore): AbruptResult {
  const sessions = listSessions(core).filter((s) => s.ended_at);
  const t0 = Math.min(...sessions.map((s) => s.started_at), Date.now());
  const series: Partial<Record<Domain, Array<{ day: number; value: number }>>> = {};
  for (const r of core.replica.list('session')) {
    if (typeof r.excess !== 'number' || typeof r.domain !== 'string') continue;
    const d = r.domain as Domain;
    (series[d] ??= []).push({ day: Math.floor((Number(r.started_at) - t0) / DAY), value: r.excess });
  }
  const today = Math.floor((Date.now() - t0) / DAY);
  return abruptChange(series, today, acuteLast14Days(core), APP_ABRUPT);
}

export function adherence(core: AppCore, days = 7): { scheduled: number; taken: number; unconfirmed: number } {
  const now = Date.now();
  const events = listEvents(core);
  let scheduled = 0;
  let taken = 0;
  let unconfirmed = 0;
  for (const rule of listReminders(core)) {
    if (rule.kind === 'activity') continue;
    for (const at of occurrences(rule, now - days * DAY, now)) {
      const st = statusAt(rule, at, events.find((e) => e.reminder_id === rule.id && e.scheduled_for === at), now);
      if (st === 'upcoming' || st === 'due') continue;
      scheduled += 1;
      if (st === 'taken') taken += 1;
      if (st === 'unconfirmed') unconfirmed += 1;
    }
  }
  return { scheduled, taken, unconfirmed };
}

export function weekSummary(core: AppCore) {
  const week = listSessions(core).filter((s) => Date.now() - s.started_at < WEEK);
  const scored = week.filter((s) => s.game_id !== 'G9' && s.game_id !== 'G10');
  const days = new Set(week.map((s) => new Date(s.started_at).toDateString()));
  return { sessions: scored.length, unscored: week.length - scored.length, daysActive: days.size, synthetic: week.some((s) => s.synthetic) };
}
