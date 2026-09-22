import { BURDEN_ITEMS } from '@hillpath/core';
import { expect, test, type Page } from '@playwright/test';
import { asFamily, asTablet, codeText, pair, paste } from './helpers';

async function answerAll(page: Page, option: string) {
  for (const item of BURDEN_ITEMS) await page.getByRole('group', { name: item.text }).getByText(option, { exact: true }).click();
}

test('carer check-in stays on the phone, lowers non-urgent alerts and survives a reload', async ({ page }) => {
  await asFamily(page, 'Ama');
  await page.goto('/#/caregiver/home');
  const card = page.getByTestId('burden-card');
  await expect(card).toContainText('not a validated scale');
  await expect(page.getByTestId('alert-plan')).not.toContainText('Fewer non-urgent');

  await card.getByRole('button', { name: 'Check in with yourself' }).click();
  await expect(card.getByRole('button', { name: 'Save my check-in' })).toBeDisabled();
  await answerAll(page, 'Almost always');
  await card.getByRole('button', { name: 'Save my check-in' }).click();
  await expect(page.getByTestId('burden-support')).toContainText('You are carrying a lot.');
  await expect(page.getByTestId('burden-support')).toContainText('health worker');
  await expect(page.getByTestId('burden-support')).not.toContainText(/depress|disorder|diagnos/i);
  await expect(page.getByTestId('alert-plan')).toContainText('Fewer non-urgent alerts are sent while you are stretched.');

  await page.reload();
  await expect(page.getByTestId('burden-support')).toContainText('You are carrying a lot.');
  await expect(page.getByTestId('alert-plan')).toContainText('Fewer non-urgent');

  // Answers are device-only: nothing about them is in the synced records.
  const inRecords = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('hillpath');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const keys = await new Promise<IDBValidKey[]>((res) => {
      const r = db.transaction('meta').objectStore('meta').getAllKeys();
      r.onsuccess = () => res(r.result);
    });
    return keys.map(String);
  });
  expect(inRecords).toContain('secret:local');
});

test('family area lock: PIN with slower retries, device unlock, and a reset from the family phone', async ({ browser }) => {
  const family = await (await browser.newContext()).newPage();
  const tabletCtx = await browser.newContext();
  const tablet = await tabletCtx.newPage();

  // A virtual platform authenticator stands in for a fingerprint or screen lock.
  const cdp = await tabletCtx.newCDPSession(tablet);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  await asFamily(family, 'Ama');
  await asTablet(tablet);
  await pair(family, tablet);

  // Set a PIN. Bad input is refused; a good one locks the area.
  await tablet.goto('/#/patient/family');
  await tablet.getByText('Lock this area with a PIN').click();
  await expect(tablet.getByRole('button', { name: 'Set the PIN' })).toBeDisabled();
  await tablet.getByLabel('Choose a PIN (4 to 8 digits)').fill('2468');
  await tablet.getByRole('button', { name: 'Set the PIN' }).click();
  await expect(tablet.getByText('The PIN is set.')).toBeVisible();
  await tablet.getByRole('button', { name: 'Add device unlock' }).click();
  await expect(tablet.getByText('Device unlock is on.').first()).toBeVisible();
  await tablet.getByRole('button', { name: 'Lock now' }).click();

  // Locked. A wrong PIN is refused, the right one opens.
  const pinBox = tablet.getByLabel('Family PIN');
  await pinBox.fill('1111');
  await tablet.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(tablet.getByRole('alert')).toContainText('That PIN did not match');
  await expect(tablet.getByRole('tab', { name: 'Pair a device' })).toHaveCount(0);
  await pinBox.fill('2468');
  await tablet.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(tablet.getByRole('tab', { name: 'Pair a device' })).toBeVisible();

  // The stored record is a salted hash, never the PIN itself.
  const stored = await tablet.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res) => { const r = indexedDB.open('hillpath'); r.onsuccess = () => res(r.result); });
    const rows = await new Promise<unknown[]>((res) => { const r = db.transaction('meta').objectStore('meta').getAll(); r.onsuccess = () => res(r.result); });
    return JSON.stringify(rows, (_k, v) => (v instanceof ArrayBuffer || ArrayBuffer.isView(v) || v instanceof CryptoKey ? '[binary]' : v));
  });
  expect(stored).not.toContain('2468');

  // Device unlock works after locking again.
  await tablet.getByRole('button', { name: 'Lock now' }).click().catch(async () => {
    await tablet.getByText('Lock settings').click();
    await tablet.getByRole('button', { name: 'Lock now' }).click();
  });
  await tablet.getByRole('button', { name: 'Use device unlock instead' }).click();
  await expect(tablet.getByRole('tab', { name: 'Pair a device' })).toBeVisible();

  // Five wrong tries: retries slow down, and the button stays off.
  await tablet.getByText('Lock settings').click();
  await tablet.getByRole('button', { name: 'Lock now' }).click();
  for (let i = 0; i < 5; i++) {
    await tablet.getByLabel('Family PIN').fill('9999');
    await tablet.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(tablet.getByRole('alert')).toBeVisible();
  }
  await expect(tablet.getByRole('alert')).toContainText('Too many tries');
  await tablet.getByLabel('Family PIN').fill('2468');
  await expect(tablet.getByRole('button', { name: 'Open', exact: true })).toBeDisabled();

  // The family phone asks for a reset, shows all records, and the tablet scans them.
  await family.goto('/#/caregiver/privacy');
  await family.getByRole('button', { name: 'Reset the tablet PIN' }).click();
  await expect(family.getByText('Done. Share records with the tablet to finish.')).toBeVisible();
  await family.goto('/#/caregiver/share');
  await family.getByRole('tab', { name: 'Send records' }).click();
  await family.getByRole('button', { name: 'Show all records' }).click();
  const all = await codeText(family);
  await tablet.getByText('Forgot the PIN?').click();
  await paste(tablet, all);
  await expect(tablet.getByRole('tab', { name: 'Pair a device' })).toBeVisible();
  await tablet.reload();
  await tablet.goto('/#/patient/family');
  await expect(tablet.getByRole('tab', { name: 'Pair a device' })).toBeVisible();
  await expect(tablet.getByText('Lock this area with a PIN')).toBeVisible();
});
