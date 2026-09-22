import { buildPdf, reportFromText, verifyReport, type SignedReport } from '@hillpath/report';
import { useState } from 'react';
import { BigButton, SimulatedRibbon, StateNote } from '../ui/kit';
import { QRScan } from '../ui/qr';

const when = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function download(name: string, mime: string, data: BlobPart) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** For the doctor's laptop. Nothing is uploaded: the report is read and checked in this browser. */
export function ReportViewer() {
  const [report, setReport] = useState<SignedReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const v = report ? verifyReport(report) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" data-testid="report-viewer">
      <h1 className="text-3xl font-bold">Hillpath report viewer</h1>
      <p className="mt-2">Open a report from a family phone. It is read and checked in this browser and is not uploaded anywhere.</p>
      {!report && (
        <div className="mt-6">
          <QRScan
            prompt="Scan the report code on the family phone."
            onText={(t) =>
              reportFromText(t)
                .then(setReport)
                .catch((e: Error) => setErr(e.message))
            }
          />
          {err && <StateNote kind="error" title="That code could not be opened." body={err} />}
        </div>
      )}
      {report && v && (
        <article className="mt-6 flex flex-col gap-4">
          {v.ok ? (
            <p role="status" className="card" data-testid="report-verified">Signature checked. This report has not been changed since the family phone made it. Fingerprint {v.fingerprint}.</p>
          ) : (
            <p role="alert" className="rounded-input border-2 border-urgent p-4" data-testid="report-unverified">Not verified. {v.reason}</p>
          )}
          <SimulatedRibbon text="Simulated model, trained on synthetic data only. Screening estimate, not a diagnosis." />
          <h2 className="text-2xl font-bold">{report.data.patient.name}, age {report.data.patient.age}</h2>
          <p>{report.data.patient.schoolingYears} years of schooling. Prepared {when(report.data.generatedAt)} by {report.data.carerName || 'the family'}.</p>

          <section aria-labelledby="v-stage">
            <h3 id="v-stage" className="text-xl font-bold">Screening range</h3>
            {!report.data.stage ? <p>No range yet.</p> : report.data.stage.abstain ? <p>No range is shown: {report.data.stage.abstain}</p> : (
              <>
                <p className="font-bold">Answers look similar to: {report.data.stage.setLabels.join('; ')}.</p>
                <table className="tnum w-full text-left">
                  <thead><tr><th scope="col">Range</th><th scope="col">Probability</th></tr></thead>
                  <tbody>{['No impairment', 'Mild change (MCI range)', 'Mild dementia range', 'Moderate or severe range'].map((n, i) => <tr key={n}><th scope="row" className="font-normal">{n}</th><td>{(report.data.stage!.probs[i]! * 100).toFixed(1)}%</td></tr>)}</tbody>
                </table>
              </>
            )}
          </section>

          {report.data.instruments && (
            <section aria-labelledby="v-inst">
              <h3 id="v-inst" className="text-xl font-bold">Scores from the monthly check ({when(report.data.instruments.at)})</h3>
              <table className="tnum w-full text-left">
                <tbody>
                  <tr><th scope="row" className="font-normal">Family change score (1 to 5)</th><td>{report.data.instruments.informant.toFixed(2)}</td></tr>
                  <tr><th scope="row" className="font-normal">Daily tasks needing help (of 8)</th><td>{report.data.instruments.adl}</td></tr>
                  <tr><th scope="row" className="font-normal">Animals named in a minute</th><td>{report.data.instruments.fluency}</td></tr>
                  <tr><th scope="row" className="font-normal">Words recalled (of 10)</th><td>{report.data.instruments.recall}</td></tr>
                  <tr><th scope="row" className="font-normal">Orientation (of 4)</th><td>{report.data.instruments.orientation}</td></tr>
                </tbody>
              </table>
            </section>
          )}

          <section aria-labelledby="v-alerts">
            <h3 id="v-alerts" className="text-xl font-bold">Alerts</h3>
            {report.data.alerts.length === 0 ? <p>None on record.</p> : <ul className="list-disc pl-6">{report.data.alerts.map((a, i) => <li key={i}>{when(a.at)}, {a.tier}: {a.text}</li>)}</ul>}
          </section>

          <p className="card">{report.data.reversibleCausesNote}</p>
          <div className="flex flex-wrap gap-3">
            <BigButton onClick={() => void buildPdf(report.data, v.fingerprint).then((b) => download('hillpath-summary.pdf', 'application/pdf', b as BlobPart))}>Download the PDF</BigButton>
            <BigButton onClick={() => download('hillpath-fhir.json', 'application/fhir+json', JSON.stringify(report.fhir, null, 2))}>Download the FHIR file</BigButton>
            <BigButton className="btn-quiet" onClick={() => setReport(null)}>Open another report</BigButton>
          </div>
        </article>
      )}
    </main>
  );
}
