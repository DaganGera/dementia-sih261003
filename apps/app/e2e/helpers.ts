import { FountainDecoder, PageAssembler } from '@hillpath/core';
import { expect, type Page } from '@playwright/test';

export const codeText = async (p: Page) => (await p.getByTestId('qr-text').inputValue()).trim();

/** What a scanner would rebuild from the frames in a code's text: the packed message itself. */
export function decodeFrames(frames: string): string {
  const pages = new PageAssembler();
  const fountain = new FountainDecoder();
  for (const line of frames.split('\n')) {
    const r = line.startsWith('HF1|') ? fountain.add(line) : pages.add(line);
    if (r.text !== undefined) return r.text;
  }
  throw new Error('The frames did not rebuild a message');
}

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

/** Run the monthly check start to finish on the current page (family or visit mode). */
export async function runCheck(page: Page, opts: { acute?: string; fromTab?: string } = {}) {
  if (opts.fromTab) await page.goto(opts.fromTab);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Dressing').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start the minute' }).click();
  for (let i = 0; i < 11; i++) await page.getByRole('button', { name: 'Count one animal' }).click();
  await page.getByRole('button', { name: 'Finish now' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (const w of ['river', 'chair', 'lamp', 'bread']) await page.getByRole('button', { name: w, exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  if (opts.acute) await page.getByLabel(opts.acute).check();
  await page.getByRole('button', { name: 'Save the check' }).click();
  await expect(page.getByText('The check is saved.')).toBeVisible();
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
