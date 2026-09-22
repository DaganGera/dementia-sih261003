import { expect, test, type Page } from '@playwright/test';
import { asFamily, asTablet, codeText, pair, paste } from './helpers';

/** A microphone made of Web Audio, so a recording can be made without a person or a device. */
async function mockMic(page: Page) {
  await page.addInitScript(() => {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    osc.frequency.value = 220;
    osc.connect(dest);
    osc.start();
    navigator.mediaDevices.getUserMedia = async () => new MediaStream(dest.stream.getAudioTracks().map((t) => t.clone()));
  });
}

async function send(from: Page, to: Page) {
  await from.getByRole('tab', { name: 'Send records' }).click();
  await from.getByRole('button', { name: 'Show all records' }).click();
  const text = await codeText(from);
  await to.getByRole('tab', { name: 'Receive records' }).click();
  await paste(to, text);
  await expect(to.getByText(/new records added/)).toBeVisible();
}

test('a far-away family member sends a voice postcard and a shared round; the person hears it and plays it', async ({ browser }) => {
  const familyCtx = await browser.newContext({ permissions: ['microphone'] });
  const family = await familyCtx.newPage();
  await mockMic(family);
  const tablet = await (await browser.newContext()).newPage();

  await asFamily(family, 'Ama');
  await asTablet(tablet);
  await pair(family, tablet);

  // Family: a voice message with a few words, and an invitation to play together.
  await family.goto('/#/caregiver/family');
  await family.getByLabel('A few words (optional)').fill('Thinking of you, see you soon.');
  await family.getByRole('button', { name: 'Record a voice message' }).click();
  await expect(family.getByText(/Recording\. Up to/)).toBeVisible();
  await family.waitForTimeout(1200);
  await family.getByRole('button', { name: 'Stop recording' }).click();
  await expect(family.getByText('Voice message ready.')).toBeVisible();
  await family.getByRole('button', { name: 'Send the postcard' }).click();
  await expect(family.getByText(/It reaches the person/)).toBeVisible();
  await family.getByRole('button', { name: 'Send an invitation' }).click();
  await expect(family.getByTestId('coplay-status')).toContainText('Waiting for the person to play.');

  await family.goto('/#/caregiver/share');
  await send(family, tablet);

  // Tablet: the message and the invitation are on the home screen. Playing the message marks it heard.
  await tablet.goto('/#/patient');
  await expect(tablet.getByTestId('postcard-button')).toContainText('A message from Anita');
  await tablet.getByTestId('postcard-button').click();
  await expect(tablet.getByText('Thinking of you, see you soon.')).toBeVisible();
  await tablet.getByRole('button', { name: 'Hear the message' }).click();
  await expect(tablet.getByRole('button', { name: /Hear it again|Playing/ })).toBeVisible();
  await tablet.getByRole('button', { name: 'Go back' }).click();
  await expect(tablet.getByTestId('postcard-button')).toHaveCount(0);

  // The round uses a shared seed, so the family phone sees the very same first picture set.
  const seedLink = await family.goto('/#/caregiver/family').then(() => family.getByRole('link', { name: 'Play this round too' }).getAttribute('href'));
  await tablet.getByTestId('coplay-button').click();
  const firstPrompt = await tablet.getByTestId('coplay-prompt').innerText();
  const familyView = await (await browser.newContext()).newPage();
  await familyView.goto('/');
  await familyView.getByRole('button', { name: 'A family member' }).click();
  await expect(familyView.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await familyView.goto(seedLink!);
  await expect(familyView.getByTestId('coplay-prompt')).toHaveText(firstPrompt);

  for (let i = 0; i < 3; i++) {
    await expect(tablet.getByTestId('coplay-counter')).toContainText(`Round ${i + 1} of 3`);
    const label = (await tablet.getByTestId('coplay-prompt').innerText()).replace(/^Find the /, '').replace(/\.$/, '');
    await tablet.getByRole('button', { name: label, exact: true }).click();
    await tablet.waitForTimeout(1100);
  }
  await expect(tablet.getByTestId('coplay-result')).toContainText('You found 3 of 3');
  await expect(tablet.locator('body')).not.toContainText(/wrong|incorrect|failed|try again/i);

  // The result comes back to the family phone.
  await tablet.goto('/#/patient/family');
  await family.goto('/#/caregiver/share');
  await send(tablet, family);
  await family.goto('/#/caregiver/family');
  await expect(family.getByTestId('coplay-status').first()).toContainText('Played together: found 3 of 3');
  await expect(family.getByText('Heard.')).toBeVisible();
});
