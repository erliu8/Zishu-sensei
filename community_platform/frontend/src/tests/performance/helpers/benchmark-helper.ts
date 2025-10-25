/**
 * 性能基准测试辅助工具
 */

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
  timestamp: Date;
}

export interface BenchmarkOptions {
  iterations?: number;
  warmupIterations?: number;
  timeout?: number;
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
}

/**
 * 运行性能基准测试
 */
export async function runBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
  const {
    iterations = 1000,
    warmupIterations = 10,
    timeout = 30000,
    beforeEach,
    afterEach,
  } = options;

  // 预热
  for (let i = 0; i < warmupIterations; i++) {
    if (beforeEach) await beforeEach();
    await fn();
    if (afterEach) await afterEach();
  }

  // 实际测试
  const times: number[] = [];
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    // 检查超时
    if (Date.now() - startTime > timeout) {
      console.warn(`Benchmark "${name}" timed out after ${i} iterations`);
      break;
    }

    if (beforeEach) await beforeEach();

    const iterationStart = performance.now();
    await fn();
    const iterationEnd = performance.now();

    if (afterEach) await afterEach();

    times.push(iterationEnd - iterationStart);
  }

  // 计算统计数据
  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const opsPerSecond = 1000 / averageTime;

  return {
    name,
    iterations: times.length,
    totalTime,
    averageTime,
    minTime,
    maxTime,
    opsPerSecond,
    timestamp: new Date(),
  };
}

/**
 * 比较多个基准测试结果
 */
export function compareBenchmarks(
  baseline: BenchmarkResult,
  current: BenchmarkResult
): {
  faster: boolean;
  speedup: number;
  percentChange: number;
  significant: boolean;
} {
  const speedup = baseline.averageTime / current.averageTime;
  const percentChange = ((current.averageTime - baseline.averageTime) / baseline.averageTime) * 100;
  const faster = current.averageTime < baseline.averageTime;
  
  // 认为 ±5% 的变化是显著的
  const significant = Math.abs(percentChange) > 5;

  return {
    faster,
    speedup,
    percentChange,
    significant,
  };
}

/**
 * 格式化基准测试结果
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  return `
📊 Benchmark: ${result.name}
   Iterations: ${result.iterations}
   Average: ${result.averageTime.toFixed(3)} ms
   Min: ${result.minTime.toFixed(3)} ms
   Max: ${result.maxTime.toFixed(3)} ms
   Ops/sec: ${result.opsPerSecond.toFixed(2)}
  `.trim();
}

/**
 * 保存基准测试结果到文件
 */
export async function saveBenchmarkResults(
  results: BenchmarkResult[],
  filepath: string
): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const dir = path.dirname(filepath);
  await fs.mkdir(dir, { recursive: true });

  const data = {
    timestamp: new Date().toISOString(),
    results,
  };

  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
}

/**
 * 加载历史基准测试结果
 */
export async function loadBenchmarkResults(filepath: string): Promise<BenchmarkResult[]> {
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    return data.results || [];
  } catch (error) {
    return [];
  }
}

/**
 * 计算百分位数
 */
export function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 计算标准差
 */
export function calculateStdDev(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

