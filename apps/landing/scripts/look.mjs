// Takes review screenshots of the built landing page. Run: node scripts/look.mjs
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const out = resolve(import.meta.dirname, '..', '..', '..', 'assets-src', 'look');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

for (const [name, vp, dpr] of [['desktop', { width: 1440, height: 900 }, 1], ['phone', { width: 390, height: 844 }, 2]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4174/');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: resolve(out, `${name}-top.png`) });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (const [label, frac] of [['20', 0.2], ['45', 0.45], ['70', 0.7], ['95', 0.95]]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round((h - vp.height) * frac));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: resolve(out, `${name}-${label}.png`) });
  }
  console.log(name, 'page height', h);
  await ctx.close();
}
await browser.close();
