import { expect, test, type Page } from '@playwright/test';
import { concat, renderWord, silence, WORDS } from '@hillpath/audio';

async function caregiver(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'A family member' }).click();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await page.goto('/#/caregiver/family');
  await page.getByLabel('Their name').fill('Ama');
  await page.getByRole('button', { name: 'Save' }).click();
}

async function addPeople(page: Page) {
  for (const [n, r] of [['Anita', 'daughter'], ['Ravi', 'son'], ['Dev', 'neighbour']]) {
    await page.getByLabel('Name', { exact: true }).fill(n!);
    await page.getByLabel(/^Relation/).fill(r!);
    await page.getByRole('button', { name: 'Add person' }).click();
  }
}

/** A microphone made of Web Audio, so the tests can "speak" without a person or a device. */
async function mockMic(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __say: (s: number[]) => void };
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    navigator.mediaDevices.getUserMedia = async () => new MediaStream(dest.stream.getAudioTracks().map((t) => t.clone()));
    w.__say = (samples: number[]) => {
      void ctx.resume();
      const buf = ctx.createBuffer(1, samples.length, 16000);
      buf.copyToChannel(Float32Array.from(samples), 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(dest);
      src.start();
    };
  });
}

const say = (page: Page, word: keyof typeof WORDS, seed: number, tempo = 1) => {
  const x = concat(silence(250, 0.002, seed), renderWord(WORDS[word]!, { pitch: 1 + 0.004 * (seed % 5), tempo, noise: 0.003, seed }, 100, 300));
  return page.evaluate((s) => (window as unknown as { __say: (s: number[]) => void }).__say(s), Array.from(x));
};

test('Sound Match, Pattern Weave and Find It with the sixth ability area', async ({ page }) => {
  await caregiver(page);
  await page.goto('/#/patient/play/G5');
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId('round-counter')).toContainText(`Round ${i} of 5`);
    await page.locator('section ul.grid button').first().click();
    await page.waitForTimeout(i === 1 ? 3400 : 3400);
  }
  await expect(page.getByRole('heading', { name: 'That is enough for now' })).toBeVisible({ timeout: 15_000 });

  await page.goto('/#/patient/play/G6');
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId('round-counter')).toContainText(`Round ${i} of 5`);
    await page.locator('section ul.flex-wrap button').first().click();
    await page.waitForTimeout(3000);
  }
  await expect(page.getByRole('heading', { name: 'That is enough for now' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText(/wrong|incorrect|failed/i);

  await page.goto('/#/caregiver/home');
  await page.getByText('View as a table').first().click();
  await expect(page.getByText('Recognising pictures, sounds and places')).toBeVisible();
});

test('Places I Know needs two places, then runs five rounds', async ({ page }) => {
  await caregiver(page);
  for (const n of ['The market', 'The river bank', 'Neighbour house']) {
    await page.getByLabel('Name of the place').fill(n);
    await page.getByRole('button', { name: 'Add place' }).click();
  }
  await page.goto('/#/patient/play/G8');
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId('round-counter')).toContainText(`Round ${i} of 5`);
    await page.locator('section ul.flex-col button').first().click();
    await expect(page.getByText(/^This is /).first()).toBeVisible();
    await page.waitForTimeout(2400);
  }
  await expect(page.getByRole('heading', { name: 'That is enough for now' })).toBeVisible();
});

