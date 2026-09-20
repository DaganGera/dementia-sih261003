import { Jimp } from 'jimp';

async function testScan() {
  const img = await Jimp.read('public/images/siroi-bg.jpg');
  console.log('Bitmap length:', img.bitmap.data.length);
  // Read pixel at 100, 100
  const idx = (100 * 1024 + 100) * 4;
  console.log('Pixel at 100,100:', img.bitmap.data[idx], img.bitmap.data[idx+1], img.bitmap.data[idx+2], img.bitmap.data[idx+3]);
}

testScan();
