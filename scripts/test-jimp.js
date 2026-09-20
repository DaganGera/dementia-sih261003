import { Jimp } from 'jimp';

async function test() {
  try {
    const image = await Jimp.read('public/images/siroi-bg.jpg');
    console.log('Jimp loaded image successfully:', image.width, 'x', image.height);
  } catch (err) {
    console.error('Jimp error:', err);
  }
}

test();
