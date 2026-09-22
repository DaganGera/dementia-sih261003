import { escalation, planDelivery } from '@hillpath/core';
import { smsHref } from '../lib/sms';
import { calmingSuggestion, DAY_PART_LABEL, DAY_PART_RANGE, STAGE_LABELS, explainForClinician, explainForFamily, abruptMessage, stageName } from '@hillpath/ml';
import { useMemo } from 'react';
import type { AppCore } from '../lib/core';
import { listAlerts, listSessions, getSettings } from '../lib/care';
import { abruptNow, adherence, bands, stageNow, stageOutlook, timeOfDayNow, trend, weekSummary } from '../lib/insights';
import { useVersion } from '../lib/state';
import { AbilityBands, ForecastTable } from '../ui/charts';
import { BigButton, SimulatedRibbon, StateNote, Tag } from '../ui/kit';
import { attentionBudget } from './Burden';

const when = (ms: number) => new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function Dashboard({ core }: { core: AppCore }) {
  const v = useVersion();
  const settings = getSettings(core);
  const view = useMemo(() => {
    const stage = stageNow(core);
    const top = stage && !stage.abstain ? stage.probs.indexOf(Math.max(...stage.probs)) : 0;
    return { stage, tr: trend(core, top), abrupt: abruptNow(core), week: weekSummary(core), adh: adherence(core), sessions: listSessions(core), alerts: listAlerts(core), tod: timeOfDayNow(core) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, v]);

  if (!settings) return <StateNote kind="empty" title="Set up the person first." body="Open Family to add a name, age and years of schooling." />;
  const synthetic = view.week.synthetic;
  const budget = attentionBudget(core);
  const plan = planDelivery(view.alerts.filter((a) => !a.acknowledged_at), Date.now(), 0, budget);

  return (
    <div className="flex flex-col gap-6">
      {synthetic && <SimulatedRibbon />}

      <section aria-labelledby="h-alerts" className="card">
        <h2 id="h-alerts" className="text-2xl font-bold">Alerts</h2>
        {view.abrupt.flag && (
          <div role="alert" className="mt-3 rounded-input border-2 border-urgent p-4" data-testid="abrupt-alert">
            <p className="font-bold text-urgent">Urgent: please arrange a health check today.</p>
            <p>{abruptMessage(view.abrupt.stroke)}</p>
            <ul className="mt-2 list-disc pl-6">{view.abrupt.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
        {view.alerts.length === 0 && !view.abrupt.flag ? (
          <p className="mt-2">No alerts.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {view.alerts.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <span>
                  <Tag>{a.tier === 'urgent' ? 'Urgent' : a.tier === 'attention' ? 'Attention' : 'Info'}</Tag> {a.text} <span className="text-muted">{when(a.at)}</span>
                </span>
                {!a.acknowledged_at && (
                  <span className="flex flex-col items-end gap-2">
                    <BigButton className="btn-quiet text-lg" onClick={() => core.replica.set('alert', a.id, { acknowledged_at: Date.now() })}>Got it</BigButton>
                    {a.tier === 'urgent' && settings.escalation_phone && escalation(a, Date.now()).includes('offer_sms') && (
                      <a className="btn text-lg" style={{ minHeight: 48 }} href={smsHref(settings.escalation_phone, settings.patient_name)}>Send a text message</a>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted" data-testid="alert-plan">
          {plan.push.length} to push now, {plan.digest.length} for the daily summary.
          {budget < 3 && ' Fewer non-urgent alerts are sent while you are stretched. Urgent ones always come through.'}
        </p>
      </section>

      <section aria-labelledby="h-week" className="card">
        <h2 id="h-week" className="text-2xl font-bold">This week</h2>
        <p className="tnum mt-2">
          {view.week.sessions} {view.week.sessions === 1 ? 'activity' : 'activities'} on {view.week.daysActive} {view.week.daysActive === 1 ? 'day' : 'days'}.
        </p>
        <p className="tnum">Memories and music: {view.week.unscored} {view.week.unscored === 1 ? 'session' : 'sessions'}.</p>
        <p className="tnum">Medicine and drink reminders: {view.adh.taken} confirmed of {view.adh.scheduled} due. {view.adh.unconfirmed} not confirmed.</p>
      </section>

      <section aria-labelledby="h-abil" className="card">
        <h2 id="h-abil" className="text-2xl font-bold">How activities are going</h2>
        {view.sessions.length === 0 ? <p className="mt-2">No activities played yet.</p> : <AbilityBands rows={bands(core)} />}
        {view.sessions.find((s) => s.ended_at) && <LatestWhy core={core} />}
      </section>

      <section aria-labelledby="h-stage" className="card" data-testid="stage-card">
        <h2 id="h-stage" className="text-2xl font-bold">Screening range</h2>
        <SimulatedRibbon text="Simulated model: trained on synthetic data only. Not a diagnosis." />
        {!view.stage ? (
          <p className="mt-2">Complete the monthly check to see a range. It takes about 10 minutes.</p>
        ) : (
          <StageBlock stage={view.stage} />
        )}
      </section>

      <section aria-labelledby="h-tod" className="card" data-testid="tod-card">
        <h2 id="h-tod" className="text-2xl font-bold">Time of day</h2>
        {view.tod.synthetic && <SimulatedRibbon />}
        {!view.tod.enough ? (
          <p className="mt-2">Not enough activity yet to see a pattern. This needs at least {view.tod.minPerGroup} evening sessions and {view.tod.minPerGroup} at other times.</p>
        ) : (
          <>
            <table className="mt-2 w-full text-left">
              <thead><tr><th scope="col">Time</th><th scope="col">Sessions</th></tr></thead>
              <tbody className="tnum">
                {view.tod.parts.map((p) => (
                  <tr key={p.part}><th scope="row" className="font-normal">{DAY_PART_LABEL[p.part]} <span className="text-muted">({DAY_PART_RANGE[p.part]})</span></th><td>{p.n}</td></tr>
                ))}
              </tbody>
            </table>
            {view.tod.eveningDip ? (
              <div className="mt-3" role="note" data-testid="evening-dip">
                <p className="font-bold">Evenings seem harder for {settings.patient_name || 'them'}.</p>
                <p className="mt-1">{calmingSuggestion()}</p>
                <p className="mt-2 text-sm text-muted">Based on their own recent sessions, against an assumed pattern shape. Not a diagnosis, and not used in the screening range above.</p>
              </div>
            ) : (
              <p className="mt-3">No clear evening pattern so far.</p>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="h-fc" className="card">
        <h2 id="h-fc" className="text-2xl font-bold">Looking ahead</h2>
        {!view.tr ? (
          <p className="mt-2">Too early to see a personal trend. Play a few more times over several weeks.</p>
        ) : (
          <>
            {view.tr.priorDominated && <p className="mt-2">Too early to see a personal trend. This range reflects typical change.</p>}
            {view.tr.faster && <p className="mt-2" role="note">Changes seem faster than typical. Discuss at the next check-up.</p>}
            <ForecastTable rows={view.tr.horizons} />
            {view.stage && !view.stage.abstain && (
              <details className="mt-3">
                <summary className="cursor-pointer py-2">Typical stage outlook (assumed transition table, not from data)</summary>
                <table className="w-full text-left">
                  <thead><tr><th scope="col">Months</th>{[0, 1, 2, 3].map((i) => <th scope="col" key={i}>{stageName(i).replaceAll('_', ' ')}</th>)}</tr></thead>
                  <tbody className="tnum">
                    {stageOutlook(view.stage.probs).map((o) => (
                      <tr key={o.months}><th scope="row" className="font-normal">{o.months}</th>{o.probs.map((p, i) => <td key={i}>{(p * 100).toFixed(0)}%</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function LatestWhy({ core }: { core: AppCore }) {
  const last = listSessions(core)[0];
  return last ? <p className="mt-2 text-sm text-muted">Most recent activity: {when(last.started_at)}. Open an activity and choose "For family: why this level" to see how difficulty was chosen.</p> : null;
}

function StageBlock({ stage }: { stage: NonNullable<ReturnType<typeof stageNow>> }) {
  const fam = explainForFamily(stage);
  const clin = explainForClinician(stage);
  return (
    <div className="mt-3">
      <p className="text-xl font-bold" data-testid="stage-headline">{fam.headline}</p>
      <ul className="mt-2 list-disc pl-6">{fam.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <p className="mt-2 font-bold">{fam.action}</p>
      <details className="mt-3">
        <summary className="cursor-pointer py-2">For the doctor: probabilities and contributions</summary>
        <table className="w-full text-left">
          <thead><tr><th scope="col">Range</th><th scope="col">Probability</th></tr></thead>
          <tbody className="tnum">
            {clin.probs.map((p) => <tr key={p.stage}><th scope="row" className="font-normal">{STAGE_LABELS[p.stage as keyof typeof STAGE_LABELS]}</th><td>{(p.p * 100).toFixed(1)}%</td></tr>)}
          </tbody>
        </table>
        <p className="mt-2 text-sm">{clin.note}</p>
      </details>
    </div>
  );
}
