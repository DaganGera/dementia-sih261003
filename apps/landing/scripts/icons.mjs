// Renders the favicon set and the social image with Chromium. Run: node scripts/icons.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const pub = resolve(root, 'public');
const svg = readFileSync(resolve(pub, 'favicon.svg'), 'utf8');
const browser = await chromium.launch();

async function icon(file, size, { maskable = false } = {}) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#1B5E45;display:flex;align-items:center;justify-content:center"><div style="width:${size * 0.6}px;height:${size * 0.6}px">${svg.replace('<rect width="64" height="64" rx="14" fill="#1B5E45"/>', '')}</div></div>`
    : `<div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`;
  await page.setContent(`<body style="margin:0;background:transparent">${inner}</body>`);
  await page.screenshot({ path: resolve(pub, file), omitBackground: !maskable });
  await page.close();
}

await icon('icon-32.png', 32);
await icon('apple-touch-icon.png', 180, { maskable: true });
await icon('icon-192.png', 192);
await icon('icon-512.png', 512);
await icon('icon-192-maskable.png', 192, { maskable: true });
await icon('icon-512-maskable.png', 512, { maskable: true });

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.goto(pathToFileURL(resolve(root, 'scripts', 'og.html')).href);
await og.evaluate(() => document.fonts.ready);
await og.waitForTimeout(400);
await og.screenshot({ path: resolve(pub, 'og-image.jpg'), type: 'jpeg', quality: 86 });
await browser.close();
console.log('wrote icons and og-image.jpg');
