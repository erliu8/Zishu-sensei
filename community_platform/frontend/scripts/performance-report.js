#!/usr/bin/env node

/**
 * 性能测试报告生成器
 * 从测试结果生成详细的性能报告
 */

const fs = require('fs');
const path = require('path');

// 颜色常量
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// 日志函数
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}\n`),
};

// 读取 Playwright 测试结果
function readPlaywrightResults() {
  const resultsPath = path.join(__dirname, '../playwright-report/performance/results.json');
  
  if (!fs.existsSync(resultsPath)) {
    log.warning('未找到 Playwright 测试结果');
    return null;
  }

  try {
    const data = fs.readFileSync(resultsPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    log.error(`读取 Playwright 结果失败: ${error.message}`);
    return null;
  }
}

// 格式化时间
function formatTime(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

// 格式化大小
function formatSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// 生成性能等级
function getPerformanceGrade(score) {
  if (score >= 90) return { grade: 'A', color: colors.green };
  if (score >= 80) return { grade: 'B', color: colors.blue };
  if (score >= 70) return { grade: 'C', color: colors.yellow };
  if (score >= 60) return { grade: 'D', color: colors.yellow };
  return { grade: 'F', color: colors.red };
}

// 分析 Playwright 测试结果
function analyzePlaywrightResults(results) {
  if (!results) return null;

  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
  };

  if (results.suites) {
    results.suites.forEach(suite => {
      if (suite.specs) {
        suite.specs.forEach(spec => {
          summary.total++;
          if (spec.ok) {
            summary.passed++;
          } else {
            summary.failed++;
          }
          summary.duration += spec.duration || 0;
        });
      }
    });
  }

  return summary;
}

// 生成性能报告摘要
function generateSummary(playwrightResults) {
  log.title('📊 性能测试报告');

  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│                    测试结果摘要                         │');
  console.log('├─────────────────────────────────────────────────────────┤');

  if (playwrightResults) {
    const summary = analyzePlaywrightResults(playwrightResults);
    
    if (summary) {
      const passRate = ((summary.passed / summary.total) * 100).toFixed(1);
      const passRateColor = summary.failed === 0 ? colors.green : colors.yellow;

      console.log(`│ 总测试数:     ${summary.total.toString().padEnd(41)} │`);
      console.log(`│ 通过:         ${colors.green}${summary.passed.toString()}${colors.reset}${' '.repeat(41 - summary.passed.toString().length)} │`);
      console.log(`│ 失败:         ${colors.red}${summary.failed.toString()}${colors.reset}${' '.repeat(41 - summary.failed.toString().length)} │`);
      console.log(`│ 通过率:       ${passRateColor}${passRate}%${colors.reset}${' '.repeat(38 - passRate.length)} │`);
      console.log(`│ 总耗时:       ${formatTime(summary.duration).padEnd(41)} │`);
    }
  } else {
    console.log('│ 未找到测试结果                                          │');
  }

  console.log('└─────────────────────────────────────────────────────────┘');
}

// 生成性能建议
function generateRecommendations() {
  log.title('💡 性能优化建议');

  const recommendations = [
    {
      title: '图片优化',
      tips: [
        '使用 Next.js Image 组件进行自动优化',
        '使用 WebP 格式替代 JPEG/PNG',
        '实现图片懒加载',
        '使用适当的图片尺寸',
      ],
    },
    {
      title: 'JavaScript 优化',
      tips: [
        '实现代码分割和动态导入',
        '移除未使用的代码',
        '使用 Tree Shaking',
        '考虑使用 Web Workers 处理重计算',
      ],
    },
    {
      title: 'CSS 优化',
      tips: [
        '移除未使用的 CSS',
        '使用 CSS-in-JS 或 Tailwind CSS 的 purge 功能',
        '内联关键 CSS',
        '延迟加载非关键 CSS',
      ],
    },
    {
      title: '缓存策略',
      tips: [
        '实现适当的 HTTP 缓存策略',
        '使用 Service Worker 进行离线缓存',
        '实现 API 响应缓存',
        '使用 CDN 分发静态资源',
      ],
    },
    {
      title: '渲染优化',
      tips: [
        '使用 React.memo 避免不必要的重渲染',
        '实现虚拟滚动处理大列表',
        '优化组件层级和复杂度',
        '使用 Suspense 和 Lazy Loading',
      ],
    },
  ];

  recommendations.forEach(rec => {
    console.log(`\n${colors.bright}${rec.title}:${colors.reset}`);
    rec.tips.forEach(tip => {
      console.log(`  • ${tip}`);
    });
  });

  console.log('');
}

// 生成性能指标对比表
function generateMetricsComparison() {
  log.title('📈 性能指标对比');

  console.log('┌──────────────────┬──────────────┬──────────────┬──────────────┐');
  console.log('│ 指标             │ 目标         │ 当前         │ 状态         │');
  console.log('├──────────────────┼──────────────┼──────────────┼──────────────┤');
  
  const metrics = [
    { name: 'LCP', target: '< 2.5s', current: '-', status: '⏳' },
    { name: 'FID', target: '< 100ms', current: '-', status: '⏳' },
    { name: 'CLS', target: '< 0.1', current: '-', status: '⏳' },
    { name: 'FCP', target: '< 1.8s', current: '-', status: '⏳' },
    { name: 'TTFB', target: '< 800ms', current: '-', status: '⏳' },
  ];

  metrics.forEach(metric => {
    const name = metric.name.padEnd(16);
    const target = metric.target.padEnd(12);
    const current = metric.current.padEnd(12);
    const status = metric.status.padEnd(12);
    console.log(`│ ${name} │ ${target} │ ${current} │ ${status} │`);
  });

  console.log('└──────────────────┴──────────────┴──────────────┴──────────────┘');
  console.log('\n提示: 运行性能测试后查看实际数据');
}

// 主函数
function main() {
  console.clear();

  // 读取测试结果
  const playwrightResults = readPlaywrightResults();

  // 生成报告各部分
  generateSummary(playwrightResults);
  generateMetricsComparison();
  generateRecommendations();

  // 报告位置
  log.title('📁 详细报告');
  console.log('HTML 报告: playwright-report/performance/index.html');
  console.log('JSON 报告: playwright-report/performance/results.json\n');

  // 最终状态
  if (playwrightResults) {
    const summary = analyzePlaywrightResults(playwrightResults);
    if (summary && summary.failed === 0) {
      log.success('所有性能测试通过！');
    } else if (summary && summary.failed > 0) {
      log.warning(`${summary.failed} 个测试失败，请查看详细报告`);
      process.exit(1);
    }
  } else {
    log.info('请先运行性能测试: npm run test:perf');
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  readPlaywrightResults,
  analyzePlaywrightResults,
  formatTime,
  formatSize,
  getPerformanceGrade,
};

