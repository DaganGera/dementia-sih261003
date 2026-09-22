// Captures real screens from the built app for the landing page. Run after `pnpm --filter app build`.
// The app must be served on http://localhost:4173 (`pnpm --filter app preview`).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const out = resolve(import.meta.dirname, '..', '..', '..', 'assets-src', 'shots');
mkdirSync(out, { recursive: true });
const base = process.env.APP_ORIGIN ?? 'http://localhost:4173';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale: 'en-IN' });
const page = await ctx.newPage();
const sizes = {};
// Patient screens are cropped to their content so the captures are not mostly blank.
const shot = async (name, { crop = false } = {}) => {
  await page.waitForTimeout(450);
  let height = 915;
  if (crop) {
    height = await page.evaluate(() => Math.min(915, Math.ceil(document.querySelector('main').lastElementChild.getBoundingClientRect().bottom + 32)));
  }
  await page.screenshot({ path: resolve(out, `${name}.png`), clip: { x: 0, y: 0, width: 412, height } });
  sizes[name] = { width: 824, height: height * 2 };
  console.log('captured', name, height);
};
const click = (name, opts = {}) => page.getByRole('button', { name, ...opts }).click();

await page.goto(base);
await click('A family member');
await page.getByRole('navigation', { name: 'Sections' }).waitFor();

// Family setup.
await page.goto(`${base}/#/caregiver/family`);
await page.getByLabel('Their name').fill('Ama');
await page.getByLabel('Your name (shown on their screen)').fill('Anita');
await page.getByLabel('Years of schooling').fill('4');
await click('Save');
for (const [n, r] of [['Anita', 'daughter'], ['Ravi', 'son'], ['Dev', 'neighbour']]) {
  await page.getByLabel('Name', { exact: true }).fill(n);
  await page.getByLabel(/^Relation/).fill(r);
  await click('Add person');
}
await page.goto(`${base}/#/caregiver/reminders`);
await page.getByLabel('What is it for').fill('morning tablet');
await click('Add reminder');

// Content for the games that need it: two places for Places I Know, one memory for Life Story.
await page.goto(`${base}/#/caregiver/family`);
for (const name of ['The market', 'The river ghat']) {
  await page.getByLabel('Name of the place').fill(name);
  await click('Add place');
}
await page.getByLabel('What should the person be reminded of?').fill('We used to walk to the river every evening after the day cooled down.');
await click('Add to the life story');

// Monthly check: capture the first question screen, then finish the check.
await page.goto(`${base}/#/caregiver/check`);
await click('Start', { exact: true });
await shot('check');
await click('Next');
await page.getByLabel('Dressing').check();
await click('Next');
await click('Start the minute');
for (let i = 0; i < 13; i++) await click('Count one animal');
await click('Finish now');
await click('Next');
for (const w of ['river', 'chair', 'lamp', 'bread', 'mango', 'bell']) await click(w, { exact: true });
for (let i = 0; i < 3; i++) await click('Next');
await click('Save the check');

// Games, captured at a natural moment.
await page.goto(`${base}/#/patient/play/G1`);
await page.getByText('Find two that are the same.').waitFor({ timeout: 15000 });
await shot('game-pairs', { crop: true });
await page.goto(`${base}/#/patient/play/G2`);
await page.getByText('Who is this?').first().waitFor();
await shot('game-faces', { crop: true });
await page.goto(`${base}/#/patient/play/G3`);
await page.getByRole('button', { name: 'I am ready for the questions' }).waitFor();
await shot('game-story', { crop: true });
await page.goto(`${base}/#/patient/play/G4`);
await page.getByText('What comes next?').first().waitFor();
await shot('game-routine', { crop: true });
await page.goto(`${base}/#/patient/play/G5`);
await page.getByText('Which picture matches the sound?').waitFor();
await shot('game-sound', { crop: true });
await page.goto(`${base}/#/patient/play/G6`);
await page.getByText('Which tile comes next?').waitFor();
await shot('game-weave', { crop: true });
await page.goto(`${base}/#/patient/play/G8`);
await page.getByText('Where is this?').waitFor();
await shot('game-places', { crop: true });
await page.goto(`${base}/#/patient/play/G9`);
await page.getByRole('button', { name: /Next memory|That is all for now/ }).waitFor();
await shot('game-memories', { crop: true });
await page.goto(`${base}/#/patient/play/G10`);
await page.getByRole('button', { name: 'Morning tune' }).waitFor();
await shot('game-music', { crop: true });

// One full Find It session so the family view has activity to show.
await page.goto(`${base}/#/patient/play/G7`);
await page.getByText(/^Find the /).first().waitFor();
await shot('game-find', { crop: true });
for (let i = 0; i < 5; i++) {
  const prompt = await page.getByText(/^Find the /).first().innerText();
  const label = prompt.replace(/^Find the /, '').replace(/\.$/, '');
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(1100);
}
await page.getByRole('heading', { name: 'That is enough for now' }).waitFor();

await page.goto(`${base}/#/patient`);
await page.getByRole('button', { name: /^Play:/ }).waitFor();
await shot('patient-home', { crop: true });

await page.goto(`${base}/#/caregiver/home`);
await page.getByText('How activities are going').waitFor();
await shot('dashboard');
await page.getByTestId('stage-card').scrollIntoViewIfNeeded();
await page.evaluate(() => document.querySelector('[data-testid="stage-card"]').scrollIntoView({ block: 'start' }));
await shot('screening');

// Sharing without internet: start a circle, then show the moving code for all records.
await page.goto(`${base}/#/caregiver/share`);
await page.getByRole('tab', { name: 'Pair a device' }).click();
await click('Start a family circle');
await page.getByRole('tab', { name: 'Send records' }).click();
await click('Show all records');
await page.getByTestId('qr-show').waitFor();
await shot('sync');

await browser.close();
writeFileSync(resolve(out, 'shots.json'), JSON.stringify(sizes, null, 1));
