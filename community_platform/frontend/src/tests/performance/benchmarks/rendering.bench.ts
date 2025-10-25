/**
 * 渲染性能基准测试
 * 测试关键组件和操作的渲染性能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runBenchmark, formatBenchmarkResult } from '../helpers/benchmark-helper';

describe('Rendering Performance Benchmarks', () => {
  describe('Component Rendering', () => {
    it('should render large lists efficiently', async () => {
      const result = await runBenchmark(
        'Large List Rendering',
        () => {
          // 模拟渲染大列表
          const items = Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: `Description for item ${i}`,
          }));

          // 模拟 DOM 操作
          const fragment = document.createDocumentFragment();
          items.slice(0, 50).forEach(item => {
            const div = document.createElement('div');
            div.textContent = item.name;
            fragment.appendChild(div);
          });

          return fragment;
        },
        {
          iterations: 100,
          warmupIterations: 10,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 平均每次渲染应该在 10ms 以内
      expect(result.averageTime).toBeLessThan(10);
    });

    it('should update component state efficiently', async () => {
      let counter = 0;

      const result = await runBenchmark(
        'State Update',
        () => {
          counter++;
          // 模拟状态更新
          return counter;
        },
        {
          iterations: 10000,
          warmupIterations: 100,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 状态更新应该非常快（< 1ms）
      expect(result.averageTime).toBeLessThan(1);
    });

    it('should filter data efficiently', async () => {
      const data = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 60) + 18,
      }));

      const result = await runBenchmark(
        'Data Filtering',
        () => {
          return data.filter(user => user.age > 30);
        },
        {
          iterations: 1000,
          warmupIterations: 50,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 过滤 10000 条数据应该在 5ms 以内
      expect(result.averageTime).toBeLessThan(5);
    });

    it('should sort data efficiently', async () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${Math.random().toString(36)}`,
        score: Math.floor(Math.random() * 1000),
      }));

      const result = await runBenchmark(
        'Data Sorting',
        () => {
          return [...data].sort((a, b) => b.score - a.score);
        },
        {
          iterations: 500,
          warmupIterations: 20,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 排序 1000 条数据应该在 5ms 以内
      expect(result.averageTime).toBeLessThan(5);
    });

    it('should search data efficiently', async () => {
      const data = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        title: `Article ${i}`,
        content: `This is the content of article ${i}. It contains some random text.`,
        tags: [`tag${i % 10}`, `tag${i % 5}`],
      }));

      const result = await runBenchmark(
        'Data Search',
        () => {
          const query = 'article';
          return data.filter(item => 
            item.title.toLowerCase().includes(query) ||
            item.content.toLowerCase().includes(query)
          );
        },
        {
          iterations: 500,
          warmupIterations: 20,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 搜索应该在 10ms 以内完成
      expect(result.averageTime).toBeLessThan(10);
    });
  });

  describe('DOM Manipulation', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should create DOM elements efficiently', async () => {
      const result = await runBenchmark(
        'DOM Element Creation',
        () => {
          const div = document.createElement('div');
          div.className = 'test-element';
          div.textContent = 'Test content';
          return div;
        },
        {
          iterations: 5000,
          warmupIterations: 100,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 创建 DOM 元素应该非常快
      expect(result.averageTime).toBeLessThan(0.1);
    });

    it('should append DOM elements efficiently', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const result = await runBenchmark(
        'DOM Element Append',
        () => {
          const div = document.createElement('div');
          div.textContent = 'Item';
          container.appendChild(div);
        },
        {
          iterations: 1000,
          warmupIterations: 50,
          afterEach: () => {
            container.innerHTML = '';
          },
        }
      );

      console.log(formatBenchmarkResult(result));

      // 添加 DOM 元素应该很快
      expect(result.averageTime).toBeLessThan(1);
    });

    it('should update DOM efficiently', async () => {
      const div = document.createElement('div');
      div.textContent = 'Initial content';
      document.body.appendChild(div);

      let counter = 0;

      const result = await runBenchmark(
        'DOM Update',
        () => {
          div.textContent = `Updated content ${counter++}`;
        },
        {
          iterations: 5000,
          warmupIterations: 100,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 更新 DOM 应该很快
      expect(result.averageTime).toBeLessThan(0.5);
    });

    it('should query DOM efficiently', async () => {
      // 创建一些测试元素
      const container = document.createElement('div');
      for (let i = 0; i < 100; i++) {
        const div = document.createElement('div');
        div.className = 'test-item';
        div.setAttribute('data-id', String(i));
        container.appendChild(div);
      }
      document.body.appendChild(container);

      const result = await runBenchmark(
        'DOM Query',
        () => {
          return document.querySelectorAll('.test-item');
        },
        {
          iterations: 5000,
          warmupIterations: 100,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 查询 DOM 应该很快
      expect(result.averageTime).toBeLessThan(1);
    });
  });

  describe('String Operations', () => {
    it('should format strings efficiently', async () => {
      const result = await runBenchmark(
        'String Formatting',
        () => {
          const name = 'John Doe';
          const age = 30;
          return `User: ${name}, Age: ${age}`;
        },
        {
          iterations: 100000,
          warmupIterations: 1000,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 字符串格式化应该非常快
      expect(result.averageTime).toBeLessThan(0.01);
    });

    it('should parse JSON efficiently', async () => {
      const jsonString = JSON.stringify({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        profile: {
          age: 30,
          location: 'New York',
        },
      });

      const result = await runBenchmark(
        'JSON Parsing',
        () => {
          return JSON.parse(jsonString);
        },
        {
          iterations: 10000,
          warmupIterations: 500,
        }
      );

      console.log(formatBenchmarkResult(result));

      // JSON 解析应该很快
      expect(result.averageTime).toBeLessThan(0.1);
    });

    it('should stringify JSON efficiently', async () => {
      const data = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        profile: {
          age: 30,
          location: 'New York',
        },
      };

      const result = await runBenchmark(
        'JSON Stringify',
        () => {
          return JSON.stringify(data);
        },
        {
          iterations: 10000,
          warmupIterations: 500,
        }
      );

      console.log(formatBenchmarkResult(result));

      // JSON 序列化应该很快
      expect(result.averageTime).toBeLessThan(0.1);
    });
  });

  describe('Array Operations', () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => i);

    it('should map arrays efficiently', async () => {
      const result = await runBenchmark(
        'Array Map',
        () => {
          return largeArray.map(x => x * 2);
        },
        {
          iterations: 500,
          warmupIterations: 20,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 映射 10000 个元素应该在 5ms 以内
      expect(result.averageTime).toBeLessThan(5);
    });

    it('should reduce arrays efficiently', async () => {
      const result = await runBenchmark(
        'Array Reduce',
        () => {
          return largeArray.reduce((sum, x) => sum + x, 0);
        },
        {
          iterations: 1000,
          warmupIterations: 50,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 归约 10000 个元素应该在 3ms 以内
      expect(result.averageTime).toBeLessThan(3);
    });

    it('should find in arrays efficiently', async () => {
      const result = await runBenchmark(
        'Array Find',
        () => {
          return largeArray.find(x => x === 5000);
        },
        {
          iterations: 5000,
          warmupIterations: 100,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 查找应该很快
      expect(result.averageTime).toBeLessThan(1);
    });
  });

  describe('Object Operations', () => {
    const largeObject = Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
    );

    it('should access object properties efficiently', async () => {
      const result = await runBenchmark(
        'Object Property Access',
        () => {
          return largeObject.key500;
        },
        {
          iterations: 100000,
          warmupIterations: 1000,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 属性访问应该非常快
      expect(result.averageTime).toBeLessThan(0.001);
    });

    it('should clone objects efficiently', async () => {
      const result = await runBenchmark(
        'Object Clone',
        () => {
          return { ...largeObject };
        },
        {
          iterations: 5000,
          warmupIterations: 100,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 对象克隆应该合理
      expect(result.averageTime).toBeLessThan(1);
    });

    it('should merge objects efficiently', async () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { d: 4, e: 5, f: 6 };

      const result = await runBenchmark(
        'Object Merge',
        () => {
          return { ...obj1, ...obj2 };
        },
        {
          iterations: 100000,
          warmupIterations: 1000,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 对象合并应该很快
      expect(result.averageTime).toBeLessThan(0.01);
    });
  });
});

