#!/usr/bin/env node

/**
 * Lighthouse CI 脚本
 * 自动化运行 Lighthouse 并检查性能分数
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * 颜色输出
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`
}

/**
 * 性能分数阈值
 */
const SCORE_THRESHOLDS = {
  performance: 90,
  accessibility: 90,
  bestPractices: 90,
  seo: 90,
}

/**
 * 运行 Lighthouse
 */
async function runLighthouse(url) {
  console.log(colorize(`\n🚀 运行 Lighthouse 分析: ${url}\n`, 'cyan'))

  return new Promise((resolve, reject) => {
    const lighthouse = spawn('npx', [
      'lighthouse',
      url,
      '--output=json',
      '--output=html',
      '--output-path=./lighthouse-report',
      '--chrome-flags="--headless --no-sandbox"',
      '--only-categories=performance,accessibility,best-practices,seo',
    ])

    lighthouse.stdout.on('data', (data) => {
      console.log(data.toString())
    })

    lighthouse.stderr.on('data', (data) => {
      console.error(data.toString())
    })

    lighthouse.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Lighthouse 退出码: ${code}`))
      }
    })
  })
}

/**
 * 解析 Lighthouse 报告
 */
function parseLighthouseReport() {
  const reportPath = path.join(process.cwd(), 'lighthouse-report.json')
  
  if (!fs.existsSync(reportPath)) {
    throw new Error('Lighthouse 报告不存在')
  }

  const reportData = fs.readFileSync(reportPath, 'utf-8')
  const report = JSON.parse(reportData)

  return {
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    bestPractices: Math.round(report.categories['best-practices'].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
    metrics: {
      fcp: report.audits['first-contentful-paint'].numericValue,
      lcp: report.audits['largest-contentful-paint'].numericValue,
      cls: report.audits['cumulative-layout-shift'].numericValue,
      tti: report.audits.interactive.numericValue,
      tbt: report.audits['total-blocking-time'].numericValue,
      si: report.audits['speed-index'].numericValue,
    },
  }
}

/**
 * 检查性能分数
 */
function checkScores(scores) {
  console.log(colorize('\n📊 Lighthouse 分数:\n', 'cyan'))

  const categories = [
    { key: 'performance', name: '性能' },
    { key: 'accessibility', name: '无障碍性' },
    { key: 'bestPractices', name: '最佳实践' },
    { key: 'seo', name: 'SEO' },
  ]

  let allPassed = true

  categories.forEach(({ key, name }) => {
    const score = scores[key]
    const threshold = SCORE_THRESHOLDS[key]
    const passed = score >= threshold

    if (!passed) allPassed = false

    const icon = passed ? '✅' : '❌'
    const color = passed ? 'green' : 'red'
    const emoji = score >= 90 ? '🟢' : score >= 50 ? '🟡' : '🔴'

    console.log(
      `${icon} ${name}:`,
      emoji,
      colorize(`${score}`, color),
      `/ ${threshold}`
    )
  })

  // 显示核心指标
  console.log(colorize('\n⚡ Core Web Vitals:\n', 'cyan'))

  const metrics = [
    { key: 'fcp', name: 'First Contentful Paint', threshold: 1800, unit: 'ms' },
    { key: 'lcp', name: 'Largest Contentful Paint', threshold: 2500, unit: 'ms' },
    { key: 'cls', name: 'Cumulative Layout Shift', threshold: 0.1, unit: '' },
    { key: 'tti', name: 'Time to Interactive', threshold: 3800, unit: 'ms' },
    { key: 'tbt', name: 'Total Blocking Time', threshold: 200, unit: 'ms' },
    { key: 'si', name: 'Speed Index', threshold: 3400, unit: 'ms' },
  ]

  metrics.forEach(({ key, name, threshold, unit }) => {
    const value = scores.metrics[key]
    const passed = value <= threshold
    const icon = passed ? '✅' : '⚠️'
    const color = passed ? 'green' : 'yellow'

    console.log(
      `${icon} ${name}:`,
      colorize(`${Math.round(value)}${unit}`, color),
      `(threshold: ${threshold}${unit})`
    )
  })

  return allPassed
}

/**
 * 主函数
 */
async function main() {
  const url = process.argv[2] || 'http://localhost:3000'

  console.log(colorize('🔍 Lighthouse CI 检查', 'cyan'))
  console.log(colorize('═'.repeat(50), 'cyan'))

  try {
    // 运行 Lighthouse
    await runLighthouse(url)

    // 解析报告
    const scores = parseLighthouseReport()

    // 检查分数
    const passed = checkScores(scores)

    // 生成摘要
    const reportHtmlPath = path.join(process.cwd(), 'lighthouse-report.html')
    console.log(colorize(`\n📄 详细报告: ${reportHtmlPath}`, 'blue'))

    if (passed) {
      console.log(colorize('\n✅ 所有 Lighthouse 检查通过！', 'green'))
      process.exit(0)
    } else {
      console.log(colorize('\n❌ 部分 Lighthouse 检查未通过', 'red'))
      process.exit(1)
    }
  } catch (error) {
    console.error(colorize(`\n❌ 错误: ${error.message}`, 'red'))
    process.exit(1)
  }
}

// 检查 Lighthouse 是否安装
const checkLighthouse = spawn('npx', ['lighthouse', '--version'])

checkLighthouse.on('close', (code) => {
  if (code === 0) {
    main()
  } else {
    console.error(colorize('\n❌ Lighthouse 未安装', 'red'))
    console.log(colorize('\n请运行: npm install -g lighthouse', 'yellow'))
    process.exit(1)
  }
})

