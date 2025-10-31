/**
 * 颜色对比度检查工具
 * Color Contrast Checker
 * 
 * 用于检查项目中的颜色组合是否符合 WCAG 标准
 */

import { checkContrast, type TextSize } from './accessibility';

/**
 * 颜色组合定义
 */
export interface ColorPair {
  name: string;
  foreground: string;
  background: string;
  usage: string;
  textSize?: TextSize;
}

/**
 * 对比度检查结果
 */
export interface ContrastReport {
  name: string;
  foreground: string;
  background: string;
  usage: string;
  textSize: TextSize;
  ratio: number;
  aaPass: boolean;
  aaaPass: boolean;
  requiredAA: number;
  requiredAAA: number;
}

/**
 * 批量检查颜色对比度
 */
export function checkColorPairs(
  pairs: ColorPair[]
): ContrastReport[] {
  return pairs.map((pair) => {
    const textSize = pair.textSize || 'normal';
    const aaResult = checkContrast(pair.foreground, pair.background, 'AA', textSize);
    const aaaResult = checkContrast(pair.foreground, pair.background, 'AAA', textSize);

    if (!aaResult || !aaaResult) {
      throw new Error(`Invalid color values: ${pair.foreground}, ${pair.background}`);
    }

    return {
      name: pair.name,
      foreground: pair.foreground,
      background: pair.background,
      usage: pair.usage,
      textSize,
      ratio: aaResult.ratio,
      aaPass: aaResult.passes,
      aaaPass: aaaResult.passes,
      requiredAA: aaResult.requiredRatio,
      requiredAAA: aaaResult.requiredRatio,
    };
  });
}

/**
 * 生成对比度检查报告
 */
export function generateContrastReport(reports: ContrastReport[]): string {
  const failedAA = reports.filter((r) => !r.aaPass);
  const failedAAA = reports.filter((r) => !r.aaaPass);

  let output = '# 颜色对比度检查报告\n\n';
  output += `检查日期: ${new Date().toLocaleString('zh-CN')}\n\n`;
  output += `## 总览\n\n`;
  output += `- 总计: ${reports.length} 个颜色组合\n`;
  output += `- AA 级别通过: ${reports.length - failedAA.length} / ${reports.length}\n`;
  output += `- AAA 级别通过: ${reports.length - failedAAA.length} / ${reports.length}\n\n`;

  if (failedAA.length > 0) {
    output += `## ⚠️ AA 级别未通过 (${failedAA.length})\n\n`;
    output += '| 名称 | 前景色 | 背景色 | 用途 | 文本大小 | 对比度 | 要求 |\n';
    output += '|------|--------|--------|------|----------|--------|------|\n';
    failedAA.forEach((report) => {
      output += `| ${report.name} | ${report.foreground} | ${report.background} | ${report.usage} | ${report.textSize} | ${report.ratio}:1 | ${report.requiredAA}:1 |\n`;
    });
    output += '\n';
  }

  if (failedAAA.length > 0) {
    output += `## ℹ️ AAA 级别未通过 (${failedAAA.length})\n\n`;
    output += '| 名称 | 前景色 | 背景色 | 用途 | 文本大小 | 对比度 | 要求 |\n';
    output += '|------|--------|--------|------|----------|--------|------|\n';
    failedAAA.forEach((report) => {
      output += `| ${report.name} | ${report.foreground} | ${report.background} | ${report.usage} | ${report.textSize} | ${report.ratio}:1 | ${report.requiredAAA}:1 |\n`;
    });
    output += '\n';
  }

  output += '## ✅ 所有通过的组合\n\n';
  output += '| 名称 | 前景色 | 背景色 | 用途 | 对比度 | AA | AAA |\n';
  output += '|------|--------|--------|------|--------|-------|-----|\n';
  reports.forEach((report) => {
    output += `| ${report.name} | ${report.foreground} | ${report.background} | ${report.usage} | ${report.ratio}:1 | ${report.aaPass ? '✅' : '❌'} | ${report.aaaPass ? '✅' : '❌'} |\n`;
  });

  return output;
}

