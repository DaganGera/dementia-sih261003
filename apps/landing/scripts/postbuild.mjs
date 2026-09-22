import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origin = (process.env.SITE_ORIGIN ?? 'https://mindcare-ai-three.vercel.app').replace(/\/$/, '');
const dist = resolve(import.meta.dirname, '..', 'dist');
const routes = ['/', '/privacy/', '/limitations/', '/credits/'];

writeFileSync(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
writeFileSync(
  resolve(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((r) => `  <url><loc>${origin}${r}</loc></url>`).join('\n')}\n</urlset>\n`,
);
console.log(`wrote robots.txt and sitemap.xml for ${origin}`);
