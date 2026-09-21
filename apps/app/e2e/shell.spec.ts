import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('first run asks who uses the device and the patient home follows the elder rules', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Hillpath' })).toBeVisible();
  await page.getByRole('button', { name: 'The person who will play' }).click();
  await expect(page.getByRole('heading', { name: /Hello/ })).toBeVisible();

  const body = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main')!).fontSize));
  expect(body).toBeGreaterThanOrEqual(22);

  const primary = page.getByRole('button', { name: /^Play:/ });
  const box = await primary.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(64);
  await expect(page.getByRole('button', { name: 'I need help' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hear this again' })).toBeVisible();
});

test('no horizontal scroll and no serious accessibility issues on the main screens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'A family member' }).click();
  for (const tab of ['home', 'reminders', 'family', 'check', 'share', 'privacy']) {
    await page.goto(`/#/caregiver/${tab}`);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${tab}`).toBeLessThanOrEqual(0);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html}`), `axe on ${tab}`).toEqual([]);
  }
});
