import { estimateStage, forecastHorizons, initTrend, rng, STAGE_LABELS, stageName, updateTrend } from '@hillpath/ml';
import { abruptDays, instrumentsFor, makePersona, runPersona, type Scenario } from '@hillpath/sim';
import { useEffect, useMemo, useState } from 'react';
import { M2 } from '../lib/insights';
import { Line } from '../ui/charts';
import { BigButton, SimulatedRibbon } from '../ui/kit';

const SCENARIOS: Array<[Scenario, string]> = [
  ['S5_delirium', 'Sudden episode (infection or delirium)'],
  ['S2_slow', 'Slow decline'],
  ['S3_fast', 'Faster decline'],
  ['S1_stable', 'Stable'],
];
const DAYS = 365;
const PLAY_MS = 60_000;

/** Twelve simulated months in one minute. Nothing here is a real person, and nothing is saved. */
export function TimeMachine() {
  const [scenario, setScenario] = useState<Scenario>('S5_delirium');
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const sim = useMemo(() => {
    // Persona 1 is a run where the simulated episode starts on day 94; the data rule fires on day 97.
    const p = makePersona(1, scenario, 21, scenario === 'S1_stable' ? 0 : 1);
    const run = runPersona(p, { days: DAYS, policy: 'm1' });
    const inst = instrumentsFor(p, rng(5));
    const est = estimateStage(M2, inst, {}, 0);
    return { p, run, est };
  }, [scenario]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setDay((d) => (d >= DAYS - 1 ? (setPlaying(false), d) : d + 1)), PLAY_MS / DAYS);
    return () => window.clearInterval(t);
  }, [playing]);

  const view = useMemo(() => {
    const played = sim.run.days.slice(0, day + 1).filter((d) => d.composite);
    const byWeek = new Map<number, { week: number; value: number; sd: number }>();
    for (const d of played) byWeek.set(Math.floor(d.day / 7), { week: Math.floor(d.day / 7), value: d.composite!.mean, sd: d.composite!.sd });
    const obs = [...byWeek.values()].sort((a, b) => a.week - b.week);
    const top = sim.est.probs.indexOf(Math.max(...sim.est.probs));
    let tr = obs.length ? initTrend(obs[0]!, top) : null;
    for (const o of obs.slice(1)) tr = updateTrend(tr!, o);
    const alerts = abruptDays(sim.run.days.slice(0, day + 1));
    return { obs, tr, alerts };
  }, [sim, day]);

  const months = Math.floor(day / 30.4);
  const points = view.obs.map((o) => ({ x: o.week * 7, y: o.value }));
  const forecast = view.tr ? forecastHorizons(view.tr) : [];
  const fpoints = forecast.map((f) => ({ x: day + f.months * 30.4, y: f.mean, low: f.low80, high: f.high80 }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6" data-testid="time-machine">
      <a className="underline" href="#/caregiver/home">Back to the family view</a>
      <h1 className="mt-3 text-3xl font-bold">Twelve months in one minute</h1>
      <SimulatedRibbon text="Simulated person. Nothing here is a real patient, and nothing is saved." />
      <div className="mt-4 flex flex-col gap-3">
        <label>Scenario
          <select className="field" value={scenario} onChange={(e) => { setScenario(e.target.value as Scenario); setDay(0); setPlaying(false); }}>
            {SCENARIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <div className="flex gap-3">
          <BigButton primary onClick={() => { if (day >= DAYS - 1) setDay(0); setPlaying(!playing); }}>{playing ? 'Pause' : 'Play'}</BigButton>
          <BigButton className="btn-quiet" onClick={() => { setDay(0); setPlaying(false); }}>Start again</BigButton>
        </div>
        <label>Day {day + 1} of {DAYS} (month {months + 1})
          <input type="range" min={0} max={DAYS - 1} value={day} onChange={(e) => { setDay(Number(e.target.value)); setPlaying(false); }} className="w-full" aria-label="Simulated day" />
        </label>
      </div>

      <section className="card mt-4" aria-labelledby="tm-chart">
        <h2 id="tm-chart" className="text-xl font-bold">Ability trend and forecast</h2>
        <Line points={points} label="Weekly ability estimate over the simulated year" />
        {fpoints.length > 0 && <Line points={[{ x: day, y: view.tr!.level, low: view.tr!.level, high: view.tr!.level }, ...fpoints]} label="Forecast band for the next 12 months" />}
        <details>
          <summary className="cursor-pointer py-2">View as a table</summary>
          <table className="tnum w-full text-left">
            <thead><tr><th scope="col">Months ahead</th><th scope="col">Expected</th><th scope="col">80% range</th></tr></thead>
            <tbody>{forecast.map((f) => <tr key={f.months}><th scope="row" className="font-normal">{f.months}</th><td>{f.mean.toFixed(2)}</td><td>{f.low80.toFixed(2)} to {f.high80.toFixed(2)}</td></tr>)}</tbody>
          </table>
        </details>
        {view.tr && view.tr.n < 8 && <p>Too early to see a personal trend. This range reflects typical change.</p>}
      </section>

      <section className="card mt-4" aria-labelledby="tm-alerts">
        <h2 id="tm-alerts" className="text-xl font-bold">Alerts so far</h2>
        {view.alerts.length === 0 ? (
          <p>None yet.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="tm-alerts">
            {view.alerts.map((d) => (
              <li key={d} role="alert" className="rounded-input border-2 border-urgent p-3">
                <strong>Day {d + 1}: please arrange a health check today.</strong> A sudden change like this can have a treatable cause, such as an infection, dehydration or a medicine side effect.
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-4" aria-labelledby="tm-stage">
        <h2 id="tm-stage" className="text-xl font-bold">Screening range at the start</h2>
        <p>Answers looked similar to: {sim.est.set.map((i) => STAGE_LABELS[stageName(i)]).join(', ')}.</p>
        <p className="text-sm text-muted">The simulated person's true stage was: {STAGE_LABELS[stageName(sim.p.stage)]}. In real use this is never known to the app.</p>
      </section>
    </main>
  );
}
