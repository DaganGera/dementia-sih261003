import { expect, test, type Page } from '@playwright/test';

async function setUp(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'A family member' }).click();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await page.goto('/#/caregiver/family');
  await page.getByLabel('Their name').fill('Ama');
  await page.getByLabel('Years of schooling').fill('4');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
}

async function runCheck(page: Page, opts: { acute?: string } = {}) {
  await page.goto('/#/caregiver/check');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click(); // family questions left at "about the same"
  await page.getByLabel('Dressing').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start the minute' }).click();
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Count one animal' }).click();
  await page.getByRole('button', { name: 'Finish now' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (const w of ['river', 'chair', 'lamp', 'bread', 'mango', 'bell']) await page.getByRole('button', { name: w, exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click(); // orientation all yes
  await page.getByRole('button', { name: 'Next' }).click(); // mood
  if (opts.acute) await page.getByLabel(opts.acute).check();
  await page.getByRole('button', { name: 'Save the check' }).click();
  await expect(page.getByText('The check is saved.')).toBeVisible();
}

test('monthly check gives a range that says it is not a diagnosis, and a sudden change is routed to a same-day health check', async ({ page }) => {
  await setUp(page);
  await runCheck(page);
  await page.goto('/#/caregiver/home');
  await expect(page.getByTestId('stage-headline')).toContainText('not a diagnosis');
  await expect(page.getByText('Simulated model: trained on synthetic data only. Not a diagnosis.')).toBeVisible();
  await expect(page.getByTestId('stage-card')).not.toContainText(/you have|is fine|nothing wrong/i);

  await runCheck(page, { acute: 'Sudden confusion' });
  await page.goto('/#/caregiver/home');
  await expect(page.getByTestId('abrupt-alert')).toContainText('please arrange a health check today');
  await expect(page.getByTestId('stage-card')).toContainText('A recent sudden change was reported');
  await expect(page.getByTestId('stage-headline')).toContainText('No range is shown right now');
});

test('stroke signs send the family to call 108', async ({ page }) => {
  await setUp(page);
  await runCheck(page, { acute: 'Trouble speaking' });
  await page.goto('/#/caregiver/home');
  await expect(page.getByTestId('abrupt-alert')).toContainText('Call 108 now');
});

test('the time machine shows a labelled simulation and raises the sudden-change alert', async ({ page }) => {
  await page.goto('/#/demo');
  await expect(page.getByText(/Simulated person. Nothing here is a real patient/)).toBeVisible();
  await page.getByLabel('Simulated day').fill('200');
  await expect(page.getByTestId('tm-alerts')).toBeVisible();
  await expect(page.getByTestId('tm-alerts')).toContainText('please arrange a health check today');
  await page.getByLabel('Scenario').selectOption('S1_stable');
  await page.getByLabel('Simulated day').fill('364');
  await expect(page.getByText('None yet.')).toBeVisible();
});
