import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: hero-manifest.mjs <hero dir>');

function frames(sub) {
  const files = readdirSync(join(dir, sub)).filter((f) => f.endsWith('.webp')).sort();
  const sizes = files.map((f) => statSync(join(dir, sub, f)).size);
  return { count: files.length, bytes: sizes.reduce((a, b) => a + b, 0), first: files[0], pad: 4 };
}
const size = (f) => statSync(join(dir, f)).size;

const manifest = {
  generated: new Date().toISOString(),
  fps: { desktop: 12, mobile: 12 },
  desktop: { ...frames('d'), width: 1440 },
  mobile: { ...frames('m'), width: 600, height: 800 },
  files: {
    posterDesktop: { path: 'poster-1600.webp', bytes: size('poster-1600.webp') },
    posterMobile: { path: 'poster-600x800.webp', bytes: size('poster-600x800.webp') },
    idleDesktop: { path: 'idle-1280.mp4', bytes: size('idle-1280.mp4') },
    idleMobile: { path: 'idle-600x800.mp4', bytes: size('idle-600x800.mp4') },
  },
};
manifest.criticalPathMobileBytes = manifest.files.posterMobile.bytes + manifest.files.idleMobile.bytes;
writeFileSync(join(dir, 'hero.json'), JSON.stringify(manifest, null, 1));
console.log(JSON.stringify(manifest, null, 1));
