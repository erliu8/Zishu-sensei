# 性能测试文档

## 📖 概述

本目录包含完整的前端性能测试套件，涵盖 Lighthouse 性能测试、性能基准测试、Web Vitals 监控和负载测试。

## 📁 目录结构

```
performance/
├── helpers/                    # 辅助工具和实用函数
│   ├── performance-metrics.ts  # 性能指标工具
│   ├── lighthouse-helper.ts    # Lighthouse 测试辅助
│   └── benchmark-helper.ts     # 基准测试辅助
│
├── lighthouse/                 # Lighthouse 性能测试
│   ├── home.perf.test.ts      # 首页性能测试
│   ├── dashboard.perf.test.ts # 仪表板性能测试
│   └── content.perf.test.ts   # 内容页性能测试
│
├── benchmarks/                 # 性能基准测试
│   ├── rendering.bench.ts     # 渲染性能基准
│   └── api.bench.ts           # API 性能基准
│
├── web-vitals/                 # Web Vitals 测试
│   └── vitals.test.ts         # Core Web Vitals 测试
│
├── load-testing/               # 负载测试
│   └── stress.test.ts         # 压力和负载测试
│
└── README.md                   # 本文档
```

## 🚀 快速开始

### 运行所有性能测试

```bash
npm run test:perf
# 或
bash scripts/test-performance.sh all
```

### 运行特定类型的测试

```bash
# Lighthouse 性能测试
npm run test:perf:lighthouse

# 性能基准测试
npm run test:perf:bench

# Web Vitals 测试
npm run test:perf:vitals

# 负载测试
npm run test:perf:load
```

### 生成性能报告

```bash
npm run test:perf:report
```

## 📊 测试类型

### 1. Lighthouse 性能测试

测试页面的整体性能、可访问性、最佳实践和 SEO。

**运行命令:**
```bash
bash scripts/test-performance.sh lighthouse
```

**测试内容:**
- Core Web Vitals (LCP, FID, CLS)
- 首次内容绘制 (FCP)
- 首字节时间 (TTFB)
- 资源加载效率
- 图片优化
- JavaScript 执行时间
- 缓存策略
- 移动端性能

**测试文件:**
- `lighthouse/home.perf.test.ts` - 首页性能测试
- `lighthouse/dashboard.perf.test.ts` - 仪表板性能测试
- `lighthouse/content.perf.test.ts` - 内容页性能测试

### 2. 性能基准测试

测试关键操作和函数的执行性能。

**运行命令:**
```bash
bash scripts/test-performance.sh benchmarks
```

**测试内容:**
- 组件渲染性能
- DOM 操作性能
- 数据处理性能
- 字符串操作
- 数组操作
- 对象操作
- API 序列化/反序列化
- 数据转换和验证

**测试文件:**
- `benchmarks/rendering.bench.ts` - 渲染性能基准
- `benchmarks/api.bench.ts` - API 性能基准

### 3. Web Vitals 测试

专注于 Google Core Web Vitals 指标的测试。

**运行命令:**
```bash
bash scripts/test-performance.sh vitals
```

**测试内容:**
- **LCP** (Largest Contentful Paint) - 最大内容绘制时间
  - 目标: < 2.5 秒
- **FID** (First Input Delay) - 首次输入延迟
  - 目标: < 100 毫秒
- **CLS** (Cumulative Layout Shift) - 累积布局偏移
  - 目标: < 0.1
- **FCP** (First Contentful Paint) - 首次内容绘制
  - 目标: < 1.8 秒
- **TTFB** (Time to First Byte) - 首字节时间
  - 目标: < 800 毫秒
- **INP** (Interaction to Next Paint) - 交互到下次绘制
  - 目标: < 200 毫秒

**测试文件:**
- `web-vitals/vitals.test.ts` - 综合 Web Vitals 测试

### 4. 负载和压力测试

测试应用在高负载下的表现。

**运行命令:**
```bash
bash scripts/test-performance.sh load
```

**测试内容:**
- 多用户并发访问
- 快速页面导航
- 内存压力测试
- 快速用户交互
- 持续负载测试
- 并发 API 请求

