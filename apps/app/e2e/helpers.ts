import { expect, type Page } from '@playwright/test';

export const codeText = async (p: Page) => (await p.getByTestId('qr-text').inputValue()).trim();

/** Paste code text in place of scanning with a camera. */
export async function paste(p: Page, text: string) {
  const box = p.getByTestId('qr-paste');
  if (!(await box.isVisible())) await p.getByText('Paste the code text instead').click();
  await box.fill(text);
  await p.getByRole('button', { name: 'Use this text' }).click();
}

export async function asFamily(p: Page, name = 'Ama') {
  await p.goto('/');
  await p.getByRole('button', { name: 'A family member' }).click();
  await expect(p.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await p.goto('/#/caregiver/family');
  await p.getByLabel('Their name').fill(name);
  await p.getByLabel('Your name (shown on their screen)').fill('Anita');
  await p.getByRole('button', { name: 'Save' }).click();
  await expect(p.getByText('Saved.')).toBeVisible();
}

export async function asTablet(p: Page) {
  await p.goto('/');
  await p.getByRole('button', { name: 'The person who will play' }).click();
  await expect(p.getByRole('heading', { name: /Hello/ })).toBeVisible();
}

/** Pair a patient tablet with a family phone using pasted codes. Returns nothing; both end up in one circle. */
export async function pair(family: Page, other: Page, otherHome = '/#/patient/family') {
  await family.goto('/#/caregiver/share');
  await family.getByRole('tab', { name: 'Pair a device' }).click();
  await family.getByRole('button', { name: 'Start a family circle' }).click();
  const offer = await codeText(family);
  await other.goto(otherHome);
  await other.getByRole('tab', { name: 'Pair a device' }).click();
  await paste(other, offer);
  await expect(other.getByTestId('compare-code')).toBeVisible();
  const reply = await codeText(other);
  await family.getByRole('button', { name: 'Next: scan the reply' }).click();
  await paste(family, reply);
  await expect(family.getByTestId('compare-code')).toBeVisible();
  expect(await family.getByTestId('compare-code').innerText()).toBe(await other.getByTestId('compare-code').innerText());
  const key = await codeText(family);
  await other.getByRole('button', { name: 'Next: scan the key' }).click();
  await paste(other, key);
  await expect(other.getByText('This device is now part of the family circle.')).toBeVisible();
}
