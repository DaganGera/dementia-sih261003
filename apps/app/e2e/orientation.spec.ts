import { expect, test } from '@playwright/test';
import { asFamily } from './helpers';

/** F23: day, date, season and the next approved festival, hidden from the person until the family approves it. */
test('orientation board hides a new festival until the family approves it, then shows the right countdown', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 2, 1, 9, 0) }); // 1 March 2026, a Sunday
  await asFamily(page, 'Ama');

  await page.goto('/#/caregiver/family');
  await page.getByLabel('Festival name').fill('Bihu');
  await page.getByLabel('Month').selectOption('4');
  await page.getByLabel('Day', { exact: true }).fill('14');
  await page.getByLabel('Source (where this date comes from)').fill('Community calendar');
  await page.getByRole('button', { name: 'Add festival' }).click();
  await expect(page.getByText('It is not shown to the person yet')).toBeVisible();
  await expect(page.getByText('Not shown to the person yet: pending review.')).toBeVisible();

  // Not approved yet: the person's board shows the date but no festival line.
  await page.goto('/#/patient/day');
  const board = page.getByTestId('orientation-board');
  await expect(board).toContainText('Sunday');
  await expect(board).toContainText('March 1, 2026');
  await expect(board).toContainText('Summer');
  await expect(page.getByTestId('next-festival')).toHaveCount(0);

  // Approve it, then it appears with the right day count (44 days from 1 March to 14 April).
  await page.goto('/#/caregiver/family');
  await page.getByRole('button', { name: 'Approve for the person' }).click();
  await expect(page.getByText('Shown to the person.')).toBeVisible();

  await page.goto('/#/patient/day');
  await expect(page.getByTestId('next-festival')).toContainText('Bihu in 44 days.');

  // Hiding it again removes it from the board without deleting it.
  await page.goto('/#/caregiver/family');
  await page.getByRole('button', { name: 'Hide from the person' }).click();
  await page.goto('/#/patient/day');
  await expect(page.getByTestId('next-festival')).toHaveCount(0);
});

test('an impossible date is refused before it is added', async ({ page }) => {
  await asFamily(page, 'Ama');
  await page.goto('/#/caregiver/family');
  await page.getByLabel('Festival name').fill('Made up day');
  await page.getByLabel('Month').selectOption('2');
  await page.getByLabel('Day', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Add festival' }).click();
  await expect(page.getByText('That date does not exist.')).toBeVisible();
  await expect(page.getByText('No festivals added yet.')).toBeVisible();
});
