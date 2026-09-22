import { readFileSync } from 'node:fs';
import { gunzipFromB64, gzipToB64, toPages } from '@hillpath/core';
import { expect, test } from '@playwright/test';
import { asFamily, codeText, decodeFrames, pair, paste, runCheck } from './helpers';

test('home visit: consent, a spoken and pictured check, a signed report, and a doctor who can verify it', async ({ browser }) => {
  const family = await (await browser.newContext()).newPage();
  const worker = await (await browser.newContext()).newPage();
  const doctor = await (await browser.newContext({ acceptDownloads: true })).newPage();

  await asFamily(family, 'Ama');
  await worker.goto('/');
  await worker.getByRole('button', { name: 'A community health worker' }).click();
  await expect(worker.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await pair(family, worker, '/#/caregiver/share');

  // Before anyone agrees, the family's report is blocked and the health worker is told to wait.
  await family.goto('/#/caregiver/home');
  await expect(family.getByText('Doctor reports are switched off.')).toBeVisible();
  await family.getByRole('button', { name: 'Open Privacy' }).click();
  await family.getByRole('button', { name: /Community health worker/ }).or(family.locator('li', { hasText: 'Community health worker' }).getByRole('button')).first().click();
  await family.locator('li', { hasText: 'Doctor report' }).getByRole('button').click();
  await expect(family.getByTestId('audit-status')).toContainText('entries');

  // Family syncs to the health worker's phone.
  await family.goto('/#/caregiver/share');
  await family.getByRole('tab', { name: 'Send records' }).click();
  await family.getByRole('button', { name: 'Show all records' }).click();
  const all = await codeText(family);
  await worker.goto('/#/caregiver/share');
  await worker.getByRole('tab', { name: 'Receive records' }).click();
  await paste(worker, all);
  await expect(worker.getByText(/new records added/)).toBeVisible();

  // The visit: consent is shown, each step has a picture and can be read aloud.
  await worker.goto('/#/caregiver/visit');
  await expect(worker.getByTestId('visit-consent')).toContainText('agreed that a community health worker may see');
  await expect(worker.getByTestId('visit-step')).toBeVisible();
  await runCheck(worker);
  await worker.getByRole('button', { name: 'Make the report' }).click();
  await expect(worker.getByTestId('report-ready')).toBeVisible();
  const fingerprint = await worker.getByTestId('report-fingerprint').innerText();
  expect(fingerprint).toMatch(/^[0-9a-f]{8}$/);
  const reportText = await codeText(worker);

  // The doctor's laptop opens it, checks the signature, and can download both files.
  await doctor.goto('/#/report');
  await paste(doctor, reportText);
  await expect(doctor.getByTestId('report-verified')).toContainText(fingerprint);
  await expect(doctor.getByText('Simulated model, trained on synthetic data only. Screening estimate, not a diagnosis.')).toBeVisible();
  await expect(doctor.getByRole('heading', { name: /Ama, age/ })).toBeVisible();
  const [pdf] = await Promise.all([doctor.waitForEvent('download'), doctor.getByRole('button', { name: 'Download the PDF' }).click()]);
  const pdfBytes = readFileSync(await pdf.path());
  expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');
  const [fhir] = await Promise.all([doctor.waitForEvent('download'), doctor.getByRole('button', { name: 'Download the FHIR file' }).click()]);
  const bundle = JSON.parse(readFileSync(await fhir.path(), 'utf8')) as { resourceType: string; type: string; entry: Array<{ resource: { resourceType: string } }> };
  expect(bundle.resourceType).toBe('Bundle');
  expect(bundle.type).toBe('document');
  expect(bundle.entry[0]!.resource.resourceType).toBe('Composition');

  // A changed report is refused.
  const parsed = JSON.parse(await gunzipFromB64(decodeFrames(reportText))) as { data: { instruments: { recall: number } } };
  parsed.data.instruments.recall = 10;
  const tampered = await gzipToB64(JSON.stringify(parsed));
  await doctor.getByRole('button', { name: 'Open another report' }).click();
  await paste(doctor, toPages(tampered).join('\n'));
  await expect(doctor.getByTestId('report-unverified')).toContainText('changed after it was made');
});

test('the report viewer says so plainly when the code is not a report', async ({ page }) => {
  await page.goto('/#/report');
  await paste(page, toPages('garbage')[0]!);
  await expect(page.getByText('That code could not be opened.')).toBeVisible();
});