/**
 * 项目中常用的颜色组合（示例）
 * 实际使用时应该根据项目的设计系统定义
 */
export const PROJECT_COLOR_PAIRS: ColorPair[] = [
  // 主色调
  {
    name: 'Primary Text',
    foreground: '#ffffff',
    background: '#0070f3',
    usage: '主按钮文字',
    textSize: 'normal',
  },
  {
    name: 'Primary Hover',
    foreground: '#ffffff',
    background: '#0051cc',
    usage: '主按钮悬停',
    textSize: 'normal',
  },

  // 文本颜色
  {
    name: 'Body Text',
    foreground: '#1a1a1a',
    background: '#ffffff',
    usage: '正文文字',
    textSize: 'normal',
  },
  {
    name: 'Secondary Text',
    foreground: '#666666',
    background: '#ffffff',
    usage: '次要文字',
    textSize: 'normal',
  },
  {
    name: 'Muted Text',
    foreground: '#999999',
    background: '#ffffff',
    usage: '弱化文字',
    textSize: 'large',
  },

  // 暗色模式
  {
    name: 'Dark Body Text',
    foreground: '#f0f0f0',
    background: '#1a1a1a',
    usage: '暗色模式正文',
    textSize: 'normal',
  },
  {
    name: 'Dark Secondary Text',
    foreground: '#b3b3b3',
    background: '#1a1a1a',
    usage: '暗色模式次要文字',
    textSize: 'normal',
  },

  // 状态颜色
  {
    name: 'Success Text',
    foreground: '#ffffff',
    background: '#10b981',
    usage: '成功状态',
    textSize: 'normal',
  },
  {
    name: 'Warning Text',
    foreground: '#000000',
    background: '#f59e0b',
    usage: '警告状态',
    textSize: 'normal',
  },
  {
    name: 'Error Text',
    foreground: '#ffffff',
    background: '#ef4444',
    usage: '错误状态',
    textSize: 'normal',
  },
  {
    name: 'Info Text',
    foreground: '#ffffff',
    background: '#3b82f6',
    usage: '信息状态',
    textSize: 'normal',
  },

  // 链接
  {
    name: 'Link',
    foreground: '#0070f3',
    background: '#ffffff',
    usage: '链接文字',
    textSize: 'normal',
  },
  {
    name: 'Link Hover',
    foreground: '#0051cc',
    background: '#ffffff',
    usage: '链接悬停',
    textSize: 'normal',
  },
  {
    name: 'Dark Link',
    foreground: '#3b82f6',
    background: '#1a1a1a',
    usage: '暗色模式链接',
    textSize: 'normal',
  },
];

/**
 * 运行对比度检查并打印到控制台
 */
export function runContrastCheck(pairs: ColorPair[] = PROJECT_COLOR_PAIRS): void {
  console.log('🎨 开始颜色对比度检查...\n');

  const reports = checkColorPairs(pairs);
  const report = generateContrastReport(reports);

  console.log(report);

  const failedAA = reports.filter((r) => !r.aaPass);
  if (failedAA.length > 0) {
    console.error(`❌ ${failedAA.length} 个颜色组合未通过 WCAG AA 级别标准`);
    process.exit(1);
  } else {
    console.log('✅ 所有颜色组合均通过 WCAG AA 级别标准');
  }
}

/**
 * 将报告保存为文件
 */
export function saveContrastReport(
  reports: ContrastReport[],
  filepath: string
): Promise<void> {
  const report = generateContrastReport(reports);
  
  if (typeof window === 'undefined') {
    // Node.js 环境
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(filepath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, report, 'utf-8');
    console.log(`✅ 报告已保存到: ${filepath}`);
    return Promise.resolve();
  } else {
    // 浏览器环境
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filepath;
    a.click();
    URL.revokeObjectURL(url);
    return Promise.resolve();
  }
}

