import type { ReportInput } from './types';

/**
 * A FHIR R4 document Bundle. It uses plain R4 resources with text codes only. No coding system or ABDM profile is claimed:
 * mapping to the NRCeS profiles and validation with the HL7 validator are not done (see docs/known-gaps.md).
 */
export interface FhirResource {
  resourceType: string;
  id: string;
  [k: string]: unknown;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  id: string;
  type: 'document';
  timestamp: string;
  entry: Array<{ fullUrl: string; resource: FhirResource }>;
}

const iso = (ms: number) => new Date(ms).toISOString();

function uuid(seed: string): string {
  // Deterministic ids from the content so the same report gives the same bundle.
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ seed.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  const a = hex(h1) + hex(h2) + hex(Math.imul(h1, 31) >>> 0) + hex(Math.imul(h2, 17) >>> 0);
  return `${a.slice(0, 8)}-${a.slice(8, 12)}-4${a.slice(13, 16)}-8${a.slice(17, 20)}-${a.slice(20, 32)}`;
}

const STAGE_TEXT: Record<string, string> = {
  no_impairment: 'No sign of impairment',
  mci_range: 'Mild change range (possible MCI, CDR 0.5)',
  mild_range: 'Mild dementia range (CDR 1)',
  moderate_or_severe_range: 'Moderate or severe range (CDR 2 or more)',
};

