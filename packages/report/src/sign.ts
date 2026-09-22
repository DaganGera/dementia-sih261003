import { canonicalJson, fromB64, gunzipFromB64, gzipToB64, sha256Bytes, sign, toB64, toHex, utf8, verify } from '@hillpath/core';
import { buildFhirBundle, checkBundle, type FhirBundle } from './fhir';
import type { ReportInput } from './types';

/**
 * A report is the data, the FHIR bundle made from it, and an Ed25519 signature over both.
 * The signature shows the report was not changed after the family phone made it. It does not prove who the family is.
 */
export interface SignedReport {
  v: 1;
  data: ReportInput;
  fhir: FhirBundle;
  sha256: string;
  sig: string;
  pub: string;
}

const digest = (data: ReportInput, fhir: FhirBundle) => sha256Bytes(utf8(canonicalJson({ data, fhir })));

export function signReport(data: ReportInput, signSecret: Uint8Array, signPublic: Uint8Array): SignedReport {
  const fhir = buildFhirBundle(data);
  const problems = checkBundle(fhir);
  if (problems.length) throw new Error(`The report could not be built: ${problems[0]}`);
  const d = digest(data, fhir);
  return { v: 1, data, fhir, sha256: toHex(d), sig: toB64(sign(signSecret, d)), pub: toB64(signPublic) };
}

export interface Verification {
  ok: boolean;
  reason: string | null;
  /** First 8 characters of the hash, for printing on the page. */
  fingerprint: string;
}

export function verifyReport(r: SignedReport): Verification {
  if (r.v !== 1) return { ok: false, reason: 'This report is in a format Hillpath does not know.', fingerprint: '' };
  const d = digest(r.data, r.fhir);
  const fingerprint = toHex(d).slice(0, 8);
  if (toHex(d) !== r.sha256) return { ok: false, reason: 'The report was changed after it was made.', fingerprint };
  if (!verify(fromB64(r.pub), d, fromB64(r.sig))) return { ok: false, reason: 'The signature does not match.', fingerprint };
  return { ok: true, reason: null, fingerprint };
}

export const reportToText = (r: SignedReport) => gzipToB64(JSON.stringify(r));

export async function reportFromText(text: string): Promise<SignedReport> {
  let raw: unknown;
  try {
    raw = JSON.parse(await gunzipFromB64(text));
  } catch {
    throw new Error('That code is not a Hillpath report.');
  }
  const r = raw as Partial<SignedReport>;
  if (r.v !== 1 || !r.data || !r.fhir || !r.sig || !r.pub || !r.sha256) throw new Error('That code is not a Hillpath report.');
  return r as SignedReport;
}
