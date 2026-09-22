import { expect, test } from '@playwright/test';
import { asFamily } from './helpers';

/** F-language: English is the only usable language; everything else is honestly Planned. */
test('language picker: English is in use, every other language is Planned and cannot be selected', async ({ page }) => {
  await asFamily(page, 'Ama');
  await page.goto('/#/caregiver/family');
  const list = page.getByRole('list', { name: 'Languages' });
  await expect(list.getByText('English')).toBeVisible();
  const english = list.locator('li', { hasText: 'English' });
  await expect(english.getByRole('button', { name: 'In use' })).toBeVisible();

  const hindi = list.locator('li', { hasText: 'Hindi' });
  await expect(hindi.getByText('Planned. Help us add this language.')).toBeVisible();
  const hindiButton = hindi.getByRole('button', { name: 'Planned' });
  await expect(hindiButton).toBeDisabled();

  // The patient's own screen stays in English: the greeting matches the built-in string exactly.
  await page.goto('/#/patient');
  await expect(page.getByRole('heading', { name: 'Hello, Ama' })).toBeVisible();
});
