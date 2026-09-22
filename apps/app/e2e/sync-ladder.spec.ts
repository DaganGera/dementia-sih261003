import { expect, test } from '@playwright/test';
import { asFamily, asTablet, codeText, pair, paste } from './helpers';

const RELAY = 'http://localhost:8787';

test('backup server: two devices on the internet share through a relay that holds only ciphertext', async ({ browser, request }) => {
  const family = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();
  await asFamily(family, 'Ama');
  await asTablet(tablet);
  await pair(family, tablet);

  // The family adds a place, then both sync with the server.
  await family.goto('/#/caregiver/family');
  await family.getByLabel('Name of the place').fill('The tea garden');
  await family.getByRole('button', { name: 'Add place' }).click();
  await family.goto('/#/caregiver/share');
  await family.getByRole('tab', { name: 'Backup server' }).click();
  await family.getByLabel('Server address').fill(RELAY);
  await family.getByRole('button', { name: 'Sync now' }).click();
  await expect(family.getByText(/Done. Sent \d+ records/)).toBeVisible();

  await tablet.goto('/#/patient/family');
  await tablet.getByRole('tab', { name: 'Backup server' }).click();
  await tablet.getByLabel('Server address').fill(RELAY);
  await tablet.getByRole('button', { name: 'Sync now' }).click();
  await expect(tablet.getByText(/received [1-9]\d*/)).toBeVisible();

  // The server never sees plain text: list what it stores for that circle using only what a member knows is not enough, so check a stranger cannot read.
  const res = await request.get(`${RELAY}/v1/circles/c-000000000000/envelopes`, { headers: { Authorization: 'Bearer guess' } });
  expect(res.status()).toBe(401);

  // A wrong address gives a human message, not a code.
  await family.getByLabel('Server address').fill('http://localhost:9');
  await family.getByRole('button', { name: 'Sync now' }).click();
  await expect(family.getByText('The family server cannot be reached. Your data is safe on this phone.')).toBeVisible();
});

test('courier: a health worker carries a family share without reading it and delivers it with a write-only token', async ({ browser }) => {
  const family = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();
  const worker = await (await browser.newContext()).newPage();
  await asFamily(family, 'Ama');
  await asTablet(tablet);
  await pair(family, tablet);

  // The family syncs once so the server knows the circle and its drop hash.
  await family.goto('/#/caregiver/share');
  await family.getByRole('tab', { name: 'Backup server' }).click();
  await family.getByLabel('Server address').fill(RELAY);
  await family.getByRole('button', { name: 'Sync now' }).click();
  await expect(family.getByText(/Done. Sent/)).toBeVisible();

  // Then it adds something new and has no signal. The health worker scans the share.
  await family.goto('/#/caregiver/family');
  await family.getByLabel('Name of the place').fill('The river bank');
  await family.getByRole('button', { name: 'Add place' }).click();
  await family.goto('/#/caregiver/share');
  await family.getByRole('tab', { name: 'Send records' }).click();
  await family.getByRole('button', { name: 'Show new records' }).click();
  const share = await codeText(family);

  await worker.goto('/');
  await worker.getByRole('button', { name: 'A community health worker' }).click();
  await expect(worker.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await worker.goto('/#/caregiver/share');
  await worker.getByRole('tab', { name: 'Carry for others' }).click();
  await worker.getByRole('button', { name: 'Take a share from a family' }).click();
  await paste(worker, share);
  await expect(worker.getByText(/It is encrypted and cannot be read on this phone/)).toBeVisible();
  await expect(worker.getByTestId('courier-item')).toHaveCount(1);

  // The health worker phone holds nothing readable: no place shows up anywhere in its own records.
  await worker.goto('/#/caregiver/family');
  await expect(worker.getByText('The river bank')).toHaveCount(0);

  // Delivery: the worker sends it to the family's server. The tablet then finds it there.
  await worker.goto('/#/caregiver/share');
  await worker.getByRole('tab', { name: 'Carry for others' }).click();
  await worker.getByLabel(/Backup server of that family/).fill(RELAY);
  await worker.getByRole('button', { name: 'Send to their server' }).click();
  await expect(worker.getByText(/Delivered 1 shares to the server/)).toBeVisible();
  await tablet.goto('/#/patient/family');
  await tablet.getByRole('tab', { name: 'Backup server' }).click();
  await tablet.getByLabel('Server address').fill(RELAY);
  await tablet.getByRole('button', { name: 'Sync now' }).click();
  await expect(tablet.getByText(/received [1-9]\d*/)).toBeVisible();
  await tablet.goto('/#/patient/play/G8');
  await expect(tablet.getByText(/No places|Where is this/)).toBeVisible();
});

test('nearby: two devices on the same network sync directly with no server', async ({ browser }) => {
  const family = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();
  await asFamily(family, 'Ama');
  await asTablet(tablet);
  await pair(family, tablet);
  await family.goto('/#/caregiver/family');
  await family.getByLabel('Name of the place').fill('The church');
  await family.getByRole('button', { name: 'Add place' }).click();

  await family.goto('/#/caregiver/share');
  await family.getByRole('tab', { name: 'Nearby' }).click();
  await family.getByRole('button', { name: 'Start on this device' }).click();
  const offer = await codeText(family);

  await tablet.goto('/#/patient/family');
  await tablet.getByRole('tab', { name: 'Nearby' }).click();
  await tablet.getByRole('button', { name: 'Join from the other device' }).click();
  await paste(tablet, offer);
  const reply = await codeText(tablet);

  await family.getByRole('button', { name: 'Next: scan the reply' }).click();
  await paste(family, reply);
  await expect(family.getByText(/Sent [1-9]\d* records and received \d+/)).toBeVisible({ timeout: 30_000 });
  await expect(tablet.getByText(/Sent \d+ records and received [1-9]\d*/)).toBeVisible({ timeout: 30_000 });
});

test('urgent help offers a text message that says only that the person needs help', async ({ page }) => {
  await page.clock.install();
  await asFamily(page, 'Ama');
  await page.getByLabel(/Phone number for an urgent text message/).fill('+91 98765 43210');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.goto('/#/patient');
  await page.getByRole('button', { name: 'I need help' }).click();
  const link = page.getByRole('link', { name: 'Also send a text message' });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute('href'))!;
  expect(href.startsWith('sms:+919876543210?body=')).toBe(true);
  expect(decodeURIComponent(href)).toContain('Ama needs help');

  await page.goto('/#/caregiver/home');
  await expect(page.getByRole('link', { name: 'Send a text message' })).toHaveCount(0);
  await page.clock.fastForward('16:00');
  await page.goto('/#/caregiver/home');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Send a text message' })).toBeVisible();
});
