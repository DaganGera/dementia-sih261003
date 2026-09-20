import { Jimp } from 'jimp';

async function fixTopRight() {
  const baseImg = await Jimp.read('public/images/siroi-bg.jpg');
  const W = baseImg.width; // 1024
  const H = baseImg.height; // 572
  const data = baseImg.bitmap.data;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [247, 244, 239, 255];
    const idx = (y * W + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }

  // Crop from x=830, y=35, w=194, h=380.
  const cropX = 830, cropY = 35, cropW = 194, cropH = 380;
  const out = new Jimp({ width: cropW, height: cropH, color: 0x00000000 });
  const outData = out.bitmap.data;

  for (let cy = 0; cy < cropH; cy++) {
    for (let cx = 0; cx < cropW; cx++) {
      const globalX = cropX + cx;
      const globalY = cropY + cy;
      const [r, g, b, a] = getPixel(globalX, globalY);
      const outIdx = (cy * cropW + cx) * 4;

      // 1. Navbar strip at top
      if (cy < 20) continue;

      // 2. "Why Siroi" card top edge
      if (cx < 120 && cy > 180) continue;

      // Color distance to cream background [247, 244, 239]
      const dr = Math.abs(r - 247);
      const dg = Math.abs(g - 244);
      const db = Math.abs(b - 240);
      const diff = Math.max(dr, dg, db);
      const colorSpread = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);

      if (diff <= 12 && colorSpread <= 18) {
        // Transparent
      } else if (diff <= 22 && colorSpread <= 26) {
        const alphaFactor = Math.max((diff - 12) / 10, (colorSpread - 18) / 8);
        outData[outIdx] = r;
        outData[outIdx + 1] = g;
        outData[outIdx + 2] = b;
        outData[outIdx + 3] = Math.min(255, Math.max(0, Math.round(255 * alphaFactor)));
      } else {
        outData[outIdx] = r;
        outData[outIdx + 1] = g;
        outData[outIdx + 2] = b;
        outData[outIdx + 3] = 255;
      }
    }
  }

  await out.write('public/images/flower_top_right.png');
  console.log('Fixed flower_top_right.png successfully!');
}

fixTopRight().catch(console.error);
