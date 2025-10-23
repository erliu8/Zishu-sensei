#!/usr/bin/env node

/**
 * PWA 启动画面生成脚本
 * 为不同的 iOS 设备生成启动画面
 * 
 * 使用方法：
 * 1. 准备源图标和应用名称
 * 2. 运行：node scripts/generate-splash-screens.js
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
const SPLASH_DIR = path.join(__dirname, '../public/splash');
const APP_NAME = 'Zishu';
const BACKGROUND_COLOR = '#ffffff';
const ICON_RATIO = 0.3; // 图标占屏幕的比例

// iOS 设备启动画面尺寸
const SPLASH_SCREENS = [
  // iPhone
  {
    name: 'iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max',
    width: 1290,
    height: 2796,
    orientation: 'portrait',
  },
  {
    name: 'iPhone_15_Pro__iPhone_15__iPhone_14_Pro',
    width: 1179,
    height: 2556,
    orientation: 'portrait',
  },
  {
    name: 'iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max',
    width: 1284,
    height: 2778,
    orientation: 'portrait',
  },
  {
    name: 'iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12',
    width: 1170,
    height: 2532,
    orientation: 'portrait',
  },
  {
    name: 'iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X',
    width: 1125,
    height: 2436,
    orientation: 'portrait',
  },
  {
    name: 'iPhone_11_Pro_Max__iPhone_XS_Max',
    width: 1242,
    height: 2688,
    orientation: 'portrait',
  },
  {
    name: 'iPhone_11__iPhone_XR',
    width: 828,
    height: 1792,
    orientation: 'portrait',
  },
  {
    name: 'iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus',
    width: 1242,
    height: 2208,
    orientation: 'portrait',
  },
  {
    name: 'iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE',
    width: 750,
    height: 1334,
    orientation: 'portrait',
  },
  
  // iPad
  {
    name: '12.9__iPad_Pro',
    width: 2048,
    height: 2732,
    orientation: 'portrait',
  },
  {
    name: '11__iPad_Pro__10.5__iPad_Pro',
    width: 1668,
    height: 2388,
    orientation: 'portrait',
  },
  {
    name: '10.9__iPad_Air',
    width: 1640,
    height: 2360,
    orientation: 'portrait',
  },
  {
    name: '10.5__iPad_Air',
    width: 1668,
    height: 2224,
    orientation: 'portrait',
  },
  {
    name: '10.2__iPad',
    width: 1620,
    height: 2160,
    orientation: 'portrait',
  },
  {
    name: '9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad',
    width: 1536,
    height: 2048,
    orientation: 'portrait',
  },
];

// 创建启动画面目录
if (!fs.existsSync(SPLASH_DIR)) {
  fs.mkdirSync(SPLASH_DIR, { recursive: true });
}

// 检查源图标
if (!fs.existsSync(SOURCE_ICON)) {
  console.error('❌ Error: Source icon not found at', SOURCE_ICON);
  console.log('📝 Please create a 512x512 PNG icon at public/icon-source.png');
  process.exit(1);
}

/**
 * 生成启动画面
 */
async function generateSplashScreen(config) {
  const { name, width, height, orientation } = config;
  const outputPath = path.join(SPLASH_DIR, `${name}_${orientation}.png`);

  try {
    // 计算图标尺寸
    const iconSize = Math.min(width, height) * ICON_RATIO;

    // 读取源图标并调整大小
    const iconBuffer = await sharp(SOURCE_ICON)
      .resize(Math.round(iconSize), Math.round(iconSize), {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    // 创建背景
    const background = sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: parseColor(BACKGROUND_COLOR),
      },
    });

    // 计算图标位置（居中）
    const left = Math.round((width - iconSize) / 2);
    const top = Math.round((height - iconSize) / 2);

    // 合成图片
    await background
      .composite([
        {
          input: iconBuffer,
          top: top,
          left: left,
        },
      ])
      .png({ quality: 100 })
      .toFile(outputPath);

    console.log(`  ✓ Generated ${name} (${width}x${height})`);
  } catch (error) {
    console.error(`  ✗ Failed to generate ${name}:`, error.message);
  }
}

/**
 * 解析颜色
 */
function parseColor(color) {
  // 简单的 hex 颜色解析
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b, alpha: 1 };
  }
  // 默认白色
  return { r: 255, g: 255, b: 255, alpha: 1 };
}

/**
 * 主函数
 */
async function main() {
  console.log('🎨 Starting PWA splash screen generation...\n');
  console.log(`📱 Generating ${SPLASH_SCREENS.length} splash screens...\n`);

  for (const config of SPLASH_SCREENS) {
    await generateSplashScreen(config);
  }

  console.log('\n✅ All splash screens generated successfully!');
  console.log('\n📝 Next steps:');
  console.log('  1. Review generated splash screens in public/splash/');
  console.log('  2. Update HTML meta tags in PWAHead.tsx if needed');
  console.log('  3. Test on different iOS devices');
}

// 运行生成
main().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});