test('Life Story shows only what the family approved, and never a private fact', async ({ page }) => {
  await caregiver(page);
  const add = async (text: string, doNotAsk = false) => {
    await page.getByLabel('What should the person be reminded of?').fill(text);
    if (doNotAsk) await page.getByLabel(/Do not ask about this/).check();
    await page.getByRole('button', { name: 'Add to the life story' }).click();
  };
  await add('Anita brought a basket of oranges to the house.');
  await add('The family lost a farm in 1994.', true);
  await page.goto('/#/patient/play/G9');
  await expect(page.getByText('Anita brought a basket of oranges to the house.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('lost a farm');
  await page.getByRole('button', { name: 'That is all for now' }).click();
  await expect(page.getByText('It was lovely to remember together.')).toBeVisible();
  await page.goto('/#/caregiver/home');
  await expect(page.getByText(/Memories and music: 1 session/)).toBeVisible();
});

test('Song Circle plays a built-in tune and a family recording', async ({ page }) => {
  await caregiver(page);
  const wav = Buffer.from(
    Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20, 16, 0, 0, 0, 1, 0, 1, 0, 0x80, 0x3e, 0, 0, 0, 0x7d, 0, 0, 2, 0, 16, 0, 0x64, 0x61, 0x74, 0x61, 0, 0, 0, 0]),
  );
  await page.getByLabel('Title', { exact: true }).fill('Evening hymn');
  await page.getByLabel('Audio file').setInputFiles({ name: 'hymn.wav', mimeType: 'audio/wav', buffer: wav });
  await page.getByLabel('Words (optional)').fill('Peace be with you');
  await page.getByRole('button', { name: 'Add song' }).click();
  await expect(page.getByText(/The song stays on this device/)).toBeVisible();
  await page.goto('/#/patient/play/G10');
  await page.getByRole('button', { name: 'Morning tune' }).click();
  await expect(page.getByRole('button', { name: 'Stop the music' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop the music' }).click();
  await page.getByRole('button', { name: 'Evening hymn' }).click();
  await expect(page.getByLabel('Words')).toContainText('Peace be with you');
  await page.getByRole('button', { name: 'That is enough' }).click();
  await expect(page.getByText('I hope you enjoyed the music.')).toBeVisible();
});

test('voice answers: enrol names by voice, answer a round by voice, and capture speech timing', async ({ page }) => {
  await mockMic(page);
  await caregiver(page);
  await addPeople(page);
  const enrolWord = async (label: string, word: keyof typeof WORDS, base: number) => {
    const row = page.locator('li', { hasText: `${label} (no voice yet)` });
    await row.getByRole('button', { name: 'Record' }).click();
    for (let i = 0; i < 3; i++) {
      const btn = page.getByTestId('kws-record');
      await btn.click();
      await page.waitForTimeout(150);
      await say(page, word, base + i, 1 + 0.03 * i);
      await expect(page.getByTestId('kws-record').or(page.getByText(/Saved the voice for/))).toBeVisible({ timeout: 12_000 });
      await page.waitForTimeout(400);
    }
    await expect(page.getByText(`Saved the voice for ${label}.`)).toBeVisible({ timeout: 12_000 });
  };
  await enrolWord('Anita', 'anita', 10);
  await enrolWord('Ravi', 'ravi', 20);
  await enrolWord('Dev', 'dev', 30);

  await page.goto('/#/patient/play/G2');
  await expect(page.getByTestId('voice-answer')).toBeVisible();
  const person = await page.locator('img[alt^="Photo of"], div[role="img"][aria-label^="Picture of"]').first().getAttribute('aria-label');
  const name = person!.replace('Picture of ', '');
  await page.getByRole('button', { name: 'Say the name' }).click();
  await page.waitForTimeout(150);
  await say(page, name.toLowerCase() as keyof typeof WORDS, 77, 1.05);
  await expect(page.getByText(/I heard:/)).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText(new RegExp(`I heard: ${name}`))).toBeVisible();
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(page.getByText(/^This is /).first()).toBeVisible();

  // Speech timing: only numbers are kept.
  await page.getByLabel('What should the person be reminded of?').count();
  await page.goto('/#/caregiver/family');
  await page.getByLabel('What should the person be reminded of?').fill('Ravi taught the children to fly a kite.');
  await page.getByRole('button', { name: 'Add to the life story' }).click();
  await page.goto('/#/patient/play/G9');
  await page.getByRole('button', { name: 'Tell me more' }).click();
  await page.waitForTimeout(200);
  await say(page, 'market', 91, 1.0);
  await expect(page.getByText('Thank you for telling me.')).toBeVisible({ timeout: 20_000 });
});
