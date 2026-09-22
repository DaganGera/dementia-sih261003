import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { CAVEATS, type ReportInput } from './types';

const W = 595;
const H = 842;
const M = 42;

const date = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** WinAnsi cannot show every character; keep the page printable. */
const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, '?');

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = clean(text).split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** One A4 page. If there is more than fits, the alert list is shortened rather than spilling onto a second page. */
export async function buildPdf(r: ReportInput, fingerprint = ''): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Cognitive screening summary for ${clean(r.patient.name)}`);
  doc.setAuthor('Hillpath prototype');
  doc.setSubject('Screening summary. Simulated model. Not a diagnosis.');
  const page = doc.addPage([W, H]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = H - M;

  const text = (s: string, o: { size?: number; font?: PDFFont; x?: number; color?: [number, number, number] } = {}) => {
    const size = o.size ?? 10;
    const font = o.font ?? reg;
    for (const line of wrap(s, font, size, W - 2 * M - ((o.x ?? M) - M))) {
      page.drawText(line, { x: o.x ?? M, y, size, font, color: rgb(...(o.color ?? [0.08, 0.1, 0.09])) });
      y -= size + 3.5;
    }
  };
  const gap = (n = 6) => {
    y -= n;
  };
  const rule = () => {
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.7, 0.75, 0.72) });
    y -= 10;
  };

  text('Cognitive screening summary', { size: 18, font: bold });
  text(`${r.patient.name}, age ${r.patient.age}, ${r.patient.schoolingYears} years of schooling. Prepared ${date(r.generatedAt)} by ${r.carerName || 'the family'} using Hillpath.`, { size: 10 });
  gap(2);
  page.drawRectangle({ x: M, y: y - 26, width: W - 2 * M, height: 30, color: rgb(0.94, 0.95, 0.94) });
  y -= 10;
  text('SIMULATED MODEL. SCREENING ESTIMATE ONLY. NOT A DIAGNOSIS.', { size: 10.5, font: bold, x: M + 8 });
  gap(12);

  text('Screening range', { size: 12, font: bold });
  if (!r.stage) text('No range yet. The monthly check has not been completed.');
  else if (r.stage.abstain) text(`No range is shown: ${r.stage.abstain}`);
  else {
    text(`Answers look similar to: ${r.stage.setLabels.join('; ')}.`, { font: bold });
    const names = ['No impairment', 'Mild change (MCI range)', 'Mild dementia range', 'Moderate or severe range'];
    r.stage.probs.forEach((p, i) => {
      page.drawRectangle({ x: M + 190, y: y - 1, width: Math.max(1, p * 200), height: 8, color: rgb(0.11, 0.37, 0.27) });
      text(`${names[i]}`, { size: 9.5 });
      page.drawText(`${(p * 100).toFixed(0)}%`, { x: M + 395, y: y + 11, size: 9.5, font: reg });
    });
    text(`Model ${r.stage.modelVersion}. Trained on synthetic data only.`, { size: 8.5, color: [0.35, 0.38, 0.36] });
  }
  gap();
  rule();

  text('Scores from the monthly check', { size: 12, font: bold });
  if (!r.instruments) text('No check on record.');
  else {
    const i = r.instruments;
    text(`Checked ${date(i.at)}. Family change score ${i.informant.toFixed(2)} of 5 (Hillpath's own items). Daily tasks needing help ${i.adl} of 8. Animals named in a minute ${i.fluency}. Words recalled ${i.recall} of 10. Orientation ${i.orientation} of 4.`);
    text(`Vision or hearing problem flagged: ${i.visionHearingProblem ? 'yes' : 'no'}. Mood screen positive: ${i.moodScreenPositive ? 'yes' : 'no'}.${i.acute.length ? ` Reported in the last two weeks: ${i.acute.map((a) => a.replaceAll('_', ' ')).join(', ')}.` : ''}`);
  }
  gap();
  rule();

  text('Activity and reminders', { size: 12, font: bold });
  text(`This week: ${r.activity.sessionsThisWeek} scored activities on ${r.activity.daysActive} days, ${r.activity.memoriesAndMusic} memory or music sessions. Medicine and drink reminders: ${r.adherence.taken} confirmed of ${r.adherence.scheduled} due, ${r.adherence.unconfirmed} not confirmed.`);
  if (r.abilities.length) text(`Play ability (90% range, 0 is typical at the start): ${r.abilities.map((a) => `${a.area} ${a.mean.toFixed(1)} (${a.low.toFixed(1)} to ${a.high.toFixed(1)})`).join('; ')}.`, { size: 9 });
  if (r.forecast) text(`Trend forecast (80% range): ${r.forecast.map((f) => `${f.months} months ${f.mean.toFixed(2)} (${f.low80.toFixed(2)} to ${f.high80.toFixed(2)})`).join('; ')}. ${r.forecastNote ?? ''}`, { size: 9 });
  if (r.speech) text(`Speech timing, from ${r.speech.samples} spoken samples (audio not kept): mean pause share ${(r.speech.meanPauseRatio * 100).toFixed(0)}%. Research signal only.`, { size: 9 });
  gap();
  rule();

  text('Alerts', { size: 12, font: bold });
  const room = Math.max(1, Math.floor((y - 200) / 14));
  const shown = r.alerts.slice(0, Math.min(6, room));
  if (shown.length === 0) text('None on record.');
  for (const a of shown) text(`${date(a.at)}, ${a.tier}: ${a.text}`, { size: 9.5 });
  if (r.alerts.length > shown.length) text(`${r.alerts.length - shown.length} more not shown.`, { size: 9 });
  gap();

  text('For the clinician', { size: 12, font: bold });
  text(r.reversibleCausesNote, { size: 9.5 });
  for (const c of CAVEATS) text(`${c}`, { size: 8.5, color: [0.3, 0.33, 0.31] });

  const foot = clean(`Hillpath prototype. Not a medical device. ${fingerprint ? `Signature fingerprint ${fingerprint}.` : ''}`);
  (page as PDFPage).drawText(foot, { x: M, y: 24, size: 8, font: reg, color: rgb(0.4, 0.42, 0.41) });
  return doc.save();
}
