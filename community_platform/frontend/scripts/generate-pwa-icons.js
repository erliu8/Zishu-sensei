#!/usr/bin/env node

/**
 * PWA 图标生成脚本
 * 从一个源图标生成所有需要的尺寸
 * 
 * 使用方法：
 * 1. 准备一个 512x512 的源图标（public/icon-source.png）
 * 2. 运行：node scripts/generate-pwa-icons.js
 * 
 * 注意：需要安装 sharp 库
 * npm install --save-dev sharp
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了 sharp
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('❌ Error: sharp is not installed');
  console.log('📦 Please install it with: npm install --save-dev sharp');
  process.exit(1);
}

// 配置
const SOURCE_ICON = path.join(__dirname, '../public/icon-source.png');
const ICONS_DIR = path.join(__dirname, '../public/icons');

// 需要生成的图标尺寸
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// 快捷方式图标尺寸
const SHORTCUT_ICONS = [
  { name: 'shortcut-post', size: 96 },
  { name: 'shortcut-market', size: 96 },
  { name: 'shortcut-character', size: 96 },
];

// Badge 图标
const BADGE_SIZE = 72;

// Apple Touch 图标
const APPLE_TOUCH_ICON_SIZES = [120, 152, 167, 180];

// 创建图标目录
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// 检查源图标
if (!fs.existsSync(SOURCE_ICON)) {
  console.error('❌ Error: Source icon not found at', SOURCE_ICON);
  console.log('📝 Please create a 512x512 PNG icon at public/icon-source.png');
  process.exit(1);
}

/**
 * 生成图标
 */
async function generateIcons() {
  console.log('🎨 Starting PWA icon generation...\n');

  try {
    // 生成主图标
    console.log('📱 Generating main icons...');
    for (const size of ICON_SIZES) {
      const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
      
      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png({ quality: 100 })
        .toFile(outputPath);
      
      console.log(`  ✓ Generated ${size}x${size} icon`);
    }

    // 生成 Badge 图标
    console.log('\n🏷️  Generating badge icon...');
    const badgePath = path.join(ICONS_DIR, `badge-${BADGE_SIZE}x${BADGE_SIZE}.png`);
    
    await sharp(SOURCE_ICON)
      .resize(BADGE_SIZE, BADGE_SIZE, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png({ quality: 100 })
      .toFile(badgePath);
    
    console.log(`  ✓ Generated ${BADGE_SIZE}x${BADGE_SIZE} badge`);

    // 生成快捷方式图标（使用不同颜色或样式）
    console.log('\n🔗 Generating shortcut icons...');
    for (const { name, size } of SHORTCUT_ICONS) {
      const outputPath = path.join(ICONS_DIR, `${name}.png`);
      
      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png({ quality: 100 })
        .toFile(outputPath);
      
      console.log(`  ✓ Generated ${name} (${size}x${size})`);
    }

    // 生成 Apple Touch 图标
    console.log('\n🍎 Generating Apple Touch icons...');
    for (const size of APPLE_TOUCH_ICON_SIZES) {
      const outputPath = path.join(ICONS_DIR, `apple-touch-icon-${size}x${size}.png`);
      
      // Apple Touch 图标需要圆角和不透明背景
      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png({ quality: 100 })
        .toFile(outputPath);
      
      console.log(`  ✓ Generated ${size}x${size} Apple Touch icon`);
    }

    // 生成 favicon
    console.log('\n🔖 Generating favicons...');
    const faviconSizes = [16, 32, 48];
    
    for (const size of faviconSizes) {
      const outputPath = path.join(__dirname, '../public', `favicon-${size}x${size}.png`);
      
      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png({ quality: 100 })
        .toFile(outputPath);
      
      console.log(`  ✓ Generated ${size}x${size} favicon`);
    }

    // 生成 maskable 图标（带安全区域）
    console.log('\n😷 Generating maskable icons...');
    const maskableSizes = [192, 512];
    
    for (const size of maskableSizes) {
      const outputPath = path.join(ICONS_DIR, `maskable-icon-${size}x${size}.png`);
      
      // Maskable 图标需要添加安全区域（80% 中心区域）
      const padding = Math.floor(size * 0.1); // 10% padding on each side
      
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 }, // 可以改为品牌颜色
        },
      })
        .composite([
          {
            input: await sharp(SOURCE_ICON)
              .resize(size - padding * 2, size - padding * 2, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              })
              .toBuffer(),
            top: padding,
            left: padding,
          },
        ])
        .png({ quality: 100 })
        .toFile(outputPath);
      
      console.log(`  ✓ Generated ${size}x${size} maskable icon`);
    }

    console.log('\n✅ All PWA icons generated successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Review generated icons in public/icons/');
    console.log('  2. Update manifest.json if needed');
    console.log('  3. Update HTML meta tags for Apple icons');
    
  } catch (error) {
    console.error('\n❌ Error generating icons:', error);
    process.exit(1);
  }
}

// 运行生成
generateIcons();

