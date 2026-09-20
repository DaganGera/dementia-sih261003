import { Jimp } from 'jimp';

async function extractCleanPNGs() {
  const baseImg = await Jimp.read('public/images/siroi-bg.jpg');
  const W = baseImg.width; // 1024
  const H = baseImg.height; // 572
  const data = baseImg.bitmap.data;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [247, 244, 239, 255];
    const idx = (y * W + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }

  async function cropAndAlpha(cropX, cropY, cropW, cropH, isDiscardPixel) {
    const out = new Jimp({ width: cropW, height: cropH, color: 0x00000000 });
    const outData = out.bitmap.data;

    for (let cy = 0; cy < cropH; cy++) {
      for (let cx = 0; cx < cropW; cx++) {
        const globalX = cropX + cx;
        const globalY = cropY + cy;
        const [r, g, b, a] = getPixel(globalX, globalY);

        const outIdx = (cy * cropW + cx) * 4;

        // Custom discard condition (e.g. card text or UI borders)
        if (isDiscardPixel && isDiscardPixel(cx, cy, globalX, globalY, r, g, b)) {
          outData[outIdx] = 0;
          outData[outIdx + 1] = 0;
          outData[outIdx + 2] = 0;
          outData[outIdx + 3] = 0;
          continue;
        }

        // Distance to neutral cream background [247, 244, 239]
        const dr = Math.abs(r - 247);
        const dg = Math.abs(g - 244);
        const db = Math.abs(b - 240);
        const diff = Math.max(dr, dg, db);
        const colorSpread = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);

        // Discard pure background and subtle compression noise
        if (diff <= 12 && colorSpread <= 18) {
          outData[outIdx] = 0;
          outData[outIdx + 1] = 0;
          outData[outIdx + 2] = 0;
          outData[outIdx + 3] = 0;
        } else if (diff <= 22 && colorSpread <= 26) {
          // Smooth antialiased ramp for fine outer watercolor gradients
          const alphaFactor = Math.max((diff - 12) / 10, (colorSpread - 18) / 8);
          outData[outIdx] = r;
          outData[outIdx + 1] = g;
          outData[outIdx + 2] = b;
          outData[outIdx + 3] = Math.min(255, Math.max(0, Math.round(255 * alphaFactor)));
        } else {
          // Sharp strokes, rich petals, stamens
          outData[outIdx] = r;
          outData[outIdx + 1] = g;
          outData[outIdx + 2] = b;
          outData[outIdx + 3] = 255;
        }
      }
    }
    return out;
  }

  // 1. Logo Flower (Centered above "Siroi")
  console.log('Extracting logo flower...');
  const logo = await cropAndAlpha(484, 56, 58, 54, (cx, cy) => {
    // Keep within circular ellipse of flower
    const dx = cx - 29;
    const dy = cy - 27;
    return (dx * dx) / (29 * 29) + (dy * dy) / (27 * 27) > 1.05;
  });
  await logo.write('public/images/flower_logo.png');
  console.log('Saved clean public/images/flower_logo.png');

  // 2. Top Right Flower
  // Crop from x=830, y=35, w=194, h=380.
  // Navbar is at cy < 2. Card is at cx < 110 && cy > 210.
  console.log('Extracting top-right flower...');
  const topRight = await cropAndAlpha(830, 35, 194, 380, (cx, cy) => {
    if (cy < 4) return true; // navbar
    if (cx < 115 && cy > 210) return true; // why siroi card
    return false;
  });
  await topRight.write('public/images/flower_top_right.png');
  console.log('Saved clean public/images/flower_top_right.png');

  // 3. Bottom Left Flower
  console.log('Extracting bottom-left flower...');
  const bottomLeft = await cropAndAlpha(0, 350, 175, 222, () => false);
  await bottomLeft.write('public/images/flower_bottom_left.png');
  console.log('Saved clean public/images/flower_bottom_left.png');

  // 4. Bottom Right Flower
  // Card corner was at cx < 80 && cy < 45
  console.log('Extracting bottom-right flower...');
  const bottomRight = await cropAndAlpha(855, 375, 169, 197, (cx, cy) => {
    if (cx < 80 && cy < 45) return true; // card corner
    return false;
  });
  await bottomRight.write('public/images/flower_bottom_right.png');
  console.log('Saved clean public/images/flower_bottom_right.png');

  console.log('All 4 clean flower PNGs updated successfully!');
}

extractCleanPNGs().catch(console.error);
