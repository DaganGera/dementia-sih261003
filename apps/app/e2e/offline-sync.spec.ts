import { expect, test, type Page } from '@playwright/test';

/** AT-11 in a browser: two devices, both offline, pair by pasted code text, play, share, see the result. */

const codeText = async (p: Page) => (await p.getByTestId('qr-text').inputValue()).trim();

async function paste(p: Page, text: string) {
  const box = p.getByTestId('qr-paste');
  if (!(await box.isVisible())) await p.getByText('Paste the code text instead').click();
  await box.fill(text);
  await p.getByRole('button', { name: 'Use this text' }).click();
}

test('two offline devices pair, sync, play and show the result to the family', async ({ browser }) => {
  const a = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  const bCtx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const b = await bCtx.newPage();
  // Device B's clock runs two minutes ahead so the reminder created on A is due when B opens.
  await b.clock.install({ time: new Date(Date.now() + 2 * 60_000) });
  await a.clock.install();

  await a.goto('/');
  await b.goto('/');
  await a.context().setOffline(true);
  await bCtx.setOffline(true);

  // Family phone: role, person, two people, one reminder.
  await a.getByRole('button', { name: 'A family member' }).click();
  await expect(a.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await a.goto('/#/caregiver/family');
  await a.getByLabel('Their name').fill('Ama');
  await a.getByLabel('Your name (shown on their screen)').fill('Anita');
  await a.getByLabel('Years of schooling').fill('4');
  await a.getByRole('button', { name: 'Save' }).click();
  for (const [n, r] of [['Anita', 'daughter'], ['Ravi', 'son']]) {
    await a.getByLabel('Name', { exact: true }).fill(n!);
    await a.getByLabel(/^Relation/).fill(r!);
    await a.getByRole('button', { name: 'Add person' }).click();
  }
  await a.goto('/#/caregiver/reminders');
  const at = new Date(Date.now() + 60_000);
  await a.getByLabel('What is it for').fill('morning tablet');
  await a.getByLabel('Time').fill(`${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`);
  await a.getByRole('button', { name: 'Add reminder' }).click();
  await expect(a.getByText('morning tablet').first()).toBeVisible();

  // Pair: offer, reply, key.
  await a.goto('/#/caregiver/share');
  await a.getByRole('tab', { name: 'Pair a device' }).click();
  await a.getByRole('button', { name: 'Start a family circle' }).click();
  const offer = await codeText(a);

  await b.getByRole('button', { name: 'The person who will play' }).click();
  await expect(b.getByRole('heading', { name: /Hello/ })).toBeVisible();
  await b.goto('/#/patient/family');
  await b.getByRole('tab', { name: 'Pair a device' }).click();
  await paste(b, offer);
  await expect(b.getByTestId('compare-code')).toBeVisible();
  const reply = await codeText(b);

  await a.getByRole('button', { name: 'Next: scan the reply' }).click();
  await paste(a, reply);
  await expect(a.getByTestId('compare-code')).toBeVisible();
  expect(await a.getByTestId('compare-code').innerText()).toBe(await b.getByTestId('compare-code').innerText());
  const key = await codeText(a);

  await b.getByRole('button', { name: 'Next: scan the key' }).click();
  await paste(b, key);
  await expect(b.getByText('This device is now part of the family circle.')).toBeVisible();

  // Send everything from the family phone to the tablet.
  await a.getByRole('tab', { name: 'Send records' }).click();
  await a.getByRole('button', { name: 'Show all records' }).click();
  await expect(a.getByTestId('qr-text')).toHaveCount(1);
  const toTablet = await codeText(a);
  await b.getByRole('tab', { name: 'Receive records' }).click();
  await paste(b, toTablet);
  await expect(b.getByText(/new records added/)).toBeVisible();

  // Tablet: the reminder is due and can be confirmed.
  await b.goto('/#/patient');
  await expect(b.getByText(/It is time for your medicine/).first()).toBeVisible({ timeout: 30_000 });
  await b.getByRole('button', { name: 'Yes, done' }).click();
  await expect(b.getByText('Thank you. This is written down.')).toBeVisible();
  await b.getByRole('button', { name: 'Back to home' }).click();
  await expect(b.getByRole('button', { name: /^Play:/ })).toBeVisible();

  // Tablet: play Pairs at Home. All cards are visible during the preview, so the test reads them then.
  await b.getByRole('button', { name: /^Play:/ }).click();
  for (let board = 0; board < 2; board++) {
    const cards = b.locator('section[aria-label="Pairs board"] button');
    await expect(cards.first()).toBeVisible();
    const labels = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    await expect(b.getByText('Find two that are the same.')).toBeVisible({ timeout: 15_000 });
    const groups = new Map<string, number[]>();
    labels.forEach((l, i) => groups.set(l!, [...(groups.get(l!) ?? []), i]));
    for (const idx of groups.values()) {
      await cards.nth(idx[0]!).click();
      await cards.nth(idx[1]!).click();
      await b.waitForTimeout(150);
    }
    if (board === 0) await expect(b.getByTestId('round-counter')).toContainText('Round 2 of 2', { timeout: 10_000 });
  }
  await expect(b.getByRole('heading', { name: 'That is enough for now' })).toBeVisible({ timeout: 10_000 });
  // Errorless: no red or cross wording anywhere on the screen.
  await expect(b.locator('body')).not.toContainText(/wrong|incorrect|failed|try again/i);

  // Tablet to family phone.
  await b.goto('/#/patient/family');
  await b.getByRole('tab', { name: 'Send records' }).click();
  await b.getByRole('button', { name: 'Show all records' }).click();
  const toPhone = await codeText(b);
  await a.getByRole('tab', { name: 'Receive records' }).click();
  await paste(a, toPhone);
  await expect(a.getByText(/new records added/)).toBeVisible();

  // Let the family phone's clock reach the reminder time, then read the week.
  await a.clock.fastForward('05:00');
  await a.goto('/#/caregiver/home');
  await expect(a.getByText(/1 activity on 1 day\./)).toBeVisible();
  await expect(a.getByText(/1 confirmed of 1 due/)).toBeVisible();
  await expect(a.getByText('Screening range')).toBeVisible();
  await a.getByText('View as a table').first().click();
  await expect(a.getByRole('table').first()).toBeVisible();
  await expect(a.getByText('Simulated model: trained on synthetic data only. Not a diagnosis.')).toBeVisible();
});
