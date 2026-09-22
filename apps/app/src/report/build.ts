import { STAGE_LABELS, stageName } from '@hillpath/ml';
import { REVERSIBLE_NOTE, type ReportInput } from '@hillpath/report';
import type { AppCore } from '../lib/core';
import { getSettings, listAlerts, listInstruments, listTimings } from '../lib/care';
import { adherence, bands, stageNow, trend, weekSummary } from '../lib/insights';
import { domainName } from '../ui/charts';

/** Collect what the report needs from this device's records. Returns null until the person has been set up. */
export function makeReportInput(core: AppCore): ReportInput | null {
  const s = getSettings(core);
  if (!s) return null;
  const stage = stageNow(core);
  const inst = listInstruments(core)[0] ?? null;
  const top = stage && !stage.abstain ? stage.probs.indexOf(Math.max(...stage.probs)) : 0;
  const tr = trend(core, top);
  const week = weekSummary(core);
  const timings = listTimings(core);
  return {
    generatedAt: Date.now(),
    patient: { id: s.patient_id, name: s.patient_name || 'The person', age: s.age, schoolingYears: s.schooling },
    carerName: s.carer_name,
    author: { deviceId: core.deviceId, role: core.role ?? 'caregiver' },
    stage: stage
      ? { modelVersion: stage.model_version, maturity: 'Simulated', probs: stage.probs, setLabels: stage.set.map((i) => STAGE_LABELS[stageName(i)]), abstain: stage.abstain, contributions: stage.contributions.map((c) => ({ feature: c.feature, effect: Number(c.effect.toFixed(3)) })) }
      : null,
    instruments: inst
      ? { at: inst.at, informant: inst.informant, adl: inst.adl, fluency: inst.fluency, recall: inst.recall, orientation: inst.orientation, visionHearingProblem: inst.vision_hearing_problem, moodScreenPositive: inst.depression_positive, acute: Object.entries(inst.acute ?? {}).filter(([, v]) => v).map(([k]) => k) }
      : null,
    abilities: bands(core).map((b) => ({ area: domainName(b.domain), mean: b.mean, low: b.low, high: b.high })),
    forecast: tr ? tr.horizons.map((h) => ({ months: h.months, mean: h.mean, low80: h.low80, high80: h.high80 })) : null,
    forecastNote: tr ? (tr.priorDominated ? 'Too early to see a personal trend. This range reflects typical change.' : tr.faster ? 'Changes seem faster than typical.' : null) : null,
    alerts: listAlerts(core).slice(0, 12).map((a) => ({ tier: a.tier, text: a.text, at: a.at })),
    adherence: adherence(core),
    activity: { sessionsThisWeek: week.sessions, daysActive: week.daysActive, memoriesAndMusic: week.unscored },
    speech: timings.length ? { samples: timings.length, meanPauseRatio: timings.reduce((a, t) => a + t.pause_ratio, 0) / timings.length } : null,
    reversibleCausesNote: REVERSIBLE_NOTE,
  };
}
