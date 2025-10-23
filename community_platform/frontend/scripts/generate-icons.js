#!/usr/bin/env node

/**
 * PWA Icon Generator Script
 * 
 * 从源图标生成各种尺寸的 PWA 图标
 * 
 * 使用方法:
 * 1. 准备一个 512x512 的 PNG 源图标 (source-icon.png)
 * 2. 运行: node scripts/generate-icons.js
 * 
 * 需要安装 sharp: npm install --save-dev sharp
 */

const fs = require('fs')
const path = require('path')

// 检查是否安装了 sharp
let sharp
try {
  sharp = require('sharp')
} catch (error) {
  console.error('错误: 未找到 sharp 库')
  console.log('请运行: npm install --save-dev sharp')
  process.exit(1)
}

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const SHORTCUT_SIZES = [96]

const SOURCE_ICON = path.join(__dirname, '../public/source-icon.png')
const OUTPUT_DIR = path.join(__dirname, '../public/icons')

// 创建输出目录
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// 检查源图标是否存在
if (!fs.existsSync(SOURCE_ICON)) {
  console.error(`错误: 未找到源图标文件: ${SOURCE_ICON}`)
  console.log('\n请准备一个 512x512 的 PNG 图标并保存为 public/source-icon.png')
  
  // 创建一个简单的占位图标
  createPlaceholderIcon()
  process.exit(0)
}

async function generateIcons() {
  console.log('开始生成图标...\n')

  // 生成应用图标
  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`)
    
    try {
      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath)
      
      console.log(`✓ 生成: icon-${size}x${size}.png`)
    } catch (error) {
      console.error(`✗ 生成失败 icon-${size}x${size}.png:`, error.message)
    }
  }

  // 生成 badge 图标 (72x72，用于通知)
  const badgePath = path.join(OUTPUT_DIR, 'badge-72x72.png')
  try {
    await sharp(SOURCE_ICON)
      .resize(72, 72, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(badgePath)
    
    console.log('✓ 生成: badge-72x72.png')
  } catch (error) {
    console.error('✗ 生成失败 badge-72x72.png:', error.message)
  }

  // 生成快捷方式图标占位符
  const shortcuts = ['post', 'market', 'character']
  for (const shortcut of shortcuts) {
    const shortcutPath = path.join(OUTPUT_DIR, `shortcut-${shortcut}.png`)
    
    try {
      await sharp(SOURCE_ICON)
        .resize(96, 96, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(shortcutPath)
      
      console.log(`✓ 生成: shortcut-${shortcut}.png`)
    } catch (error) {
      console.error(`✗ 生成失败 shortcut-${shortcut}.png:`, error.message)
    }
  }

  // 生成 favicon
  const faviconPath = path.join(__dirname, '../public/favicon.ico')
  try {
    await sharp(SOURCE_ICON)
      .resize(32, 32)
      .png()
      .toFile(faviconPath.replace('.ico', '.png'))
    
    console.log('✓ 生成: favicon.png')
    console.log('  注意: 请使用在线工具将 favicon.png 转换为 favicon.ico')
  } catch (error) {
    console.error('✗ 生成失败 favicon.png:', error.message)
  }

  console.log('\n图标生成完成！')
}

async function createPlaceholderIcon() {
  console.log('创建占位图标...\n')

  // 创建一个简单的 SVG 图标
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#000000"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="200" 
            fill="#ffffff" text-anchor="middle" dominant-baseline="middle">Z</text>
    </svg>
  `

  const svgBuffer = Buffer.from(svg.trim())

  // 生成所有尺寸的图标
  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`)
    
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath)
      
      console.log(`✓ 生成占位图标: icon-${size}x${size}.png`)
    } catch (error) {
      console.error(`✗ 生成失败:`, error.message)
    }
  }

  // 生成 badge
  const badgePath = path.join(OUTPUT_DIR, 'badge-72x72.png')
  await sharp(svgBuffer).resize(72, 72).png().toFile(badgePath)

  // 生成快捷方式图标
  const shortcuts = ['post', 'market', 'character']
  for (const shortcut of shortcuts) {
    const shortcutPath = path.join(OUTPUT_DIR, `shortcut-${shortcut}.png`)
    await sharp(svgBuffer).resize(96, 96).png().toFile(shortcutPath)
  }

  console.log('\n占位图标创建完成！')
  console.log('提示: 请将自定义的 512x512 PNG 图标保存为 public/source-icon.png，然后重新运行此脚本。')
}

// 运行
generateIcons().catch((error) => {
  console.error('发生错误:', error)
  process.exit(1)
})

