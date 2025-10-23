#!/usr/bin/env ts-node
/**
 * 颜色对比度检查脚本
 * 用于 CI/CD 流程或手动检查
 * 
 * 运行方式:
 *   npm run check:contrast
 *   或
 *   ts-node scripts/check-contrast.ts
 */

import {
  PROJECT_COLOR_PAIRS,
  checkColorPairs,
  saveContrastReport,
  type ColorPair,
} from '../src/shared/utils/contrast-checker';

// 可以在这里添加更多项目特定的颜色组合
const customColorPairs: ColorPair[] = [
  // 从 Tailwind 配置或设计系统中提取的颜色
  // ...
];

async function main() {
  console.log('🎨 Zishu 社区平台 - 颜色对比度检查\n');
  console.log('=' .repeat(50));
  console.log('\n');

  const allPairs = [...PROJECT_COLOR_PAIRS, ...customColorPairs];
  
  console.log(`检查 ${allPairs.length} 个颜色组合...\n`);

  const reports = checkColorPairs(allPairs);
  
  // 统计结果
  const aaPassCount = reports.filter((r) => r.aaPass).length;
  const aaaPassCount = reports.filter((r) => r.aaaPass).length;
  const failedAA = reports.filter((r) => !r.aaPass);

  // 打印结果
  console.log('📊 检查结果:\n');
  console.log(`总计: ${reports.length} 个颜色组合`);
  console.log(`✅ AA 级别通过: ${aaPassCount} / ${reports.length} (${((aaPassCount / reports.length) * 100).toFixed(1)}%)`);
  console.log(`✅ AAA 级别通过: ${aaaPassCount} / ${reports.length} (${((aaaPassCount / reports.length) * 100).toFixed(1)}%)`);
  console.log('\n');

  // 显示未通过的项
  if (failedAA.length > 0) {
    console.log('❌ 未通过 WCAG AA 级别的颜色组合:\n');
    failedAA.forEach((report) => {
      console.log(`  • ${report.name}`);
      console.log(`    前景色: ${report.foreground} / 背景色: ${report.background}`);
      console.log(`    用途: ${report.usage}`);
      console.log(`    对比度: ${report.ratio}:1 (要求: ${report.requiredAA}:1)`);
      console.log('');
    });
  }

  // 保存报告
  const reportPath = 'docs/accessibility/contrast-report.md';
  try {
    await saveContrastReport(reports, reportPath);
    console.log(`\n📄 详细报告已保存到: ${reportPath}\n`);
  } catch (error) {
    console.error('保存报告失败:', error);
  }

  // 根据结果决定退出代码
  console.log('=' .repeat(50));
  if (failedAA.length > 0) {
    console.log('\n❌ 颜色对比度检查失败!');
    console.log(`   ${failedAA.length} 个颜色组合未通过 WCAG AA 级别标准\n`);
    process.exit(1);
  } else {
    console.log('\n✅ 所有颜色组合均通过 WCAG AA 级别标准!\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('检查过程中发生错误:', error);
  process.exit(1);
});

