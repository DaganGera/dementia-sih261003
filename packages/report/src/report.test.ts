import { newDeviceKeys, toB64 } from '@hillpath/core';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildFhirBundle, buildPdf, checkBundle, reportFromText, reportToText, REVERSIBLE_NOTE, signReport, verifyReport, type ReportInput } from './index';

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  generatedAt: Date.UTC(2026, 8, 22, 10, 0),
  patient: { id: 'p-1', name: 'Ama Devi', age: 78, schoolingYears: 4 },
  carerName: 'Anita',
  author: { deviceId: 'dev-1', role: 'caregiver' },
  stage: { modelVersion: 'm2-ordinal-sim-0.1', maturity: 'Simulated', probs: [0.2, 0.5, 0.25, 0.05], setLabels: ['a mild change range', 'a mild dementia range'], abstain: null, contributions: [{ feature: 'recall_z', effect: 0.9 }] },
  instruments: { at: Date.UTC(2026, 8, 20, 9, 0), informant: 3.4, adl: 2, fluency: 11, recall: 4, orientation: 3, visionHearingProblem: false, moodScreenPositive: false, acute: [] },
  abilities: [{ area: 'Attention', mean: -0.3, low: -0.9, high: 0.3 }],
  forecast: [{ months: 3, mean: -0.35, low80: -0.9, high80: 0.2 }],
  forecastNote: 'Too early to see a personal trend.',
  alerts: [{ tier: 'attention', text: 'Morning tablet: the person was not sure if it was done.', at: Date.UTC(2026, 8, 21, 8, 0) }],
  adherence: { scheduled: 10, taken: 8, unconfirmed: 2 },
  activity: { sessionsThisWeek: 5, daysActive: 4, memoriesAndMusic: 2 },
  speech: { samples: 3, meanPauseRatio: 0.28 },
  reversibleCausesNote: REVERSIBLE_NOTE,
  ...over,
});

describe('FHIR bundle', () => {
  it('is a valid-looking document bundle with the Composition first and every reference resolved', () => {
    const b = buildFhirBundle(input());
    expect(checkBundle(b)).toEqual([]);
    expect(b.entry[0]!.resource.resourceType).toBe('Composition');
    const kinds = b.entry.map((e) => e.resource.resourceType);
    expect(kinds).toEqual(expect.arrayContaining(['Patient', 'Device', 'Observation', 'RiskAssessment']));
  });

  it('is deterministic for the same report', () => {
    expect(JSON.stringify(buildFhirBundle(input()))).toBe(JSON.stringify(buildFhirBundle(input())));
  });

  it('marks the model as simulated and never claims a diagnosis or a profile', () => {
    const json = JSON.stringify(buildFhirBundle(input()));
    expect(json).toContain('Simulated model trained on synthetic data only');
    expect(json).not.toMatch(/"profile"|nrces\.in|diagnosis of|Condition/);
    expect(json).not.toMatch(new RegExp('[\\u2013\\u2014]'));
  });

  it('carries the abstain reason instead of a range, and reports acute items', () => {
    const b = buildFhirBundle(input({ stage: { modelVersion: 'm', maturity: 'Simulated', probs: [0.25, 0.25, 0.25, 0.25], setLabels: [], abstain: 'A recent sudden change was reported.', contributions: [] }, instruments: { at: 1, informant: 3, adl: 0, fluency: 10, recall: 5, orientation: 4, visionHearingProblem: false, moodScreenPositive: false, acute: ['sudden_confusion'] } }));
    const json = JSON.stringify(b);
    expect(json).toContain('No range shown: A recent sudden change was reported.');
    expect(json).toContain('sudden confusion');
    expect(checkBundle(b)).toEqual([]);
  });

  it('the structural check catches an unresolved reference', () => {
    const b = buildFhirBundle(input());
    (b.entry[1]!.resource as { subject?: unknown }).subject = { reference: 'urn:uuid:missing' };
    expect(checkBundle(b).some((p) => p.includes('Unresolved'))).toBe(true);
  });
});

describe('signed report', () => {
  const keys = newDeviceKeys();

  it('verifies, survives the trip through text, and fails when anything is changed', async () => {
    const signed = signReport(input(), keys.signSecret, keys.signPublic);
    expect(verifyReport(signed).ok).toBe(true);
    const back = await reportFromText(await reportToText(signed));
    expect(verifyReport(back).ok).toBe(true);
    const tampered = structuredClone(back);
    tampered.data.instruments!.recall = 10;
    const v = verifyReport(tampered);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/changed/);
    const wrongKey = { ...back, pub: toB64(newDeviceKeys().signPublic) };
    expect(verifyReport(wrongKey).ok).toBe(false);
  });

  it('rejects text that is not a report', async () => {
    await expect(reportFromText('nonsense')).rejects.toThrow(/not a Hillpath report/);
  });
});

describe('one page PDF', () => {
  it('is a single A4 page even with many alerts, and stays small', async () => {
    const many = input({ alerts: Array.from({ length: 40 }, (_, i) => ({ tier: 'info', text: `Alert number ${i} with some plain words to fill the line and wrap a little further along the page.`, at: 1_700_000_000_000 + i })) });
    const bytes = await buildPdf(many, 'abcd1234');
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 595, height: 842 });
    expect(bytes.length).toBeLessThan(60_000);
  });

  it('builds when there is no range and no check yet', async () => {
    const bytes = await buildPdf(input({ stage: null, instruments: null, forecast: null, speech: null, alerts: [] }));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
