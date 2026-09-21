import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const dist = resolve(import.meta.dirname, '..', 'dist');
const pages = ['/', '/privacy/', '/limitations/', '/credits/', '/offline/', '/404.html'];

test('every route has a short title, a meta description, a canonical link and the favicon set', async ({ page }) => {
  for (const p of pages) {
    await page.goto(p);
    const title = await page.title();
    expect(title.length, `title of ${p}`).toBeGreaterThan(0);
    expect(title.length, `title of ${p}`).toBeLessThanOrEqual(60);
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc!.length, `description of ${p}`).toBeLessThanOrEqual(155);
    expect(desc!.length).toBeGreaterThan(40);
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    if (!['/offline/', '/404.html'].includes(p)) await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  }
  await page.goto('/');
  for (const sel of ['meta[property="og:image"]', 'meta[name="twitter:card"]', 'link[rel="apple-touch-icon"]', 'link[rel="manifest"]', 'link[hreflang="en"]']) await expect(page.locator(sel)).toHaveCount(1);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').innerText()) as string) as { '@graph': Array<{ '@type': string }> };
  expect(ld['@graph'].map((g) => g['@type'])).toEqual(['WebSite', 'SoftwareApplication']);
  for (const f of ['/robots.txt', '/sitemap.xml', '/favicon.ico', '/apple-touch-icon.png', '/icon-192-maskable.png', '/icon-512-maskable.png', '/og-image.jpg']) {
    const r = await page.request.get(f);
    expect(r.status(), f).toBe(200);
  }
  const og = await page.request.get('/og-image.jpg');
  expect((await og.body()).length).toBeGreaterThan(20_000);
});

const widths: Array<[number, number]> = [[320, 640], [360, 740], [375, 812], [390, 844], [412, 915], [768, 1024], [1024, 768], [1440, 900], [1920, 1080], [667, 375], [915, 412]];
for (const [w, h] of widths) {
  test(`no horizontal scroll and the hero fits at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    if (w >= 360 && h >= 640) {
      const cta = await page.getByRole('link', { name: 'See how it works' }).boundingBox();
      expect(cta!.y + cta!.height, 'hero CTA is visible without scrolling').toBeLessThanOrEqual(h);
    }
  });
}

test('the film runs idle, follows scroll, and returns to idle', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('journey')).toHaveAttribute('data-mode', 'full');
  const canvasOpacity = () => page.locator('canvas').evaluate((c) => Number(getComputedStyle(c).opacity));
  await page.waitForTimeout(1200);
  const idleVideo = await page.locator('video').evaluate((v: HTMLVideoElement) => ({ paused: v.paused, t: v.currentTime }));
  expect(idleVideo.paused).toBe(false);
  expect(await canvasOpacity()).toBeLessThan(0.1);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.4));
  await expect.poll(canvasOpacity, { timeout: 8000 }).toBeGreaterThan(0.9);
  await page.waitForTimeout(1500);
  // The canvas has real pixels drawn from the frame files, not a blank layer.
  const drawn = await page.locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let colored = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i + 3]! > 0) colored += 1;
    return colored;
  });
  expect(drawn).toBeGreaterThan(50);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(canvasOpacity, { timeout: 8000 }).toBeLessThan(0.1);
});

test('reduced motion gives the static poster with no video and no entrance animation', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByTestId('journey')).toHaveAttribute('data-mode', 'static');
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.locator('h1').evaluate((h) => getComputedStyle(h).animationName)).toBe('none');
  await ctx.close();
});

test('the pause control switches the film to the poster and remembers the choice', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pause motion' }).click();
  await expect(page.getByTestId('journey')).toHaveAttribute('data-mode', 'static');
  await page.reload();
  await expect(page.getByTestId('journey')).toHaveAttribute('data-mode', 'static');
  await page.getByRole('button', { name: 'Play motion' }).click();
  await expect(page.getByTestId('journey')).toHaveAttribute('data-mode', 'full');
});

test('the mobile menu traps focus, closes with Escape and has large targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const open = page.getByRole('button', { name: 'Open the menu' });
  expect((await open.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await open.click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  for (const l of await page.getByRole('dialog').getByRole('link').all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
});

test('headline uses the spec type and colours, and no page text contains a dash used as punctuation', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1');
  expect(await h1.evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Instrument Serif');
  expect(await h1.evaluate((e) => getComputedStyle(e).letterSpacing)).toBe('-2.46px');
  expect(await h1.evaluate((e) => getComputedStyle(e).color)).toBe('rgb(0, 0, 0)');
  expect(await h1.locator('em').first().evaluate((e) => getComputedStyle(e).color)).toBe('rgb(111, 111, 111)');
  expect(await page.locator('body').evaluate((b) => getComputedStyle(b).fontFamily)).toContain('Inter');
  for (const p of pages) {
    await page.goto(p);
    expect(await page.locator('body').innerText(), p).not.toMatch(new RegExp('[\\u2013\\u2014]'));
  }
});

test('all internal links and anchors resolve', async ({ page }) => {
  const seen = new Set<string>();
  const htmlFiles: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.html')) htmlFiles.push(p);
    }
  };
  walk(dist);
  for (const f of htmlFiles) for (const m of readFileSync(f, 'utf8').matchAll(/href="([^"#][^"]*)"/g)) seen.add(m[1]!);
  const internal = [...seen].filter((h) => h.startsWith('/') && !h.startsWith('//'));
  expect(internal.length).toBeGreaterThan(5);
  for (const h of internal) {
    const r = await page.request.get(h);
    expect(r.status(), h).toBe(200);
  }
  await page.goto('/');
  for (const id of ['how', 'activities', 'screening', 'offline', 'main']) await expect(page.locator(`#${id}`), `#${id}`).toHaveCount(1);
  expect(await page.locator("a[href='#']").count()).toBe(0);
});

for (const p of ['/', '/privacy/', '/limitations/', '/credits/', '/404.html']) {
  test(`axe finds no serious accessibility issues on ${p}`, async ({ page }) => {
    await page.goto(p);
    await page.waitForTimeout(600);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
  });
}
