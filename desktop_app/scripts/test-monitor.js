#!/usr/bin/env node

/**
 * 🧪 测试监控和报告生成工具
 * 自动监控测试执行状态，生成详细报告
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// 配置
const CONFIG = {
  projectRoot: '/opt/zishu-sensei/desktop_app',
  testResultsDir: 'test-results',
  coverageDir: 'coverage',
  reportsDir: 'reports',
  thresholds: {
    coverage: 80,
    performance: 10, // 分钟
    stability: 95
  }
};

// 测试结果接口
interface TestResult {
  type: 'unit' | 'integration' | 'backend' | 'e2e';
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  coverage?: number;
  errors?: string[];
  warnings?: string[];
}

// 测试报告接口
interface TestReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  coverage: number;
  duration: number;
  results: TestResult[];
  summary: string;
  recommendations: string[];
}

class TestMonitor {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 运行测试并收集结果
   */
  async runTests(): Promise<void> {
    console.log('🧪 开始执行测试...');
    
    try {
      // 运行前端单元测试
      await this.runFrontendUnitTests();
      
      // 运行前端集成测试
      await this.runFrontendIntegrationTests();
      
      // 运行后端测试
      await this.runBackendTests();
      
      // 运行 E2E 测试
      await this.runE2ETests();
      
      console.log('✅ 所有测试执行完成');
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
      throw error;
    }
  }

  /**
   * 运行前端单元测试
   */
  private async runFrontendUnitTests(): Promise<void> {
    console.log('📱 运行前端单元测试...');
    
    try {
      const startTime = Date.now();
      const output = execSync('npm run test:coverage', { 
        cwd: CONFIG.projectRoot,
        encoding: 'utf8'
      });
      
      const duration = Date.now() - startTime;
      const coverage = this.extractCoverage(output);
      
      this.results.push({
        type: 'unit',
        status: 'passed',
        duration,
        coverage
      });
      
      console.log(`✅ 前端单元测试通过 (${duration}ms, 覆盖率: ${coverage}%)`);
    } catch (error) {
      this.results.push({
        type: 'unit',
        status: 'failed',
        duration: 0,
        errors: [error.message]
      });
      
      console.error('❌ 前端单元测试失败:', error.message);
    }
  }

  /**
   * 运行前端集成测试
   */
  private async runFrontendIntegrationTests(): Promise<void> {
    console.log('🔗 运行前端集成测试...');
    
    try {
      const startTime = Date.now();
      execSync('npm run test:integration', { 
        cwd: CONFIG.projectRoot,
        encoding: 'utf8'
      });
      
      const duration = Date.now() - startTime;
      
      this.results.push({
        type: 'integration',
        status: 'passed',
        duration
      });
      
      console.log(`✅ 前端集成测试通过 (${duration}ms)`);
    } catch (error) {
      this.results.push({
        type: 'integration',
        status: 'failed',
        duration: 0,
        errors: [error.message]
      });
      
      console.error('❌ 前端集成测试失败:', error.message);
    }
  }

  /**
   * 运行后端测试
   */
  private async runBackendTests(): Promise<void> {
    console.log('🦀 运行后端测试...');
    
    try {
      const startTime = Date.now();
      execSync('cargo test', { 
        cwd: path.join(CONFIG.projectRoot, 'src-tauri'),
        encoding: 'utf8'
      });
      
      const duration = Date.now() - startTime;
      
      this.results.push({
        type: 'backend',
        status: 'passed',
        duration
      });
      
      console.log(`✅ 后端测试通过 (${duration}ms)`);
    } catch (error) {
      this.results.push({
        type: 'backend',
        status: 'failed',
        duration: 0,
        errors: [error.message]
      });
      
      console.error('❌ 后端测试失败:', error.message);
    }
  }

  /**
   * 运行 E2E 测试
   */
  private async runE2ETests(): Promise<void> {
    console.log('🌐 运行 E2E 测试...');
    
    try {
      const startTime = Date.now();
      execSync('npm run test:e2e', { 
        cwd: CONFIG.projectRoot,
        encoding: 'utf8'
      });
      
      const duration = Date.now() - startTime;
      
      this.results.push({
        type: 'e2e',
        status: 'passed',
        duration
      });
      
      console.log(`✅ E2E 测试通过 (${duration}ms)`);
    } catch (error) {
      this.results.push({
        type: 'e2e',
        status: 'failed',
        duration: 0,
        errors: [error.message]
      });
      
      console.error('❌ E2E 测试失败:', error.message);
    }
  }

  /**
   * 从测试输出中提取覆盖率
   */
  private extractCoverage(output: string): number {
    const coverageMatch = output.match(/All files\s+\|\s+(\d+(?:\.\d+)?)/);
    return coverageMatch ? parseFloat(coverageMatch[1]) : 0;
  }

  /**
   * 生成测试报告
   */
  async generateReport(): Promise<TestReport> {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'passed').length;
    const failedTests = this.results.filter(r => r.status === 'failed').length;
    const skippedTests = this.results.filter(r => r.status === 'skipped').length;
    
    const coverage = this.calculateOverallCoverage();
    const summary = this.generateSummary();
    const recommendations = this.generateRecommendations();

    const report: TestReport = {
      timestamp: new Date().toISOString(),
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      coverage,
      duration: totalDuration,
      results: this.results,
      summary,
      recommendations
    };

    await this.saveReport(report);
    return report;
  }

  /**
   * 计算整体覆盖率
   */
  private calculateOverallCoverage(): number {
    const coverageResults = this.results.filter(r => r.coverage !== undefined);
    if (coverageResults.length === 0) return 0;
    
    const totalCoverage = coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0);
    return totalCoverage / coverageResults.length;
  }

  /**
   * 生成测试摘要
   */
  private generateSummary(): string {
    const passedTests = this.results.filter(r => r.status === 'passed').length;
    const failedTests = this.results.filter(r => r.status === 'failed').length;
    const totalTests = this.results.length;
    
    if (failedTests === 0) {
      return `🎉 所有测试通过! 共 ${totalTests} 个测试，通过率 100%`;
    } else {
      return `⚠️ 测试完成，${passedTests}/${totalTests} 通过，${failedTests} 个失败`;
    }
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // 检查覆盖率
    const coverage = this.calculateOverallCoverage();
    if (coverage < CONFIG.thresholds.coverage) {
      recommendations.push(`覆盖率 ${coverage.toFixed(1)}% 低于阈值 ${CONFIG.thresholds.coverage}%，建议增加测试用例`);
    }
    
    // 检查性能
    const totalDuration = Date.now() - this.startTime;
    const durationMinutes = totalDuration / (1000 * 60);
    if (durationMinutes > CONFIG.thresholds.performance) {
      recommendations.push(`测试执行时间 ${durationMinutes.toFixed(1)} 分钟超过阈值 ${CONFIG.thresholds.performance} 分钟，建议优化测试性能`);
    }
    
    // 检查失败测试
    const failedTests = this.results.filter(r => r.status === 'failed');
    if (failedTests.length > 0) {
      recommendations.push(`发现 ${failedTests.length} 个失败测试，建议优先修复`);
    }
    
    // 检查稳定性
    const stability = (this.results.filter(r => r.status === 'passed').length / this.results.length) * 100;
    if (stability < CONFIG.thresholds.stability) {
      recommendations.push(`测试稳定性 ${stability.toFixed(1)}% 低于阈值 ${CONFIG.thresholds.stability}%，建议检查测试环境`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('测试质量良好，继续保持!');
    }
    
    return recommendations;
  }

  /**
   * 保存测试报告
   */
  private async saveReport(report: TestReport): Promise<void> {
    const reportsDir = path.join(CONFIG.projectRoot, CONFIG.reportsDir);
    await fs.mkdir(reportsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportsDir, `test-report-${timestamp}.json`);
    
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    
    // 生成 Markdown 报告
    const markdownReport = this.generateMarkdownReport(report);
    const markdownFile = path.join(reportsDir, `test-report-${timestamp}.md`);
    await fs.writeFile(markdownFile, markdownReport);
    
    console.log(`📊 测试报告已保存: ${reportFile}`);
    console.log(`📄 Markdown 报告已保存: ${markdownFile}`);
  }

  /**
   * 生成 Markdown 格式的报告
   */
  private generateMarkdownReport(report: TestReport): string {
    return `# 🧪 测试执行报告

## 📊 执行摘要

- **执行时间**: ${new Date(report.timestamp).toLocaleString()}
- **总测试数**: ${report.totalTests}
- **通过测试**: ${report.passedTests} ✅
- **失败测试**: ${report.failedTests} ❌
- **跳过测试**: ${report.skippedTests} ⏭️
- **整体覆盖率**: ${report.coverage.toFixed(1)}%
- **执行时长**: ${(report.duration / 1000).toFixed(1)} 秒

## 📈 测试结果详情

| 测试类型 | 状态 | 执行时间 | 覆盖率 |
|---------|------|----------|--------|
${report.results.map(r => 
  `| ${r.type} | ${r.status === 'passed' ? '✅ 通过' : '❌ 失败'} | ${r.duration}ms | ${r.coverage ? r.coverage.toFixed(1) + '%' : 'N/A'} |`
).join('\n')}

## 🎯 测试摘要

${report.summary}

## 💡 改进建议

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## 📋 详细结果

${report.results.map(result => `
### ${result.type} 测试

- **状态**: ${result.status === 'passed' ? '✅ 通过' : '❌ 失败'}
- **执行时间**: ${result.duration}ms
- **覆盖率**: ${result.coverage ? result.coverage.toFixed(1) + '%' : 'N/A'}

${result.errors ? `**错误信息**:\n${result.errors.map(err => `- ${err}`).join('\n')}` : ''}

${result.warnings ? `**警告信息**:\n${result.warnings.map(warn => `- ${warn}`).join('\n')}` : ''}
`).join('\n')}

---
*报告生成时间: ${new Date().toLocaleString()}*
`;
  }

  /**
   * 显示测试报告
   */
  displayReport(report: TestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 测试执行报告');
    console.log('='.repeat(60));
    console.log(`📅 执行时间: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`⏱️  执行时长: ${(report.duration / 1000).toFixed(1)} 秒`);
    console.log(`📊 总测试数: ${report.totalTests}`);
    console.log(`✅ 通过测试: ${report.passedTests}`);
    console.log(`❌ 失败测试: ${report.failedTests}`);
    console.log(`⏭️  跳过测试: ${report.skippedTests}`);
    console.log(`📈 整体覆盖率: ${report.coverage.toFixed(1)}%`);
    console.log('\n📋 测试结果详情:');
    
    report.results.forEach(result => {
      const status = result.status === 'passed' ? '✅' : '❌';
      const coverage = result.coverage ? ` (${result.coverage.toFixed(1)}%)` : '';
      console.log(`  ${status} ${result.type}: ${result.duration}ms${coverage}`);
    });
    
    console.log('\n🎯 测试摘要:');
    console.log(`  ${report.summary}`);
    
    console.log('\n💡 改进建议:');
    report.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });
    
    console.log('\n' + '='.repeat(60));
  }
}

// 主函数
async function main() {
  try {
    const monitor = new TestMonitor();
    
    // 运行测试
    await monitor.runTests();
    
    // 生成报告
    const report = await monitor.generateReport();
    
    // 显示报告
    monitor.displayReport(report);
    
    // 根据测试结果设置退出码
    if (report.failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ 测试监控失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { TestMonitor, TestResult, TestReport };
