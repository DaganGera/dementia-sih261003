import { expect, test } from '@playwright/test';
import { asFamily } from './helpers';

/** F24 (Simulated): the panel's default, honest state before there is enough play to say anything. */
test('time of day panel waits for enough sessions before it says anything, and the patient sees no evening note by default', async ({ page }) => {
  await asFamily(page, 'Ama');
  await page.goto('/#/caregiver/home');
  const card = page.getByTestId('tod-card');
  await expect(card).toContainText('Not enough activity yet to see a pattern.');
  await expect(card).not.toContainText('Evenings seem harder');

  await page.goto('/#/patient');
  await expect(page.getByTestId('evening-note')).toHaveCount(0);
});
