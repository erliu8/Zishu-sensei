#!/usr/bin/env node

/**
 * 性能检查脚本
 * 分析构建产物并生成性能报告
 */

const fs = require('fs')
const path = require('path')
const { gzip } = require('zlib')
const { promisify } = require('util')

const gzipAsync = promisify(gzip)

/**
 * 性能预算配置
 */
const PERFORMANCE_BUDGET = {
  // JavaScript 文件大小预算（字节）
  maxJsSize: 200 * 1024, // 200KB (gzipped)
  maxCssSize: 50 * 1024, // 50KB (gzipped)
  maxImageSize: 100 * 1024, // 100KB
  maxTotalSize: 500 * 1024, // 500KB (gzipped)
  
  // 文件数量预算
  maxJsFiles: 10,
  maxCssFiles: 3,
  
  // Lighthouse 分数预算
  minPerformanceScore: 90,
  minAccessibilityScore: 90,
  minBestPracticesScore: 90,
  minSeoScore: 90,
}

/**
 * 颜色输出
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 获取文件的 gzip 大小
 */
async function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath)
  const compressed = await gzipAsync(content)
  return compressed.length
}

/**
 * 递归获取目录中的所有文件
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath)

  files.forEach((file) => {
    const filePath = path.join(dirPath, file)
    
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles)
    } else {
      arrayOfFiles.push(filePath)
    }
  })

  return arrayOfFiles
}

/**
 * 分析构建产物
 */
async function analyzeBuild() {
  console.log(colorize('\n📊 性能分析开始...\n', 'cyan'))

  const buildDir = path.join(process.cwd(), '.next')
  
  if (!fs.existsSync(buildDir)) {
    console.error(colorize('❌ 构建目录不存在，请先运行 npm run build', 'red'))
    process.exit(1)
  }

  const staticDir = path.join(buildDir, 'static')
  
  if (!fs.existsSync(staticDir)) {
    console.error(colorize('❌ 静态资源目录不存在', 'red'))
    process.exit(1)
  }

  // 分析 JavaScript 文件
  console.log(colorize('🔍 分析 JavaScript 文件...', 'blue'))
  const jsDir = path.join(staticDir, 'chunks')
  let jsFiles = []
  let totalJsSize = 0
  let totalJsGzipSize = 0

  if (fs.existsSync(jsDir)) {
    const allJsFiles = getAllFiles(jsDir).filter((f) => f.endsWith('.js'))
    
    for (const file of allJsFiles) {
      const size = fs.statSync(file).size
      const gzipSize = await getGzipSize(file)
      const relativePath = path.relative(buildDir, file)
      
      jsFiles.push({
        path: relativePath,
        size,
        gzipSize,
      })
      
      totalJsSize += size
      totalJsGzipSize += gzipSize
    }

    // 按大小排序
    jsFiles.sort((a, b) => b.gzipSize - a.gzipSize)

    // 显示前 10 个最大的文件
    console.log('\n  Top 10 最大的 JS 文件 (gzipped):')
    jsFiles.slice(0, 10).forEach((file, index) => {
      const sizeColor = file.gzipSize > PERFORMANCE_BUDGET.maxJsSize ? 'red' : 'green'
      console.log(
        `  ${index + 1}. ${file.path}`,
        colorize(formatSize(file.gzipSize), sizeColor)
      )
    })
  }

  // 分析 CSS 文件
  console.log(colorize('\n🎨 分析 CSS 文件...', 'blue'))
  const cssDir = path.join(staticDir, 'css')
  let cssFiles = []
  let totalCssSize = 0
  let totalCssGzipSize = 0

  if (fs.existsSync(cssDir)) {
    const allCssFiles = getAllFiles(cssDir).filter((f) => f.endsWith('.css'))
    
    for (const file of allCssFiles) {
      const size = fs.statSync(file).size
      const gzipSize = await getGzipSize(file)
      const relativePath = path.relative(buildDir, file)
      
      cssFiles.push({
        path: relativePath,
        size,
        gzipSize,
      })
      
      totalCssSize += size
      totalCssGzipSize += gzipSize
    }

    cssFiles.sort((a, b) => b.gzipSize - a.gzipSize)

    console.log('\n  CSS 文件:')
    cssFiles.forEach((file, index) => {
      const sizeColor = file.gzipSize > PERFORMANCE_BUDGET.maxCssSize ? 'red' : 'green'
      console.log(
        `  ${index + 1}. ${file.path}`,
        colorize(formatSize(file.gzipSize), sizeColor)
      )
    })
  }

  // 总结
  console.log(colorize('\n📈 性能预算检查\n', 'cyan'))

  const checks = [
    {
      name: 'JavaScript 总大小 (gzipped)',
      value: totalJsGzipSize,
      budget: PERFORMANCE_BUDGET.maxJsSize,
      unit: 'bytes',
    },
    {
      name: 'CSS 总大小 (gzipped)',
      value: totalCssGzipSize,
      budget: PERFORMANCE_BUDGET.maxCssSize,
      unit: 'bytes',
    },
    {
      name: 'JavaScript 文件数量',
      value: jsFiles.length,
      budget: PERFORMANCE_BUDGET.maxJsFiles,
      unit: 'files',
    },
    {
      name: 'CSS 文件数量',
      value: cssFiles.length,
      budget: PERFORMANCE_BUDGET.maxCssFiles,
      unit: 'files',
    },
  ]

  let hasViolations = false

  checks.forEach((check) => {
    const passed = check.value <= check.budget
    const icon = passed ? '✅' : '❌'
    const color = passed ? 'green' : 'red'
    
    if (!passed) hasViolations = true

    const valueStr = check.unit === 'bytes' 
      ? formatSize(check.value) 
      : `${check.value} ${check.unit}`
    
    const budgetStr = check.unit === 'bytes'
      ? formatSize(check.budget)
      : `${check.budget} ${check.unit}`

    console.log(
      `${icon} ${check.name}:`,
      colorize(valueStr, color),
      `/ ${budgetStr}`
    )
  })

  // 生成 JSON 报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalJsSize,
      totalJsGzipSize,
      totalCssSize,
      totalCssGzipSize,
      jsFileCount: jsFiles.length,
      cssFileCount: cssFiles.length,
    },
    jsFiles,
    cssFiles,
    budgetChecks: checks.map((check) => ({
      ...check,
      passed: check.value <= check.budget,
    })),
  }

  const reportPath = path.join(process.cwd(), 'performance-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  
  console.log(colorize(`\n📝 详细报告已保存到: ${reportPath}`, 'blue'))

  if (hasViolations) {
    console.log(colorize('\n⚠️  发现性能预算超标！', 'yellow'))
    process.exit(1)
  } else {
    console.log(colorize('\n✅ 所有性能预算检查通过！', 'green'))
    process.exit(0)
  }
}

// 运行分析
analyzeBuild().catch((error) => {
  console.error(colorize(`\n❌ 分析失败: ${error.message}`, 'red'))
  console.error(error.stack)
  process.exit(1)
})