export function buildFhirBundle(r: ReportInput): FhirBundle {
  const ids = {
    patient: uuid(`patient:${r.patient.id}`),
    device: uuid(`device:${r.author.deviceId}`),
    composition: uuid(`composition:${r.patient.id}:${r.generatedAt}`),
  };
  const ref = (id: string) => ({ reference: `urn:uuid:${id}` });
  const entries: Array<{ fullUrl: string; resource: FhirResource }> = [];
  const add = (resource: FhirResource) => entries.push({ fullUrl: `urn:uuid:${resource.id}`, resource });

  const observations: FhirResource[] = [];
  const obs = (key: string, text: string, value: Record<string, unknown>, at: number, note?: string) => {
    const o: FhirResource = {
      resourceType: 'Observation',
      id: uuid(`obs:${key}:${r.patient.id}:${at}`),
      status: 'preliminary',
      code: { text },
      subject: ref(ids.patient),
      effectiveDateTime: iso(at),
      ...value,
      ...(note ? { note: [{ text: note }] } : {}),
    };
    observations.push(o);
    return o;
  };

  obs('age', 'Age in years', { valueQuantity: { value: r.patient.age, unit: 'years' } }, r.generatedAt);
  obs('schooling', 'Years of schooling', { valueQuantity: { value: r.patient.schoolingYears, unit: 'years' } }, r.generatedAt);
  if (r.instruments) {
    const i = r.instruments;
    obs('informant', 'Family change score, 1 (much better) to 5 (much worse). Hillpath own items, not IQCODE', { valueQuantity: { value: Number(i.informant.toFixed(2)), unit: 'score' } }, i.at);
    obs('adl', 'Daily tasks needing help, count of 8', { valueInteger: i.adl }, i.at);
    obs('fluency', 'Animals named in one minute', { valueInteger: i.fluency }, i.at);
    obs('recall', 'Words recalled after a delay, of 10', { valueInteger: i.recall }, i.at);
    obs('orientation', 'Orientation questions answered, of 4', { valueInteger: i.orientation }, i.at);
    obs('vision', 'Vision or hearing problem flagged', { valueBoolean: i.visionHearingProblem }, i.at);
    obs('mood', 'Mood screen positive (two-question PHQ-2 pattern, score of 3 or more)', { valueBoolean: i.moodScreenPositive }, i.at);
    for (const a of i.acute) obs(`acute:${a}`, `Reported in the last two weeks: ${a.replaceAll('_', ' ')}`, { valueBoolean: true }, i.at);
  }

  let risk: FhirResource | null = null;
  if (r.stage) {
    risk = {
      resourceType: 'RiskAssessment',
      id: uuid(`risk:${r.patient.id}:${r.generatedAt}`),
      status: 'preliminary',
      subject: ref(ids.patient),
      occurrenceDateTime: iso(r.generatedAt),
      method: { text: `${r.stage.modelVersion} (${r.stage.maturity})` },
      ...(r.stage.abstain ? { note: [{ text: `No range shown: ${r.stage.abstain}` }] } : {}),
      prediction: r.stage.probs.map((p, idx) => ({
        outcome: { text: STAGE_TEXT[['no_impairment', 'mci_range', 'mild_range', 'moderate_or_severe_range'][idx]!] },
        probabilityDecimal: Number(p.toFixed(4)),
      })),
    };
    (risk as { note?: unknown }).note = [
      ...(((risk as { note?: Array<{ text: string }> }).note) ?? []),
      { text: 'Simulated model trained on synthetic data only. Screening estimate, not a diagnosis.' },
    ];
  }

  add({ resourceType: 'Patient', id: ids.patient, name: [{ text: r.patient.name }], active: true });
  add({ resourceType: 'Device', id: ids.device, status: 'active', deviceName: [{ name: 'Hillpath prototype', type: 'user-friendly-name' }], type: { text: 'Screening support software, prototype, not a medical device' } });
  for (const o of observations) add(o);
  if (risk) add(risk);

  const section = (title: string, resources: FhirResource[], text: string) => ({ title, text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escapeHtml(text)}</p></div>` }, entry: resources.map((x) => ref(x.id)) });
  const composition: FhirResource = {
    resourceType: 'Composition',
    id: ids.composition,
    status: 'preliminary',
    type: { text: 'Cognitive screening summary from a family-run check' },
    subject: ref(ids.patient),
    date: iso(r.generatedAt),
    author: [ref(ids.device)],
    title: `Cognitive screening summary for ${r.patient.name}`,
    section: [
      section('Screening range', risk ? [risk] : [], r.stage ? (r.stage.abstain ? `No range shown: ${r.stage.abstain}` : `Answers look similar to: ${r.stage.setLabels.join(', ')}. Simulated model, not a diagnosis.`) : 'No screening range yet.'),
      section('Instruments and background', observations, 'Scores from the monthly check and background facts.'),
      section('Reversible causes', [], r.reversibleCausesNote),
    ],
  };
  const all: Array<{ fullUrl: string; resource: FhirResource }> = [{ fullUrl: `urn:uuid:${composition.id}`, resource: composition }, ...entries];
  return { resourceType: 'Bundle', id: uuid(`bundle:${r.patient.id}:${r.generatedAt}`), type: 'document', timestamp: iso(r.generatedAt), entry: all };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Structural checks only. It is not a substitute for the HL7 validator. Returns a list of problems. */
export function checkBundle(b: FhirBundle): string[] {
  const problems: string[] = [];
  if (b.resourceType !== 'Bundle' || b.type !== 'document') problems.push('Not a document Bundle');
  const urls = new Set(b.entry.map((e) => e.fullUrl));
  if (urls.size !== b.entry.length) problems.push('Duplicate fullUrl');
  const first = b.entry[0]?.resource;
  if (first?.resourceType !== 'Composition') problems.push('First entry must be the Composition');
  const refs: string[] = [];
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if (k === 'reference' && typeof v === 'string') refs.push(v);
        else walk(v);
      }
    }
  };
  b.entry.forEach((e) => walk(e.resource));
  for (const rf of refs) if (!urls.has(rf)) problems.push(`Unresolved reference ${rf}`);
  for (const { resource: x } of b.entry) {
    if (x.resourceType === 'Composition') for (const f of ['status', 'type', 'date', 'author', 'title', 'subject']) if (!x[f]) problems.push(`Composition.${f} missing`);
    if (x.resourceType === 'Observation') for (const f of ['status', 'code', 'subject']) if (!x[f]) problems.push(`Observation.${f} missing`);
    if (x.resourceType === 'RiskAssessment' && !Array.isArray(x.prediction)) problems.push('RiskAssessment.prediction missing');
  }
  return problems;
}
