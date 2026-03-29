// 生成 PWA 图标的脚本
// 运行: node generate-icons.js

import { createCanvas } from 'canvas';
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

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 背景渐变
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6366f1');  // indigo-500
  gradient.addColorStop(1, '#8b5cf6');  // violet-500

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // 绘制圆角矩形背景
  const padding = size * 0.1;
  const cornerRadius = size * 0.2;

  ctx.beginPath();
  ctx.roundRect(padding, padding, size - padding * 2, size - padding * 2, cornerRadius);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fill();

  // 绘制大脑图标 (简化版)
  const centerX = size / 2;
  const centerY = size / 2;
  const brainSize = size * 0.5;

  ctx.font = `${brainSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText('🧠', centerX, centerY + size * 0.05);

  return canvas;
}

function generateMaskableIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 背景渐变
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6366f1');
  gradient.addColorStop(1, '#8b5cf6');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // 绘制大脑图标，留出安全边距
  const centerX = size / 2;
  const centerY = size / 2;
  const brainSize = size * 0.4;  // 稍小以适应 maskable

  ctx.font = `${brainSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText('🧠', centerX, centerY + size * 0.05);

  return canvas;
}

async function main() {
  console.log('🎨 生成 PWA 图标...\n');

  for (const size of sizes) {
    // 生成普通图标
    const icon = generateIcon(size);
    const buffer = icon.toBuffer('image/png');
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ 生成: icon-${size}x${size}.png`);

    // 如果是 512，也生成 maskable 版本
    if (size === 512) {
      const maskableIcon = generateMaskableIcon(size);
      const maskableBuffer = maskableIcon.toBuffer('image/png');
      const maskablePath = path.join(outputDir, `icon-maskable-${size}x${size}.png`);
      fs.writeFileSync(maskablePath, maskableBuffer);
      console.log(`✅ 生成: icon-maskable-${size}x${size}.png`);
    }
  }

  // 生成 favicon.ico (使用 192x192 版本)
  const favicon = generateIcon(192);
  const faviconBuffer = favicon.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'favicon.png'), faviconBuffer);
  console.log(`✅ 生成: favicon.png`);

  // 生成 apple-touch-icon
  const appleIcon = generateIcon(180);
  const appleBuffer = appleIcon.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.png'), appleBuffer);
  console.log(`✅ 生成: apple-touch-icon.png`);

  console.log('\n🎉 所有图标生成完成!');
}

main().catch(console.error);