**测试文件:**
- `load-testing/stress.test.ts` - 负载和压力测试

## 🎯 性能指标和阈值

### Core Web Vitals 阈值

| 指标 | 良好 | 需要改进 | 差 |
|------|------|----------|-----|
| LCP  | < 2.5s | 2.5s - 4s | > 4s |
| FID  | < 100ms | 100ms - 300ms | > 300ms |
| CLS  | < 0.1 | 0.1 - 0.25 | > 0.25 |
| FCP  | < 1.8s | 1.8s - 3s | > 3s |
| TTFB | < 800ms | 800ms - 1.8s | > 1.8s |

### Lighthouse 分数阈值

| 类别 | 目标分数 | 严格模式 | 宽松模式 |
|------|---------|---------|---------|
| 性能 | 90+ | 95+ | 80+ |
| 可访问性 | 90+ | 95+ | 85+ |
| 最佳实践 | 90+ | 95+ | 85+ |
| SEO | 90+ | 95+ | 85+ |

## 📝 编写性能测试

### 示例：Lighthouse 性能测试

```typescript
import { test, expect, chromium } from '@playwright/test';

test('should have good Core Web Vitals', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  const lcp = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        resolve(lastEntry.renderTime || lastEntry.loadTime);
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    });
  });
  
  expect(lcp).toBeLessThan(2500);
  
  await browser.close();
});
```

### 示例：性能基准测试

```typescript
import { describe, it, expect } from 'vitest';
import { runBenchmark } from '../helpers/benchmark-helper';

describe('Rendering Benchmarks', () => {
  it('should render list efficiently', async () => {
    const result = await runBenchmark(
      'List Rendering',
      () => {
        // 你的代码
      },
      {
        iterations: 1000,
        warmupIterations: 10,
      }
    );
    
    expect(result.averageTime).toBeLessThan(10);
  });
});
```

## 🔧 配置

### Playwright 性能测试配置

配置文件: `playwright-performance.config.ts`

主要配置:
- 单线程运行确保准确性
- 禁用视频和追踪减少开销
- 较长的超时时间适应性能测试
- 仅在 Chromium 上运行

### Lighthouse CI 配置

配置文件: `.lighthouserc.js`

主要配置:
- 测试的 URL 列表
- 运行次数和阈值
- 桌面/移动设备配置
- 网络节流设置

## 📈 持续集成

### GitHub Actions

```yaml
- name: Run Performance Tests
  run: |
    npm run build
    npm run test:perf
    
- name: Upload Performance Report
  uses: actions/upload-artifact@v3
  with:
    name: performance-report
    path: playwright-report/performance/
```

## 🐛 调试和故障排除

### 常见问题

**问题：测试超时**
- 增加 timeout 配置
- 检查服务器是否正常运行
- 检查网络连接

**问题：不稳定的测试结果**
- 确保在稳定的环境中运行
- 关闭其他占用资源的程序
- 增加 warmup 迭代次数

**问题：内存不足**
- 减少并发数
- 在测试之间清理资源
- 使用 `--workers=1` 运行

### 调试技巧

```bash
# 查看详细日志
DEBUG=pw:api npm run test:perf

# 运行单个测试文件
npx playwright test src/tests/performance/lighthouse/home.perf.test.ts

# 生成追踪文件
npx playwright test --trace on
```

## 📚 最佳实践

1. **隔离测试环境** - 在一致的环境中运行测试
2. **预热阶段** - 在实际测试前进行预热
3. **多次运行** - 取多次运行的平均值
4. **基准对比** - 保存基准数据进行对比
5. **持续监控** - 在 CI/CD 中集成性能测试
6. **渐进优化** - 设置合理的目标，逐步优化
7. **真实场景** - 模拟真实用户场景和数据

## 🔗 相关资源

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Playwright Performance Testing](https://playwright.dev/docs/test-reporters)
- [Core Web Vitals Guide](https://web.dev/vitals/)

## 📞 支持

如有问题或建议，请联系前端团队或创建 Issue。

---

**最后更新**: 2025-10-25
**维护者**: Frontend Performance Team

