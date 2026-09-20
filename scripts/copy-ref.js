import fs from 'fs';
import path from 'path';

const imgPath = 'C:/Users/KAVIN KALANJIAM/.gemini/antigravity/brain/75304632-5072-4755-800d-a5254974346f/.user_uploaded/media_1789653955312.jpg';
const destDir = path.resolve('public/images');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(imgPath, path.join(destDir, 'siroi-bg.jpg'));
console.log('Successfully copied reference image to public/images/siroi-bg.jpg');

const stats = fs.statSync(imgPath);
console.log('File size:', stats.size);
