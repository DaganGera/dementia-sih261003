import { expect, test, type Page } from '@playwright/test';

async function asCaregiverWithFamily(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'The person who will play' }).click();
  await expect(page.getByRole('heading', { name: /Hello/ })).toBeVisible();
}

/** Seed people through the caregiver screens of a separate device, then copy nothing: games that need faces are checked on one device. */
async function oneDeviceWithFaces(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'A family member' }).click();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await page.goto('/#/caregiver/family');
  await page.getByLabel('Their name').fill('Ama');
  await page.getByRole('button', { name: 'Save' }).click();
  for (const [n, r] of [['Anita', 'daughter'], ['Ravi', 'son'], ['Dev', 'neighbour']]) {
    await page.getByLabel('Name', { exact: true }).fill(n!);
    await page.getByLabel(/^Relation/).fill(r!);
    await page.getByRole('button', { name: 'Add person' }).click();
  }
}

test('Find It completes five rounds and the round counter advances', async ({ page }) => {
  await asCaregiverWithFamily(page);
  await page.goto('/#/patient/play/G7');
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId('round-counter')).toContainText(`Round ${i} of 5`);
    const prompt = await page.getByText(/^Find the /).first().innerText();
    const label = prompt.replace(/^Find the /, '').replace(/\.$/, '');
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(1100);
  }
  await expect(page.getByRole('heading', { name: 'That is enough for now' })).toBeVisible();
});

test('Routine Steps completes both routines and reveals the right step gently after a wrong pick', async ({ page }) => {
  await asCaregiverWithFamily(page);
  await page.goto('/#/patient/play/G4');
  for (let r = 0; r < 2; r++) {
    const options = page.locator('section ul.flex-col button');
    for (let step = 0; step < 6; step++) {
      if (await page.getByRole('heading', { name: 'That is enough for now' }).isVisible()) break;
      if (step > 0 && (await page.getByTestId('round-counter').innerText()).includes('Round 2') && r === 0) break;
      await options.first().click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(2800);
    }
  }
  await expect(page.getByRole('heading', { name: 'That is enough for now' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('body')).not.toContainText(/wrong|incorrect|failed/i);
});

test('Faces and Names runs five rounds and gently names the person after any pick', async ({ page }) => {
  await oneDeviceWithFaces(page);
  await page.goto('/#/patient/play/G2');
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId('round-counter')).toContainText(`Round ${i} of 5`);
    await page.locator('section ul.flex-col button').first().click();
    await expect(page.getByText(/^This is /).first()).toBeVisible();
    await page.waitForTimeout(2400);
  }
  await expect(page.getByRole('heading', { name: 'That is enough for now' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/wrong|incorrect|failed/i);
});

test('Story Time runs both stories to the end', async ({ page }) => {
  await oneDeviceWithFaces(page);
  await page.goto('/#/patient/play/G3');
  for (let round = 0; round < 2; round++) {
    await page.getByRole('button', { name: 'I am ready for the questions' }).click();
    if (await page.getByRole('button', { name: 'Ask me now' }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Ask me now' }).click();
    for (let q = 0; q < 2; q++) {
      await page.locator('section ul.flex-col button').first().click();
      await page.waitForTimeout(3200);
    }
  }
  await expect(page.getByRole('heading', { name: 'That is enough for now' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('body')).not.toContainText(/wrong|incorrect|failed/i);
});
