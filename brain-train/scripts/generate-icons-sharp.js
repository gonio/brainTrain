// 使用 Sharp 生成 PWA 图标的脚本
// 运行: node generate-icons-sharp.js

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [192, 512];
const outputDir = path.join(__dirname, '../public');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 创建 SVG 图标
function createSVG(size) {
  const padding = size * 0.1;
  const iconSize = size * 0.5;
  const fontSize = size * 0.45;

  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)"/>
  <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}"
        rx="${size * 0.15}" fill="rgba(255,255,255,0.2)"/>
  <text x="${size / 2}" y="${size / 2 + fontSize * 0.1}"
        font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">🧠</text>
</svg>
  `.trim();
}

// 创建 maskable SVG (内容在中心，留有安全边距)
function createMaskableSVG(size) {
  const iconSize = size * 0.4;
  const fontSize = size * 0.35;

  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)"/>
  <text x="${size / 2}" y="${size / 2 + fontSize * 0.1}"
        font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">🧠</text>
</svg>
  `.trim();
}

async function main() {
  console.log('🎨 使用 Sharp 生成 PWA 图标...\n');

  for (const size of sizes) {
    // 生成普通图标
    const svg = createSVG(size);
    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ 生成: icon-${size}x${size}.png`);

    // 如果是 512，也生成 maskable 版本
    if (size === 512) {
      const maskableSvg = createMaskableSVG(size);
      const maskableBuffer = await sharp(Buffer.from(maskableSvg))
        .png()
        .toBuffer();

      const maskablePath = path.join(outputDir, `icon-maskable-${size}x${size}.png`);
      fs.writeFileSync(maskablePath, maskableBuffer);
      console.log(`✅ 生成: icon-maskable-${size}x${size}.png`);
    }
  }

  // 生成 apple-touch-icon (180x180)
  const appleSvg = createSVG(180);
  const appleBuffer = await sharp(Buffer.from(appleSvg))
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.png'), appleBuffer);
  console.log(`✅ 生成: apple-touch-icon.png`);

  console.log('\n🎉 所有图标生成完成!');
}

main().catch(console.error);
