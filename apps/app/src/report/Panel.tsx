import { hasConsent } from '@hillpath/core';
import { buildPdf, reportToText, signReport, type SignedReport } from '@hillpath/report';
import { useEffect, useState } from 'react';
import { logAudit } from '../caregiver/Privacy';
import type { AppCore } from '../lib/core';
import { getSettings } from '../lib/care';
import { go } from '../lib/router';
import { BigButton, StateNote } from '../ui/kit';
import { QRShow } from '../ui/qr';
import { makeReportInput } from './build';

function download(name: string, mime: string, data: BlobPart) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Make a signed one-page report for a doctor. Needs the person's agreement for doctor reports, and logs that it was made. */
export function ReportPanel({ core }: { core: AppCore }) {
  const settings = getSettings(core);
  const allowed = settings ? hasConsent(core.replica, settings.patient_id, 'clinician_report') : false;
  const [signed, setSigned] = useState<SignedReport | null>(null);
  const [qr, setQr] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (signed) void reportToText(signed).then(setQr);
  }, [signed]);

  if (!settings) return <StateNote kind="empty" title="Set up the person first." body="Open Family to add a name, age and years of schooling." />;
  if (!allowed) {
    return (
      <section aria-labelledby="h-report" className="card">
        <h2 id="h-report" className="text-2xl font-bold">Report for a doctor</h2>
        <p className="mt-2">Doctor reports are switched off. The person, or a guardian whose appointment was checked, must agree first.</p>
        <BigButton className="mt-3" onClick={() => go('caregiver', 'privacy')}>Open Privacy</BigButton>
      </section>
    );
  }

  const create = () => {
    setErr(null);
    const input = makeReportInput(core);
    if (!input) return setErr('There is not enough on this device to make a report yet.');
    try {
      const r = signReport(input, core.keys.signSecret, core.keys.signPublic);
      setSigned(r);
      logAudit(core, 'report_created', r.sha256.slice(0, 8));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section aria-labelledby="h-report" className="flex flex-col gap-3">
      <h2 id="h-report" className="text-2xl font-bold">Report for a doctor</h2>
      <p>A one-page summary and a standard FHIR file. It says clearly that the model is simulated and that this is not a diagnosis.</p>
      <BigButton primary onClick={create}>{signed ? 'Make a fresh report' : 'Make the report'}</BigButton>
      {err && <StateNote kind="error" title="The report could not be made." body={err} />}
      {signed && (
        <div className="card flex flex-col gap-3" data-testid="report-ready">
          <p>Report ready. Fingerprint <strong data-testid="report-fingerprint">{signed.sha256.slice(0, 8)}</strong>.</p>
          <BigButton onClick={() => void buildPdf(signed.data, signed.sha256.slice(0, 8)).then((b) => { download('hillpath-summary.pdf', 'application/pdf', b as BlobPart); logAudit(core, 'report_downloaded_pdf', signed.sha256.slice(0, 8)); })}>Download the PDF</BigButton>
          <BigButton onClick={() => { download('hillpath-fhir.json', 'application/fhir+json', JSON.stringify(signed.fhir, null, 2)); logAudit(core, 'report_downloaded_fhir', signed.sha256.slice(0, 8)); }}>Download the FHIR file</BigButton>
          <p>Or let the doctor's laptop scan this. It opens the report at Report in the Hillpath address, and checks the signature.</p>
          {qr && <QRShow text={qr} label="Report code for the doctor's laptop" />}
        </div>
      )}
    </section>
  );
}
