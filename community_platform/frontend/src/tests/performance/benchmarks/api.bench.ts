/**
 * API 性能基准测试
 * 测试 API 调用和数据处理的性能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runBenchmark, formatBenchmarkResult } from '../helpers/benchmark-helper';

// 模拟 API 数据
const mockUserData = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  profile: {
    age: 30,
    location: 'New York',
    bio: 'Software developer',
  },
  posts: Array.from({ length: 100 }, (_, i) => ({
    id: i,
    title: `Post ${i}`,
    content: `Content for post ${i}`,
  })),
};

const mockApiResponse = {
  data: mockUserData,
  meta: {
    timestamp: Date.now(),
    version: '1.0.0',
  },
};

describe('API Performance Benchmarks', () => {
  describe('Data Serialization', () => {
    it('should serialize API responses efficiently', async () => {
      const result = await runBenchmark(
        'API Response Serialization',
        () => {
          return JSON.stringify(mockApiResponse);
        },
        {
          iterations: 5000,
          warmupIterations: 100,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 序列化应该很快
      expect(result.averageTime).toBeLessThan(0.5);
    });

    it('should deserialize API responses efficiently', async () => {
      const serialized = JSON.stringify(mockApiResponse);

      const result = await runBenchmark(
        'API Response Deserialization',
        () => {
          return JSON.parse(serialized);
        },
        {
          iterations: 5000,
          warmupIterations: 100,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 反序列化应该很快
      expect(result.averageTime).toBeLessThan(0.5);
    });
  });

  describe('Data Transformation', () => {
    it('should transform API data to UI format efficiently', async () => {
      const result = await runBenchmark(
        'API Data Transformation',
        () => {
          return {
            id: mockUserData.id,
            displayName: mockUserData.name,
            contactEmail: mockUserData.email,
            userAge: mockUserData.profile.age,
            userLocation: mockUserData.profile.location,
            postCount: mockUserData.posts.length,
            recentPosts: mockUserData.posts.slice(0, 10).map(post => ({
              postId: post.id,
              postTitle: post.title,
            })),
          };
        },
        {
          iterations: 10000,
          warmupIterations: 500,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 数据转换应该很快
      expect(result.averageTime).toBeLessThan(0.5);
    });

    it('should normalize nested API data efficiently', async () => {
      const nestedData = {
        users: [
          {
            id: 1,
            name: 'User 1',
            posts: [
              { id: 1, title: 'Post 1' },
              { id: 2, title: 'Post 2' },
            ],
          },
          {
            id: 2,
            name: 'User 2',
            posts: [
              { id: 3, title: 'Post 3' },
              { id: 4, title: 'Post 4' },
            ],
          },
        ],
      };

      const result = await runBenchmark(
        'Data Normalization',
        () => {
          const normalized = {
            users: {} as Record<number, any>,
            posts: {} as Record<number, any>,
          };

          nestedData.users.forEach(user => {
            const { posts, ...userData } = user;
            normalized.users[user.id] = {
              ...userData,
              postIds: posts.map(p => p.id),
            };

            posts.forEach(post => {
              normalized.posts[post.id] = { ...post, userId: user.id };
            });
          });

          return normalized;
        },
        {
          iterations: 10000,
          warmupIterations: 500,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 数据标准化应该很快
      expect(result.averageTime).toBeLessThan(0.5);
    });
  });

  describe('Data Validation', () => {
    it('should validate user data efficiently', async () => {
      const validateUser = (user: any) => {
        return (
          typeof user.id === 'number' &&
          typeof user.name === 'string' &&
          typeof user.email === 'string' &&
          user.email.includes('@')
        );
      };

      const result = await runBenchmark(
        'User Data Validation',
        () => {
          return validateUser(mockUserData);
        },
        {
          iterations: 100000,
          warmupIterations: 1000,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 验证应该非常快
      expect(result.averageTime).toBeLessThan(0.01);
    });

    it('should validate complex schemas efficiently', async () => {
      const validateSchema = (data: any) => {
        if (!data || typeof data !== 'object') return false;
        if (typeof data.id !== 'number') return false;
        if (typeof data.name !== 'string') return false;
        if (typeof data.email !== 'string') return false;
        if (!data.profile || typeof data.profile !== 'object') return false;
        if (typeof data.profile.age !== 'number') return false;
        if (typeof data.profile.location !== 'string') return false;
        if (!Array.isArray(data.posts)) return false;
        return true;
      };

      const result = await runBenchmark(
        'Schema Validation',
        () => {
          return validateSchema(mockUserData);
        },
        {
          iterations: 50000,
          warmupIterations: 500,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 复杂验证应该合理
      expect(result.averageTime).toBeLessThan(0.1);
    });
  });

  describe('Caching Operations', () => {
    let cache: Map<string, any>;

    beforeEach(() => {
      cache = new Map();
    });

    it('should cache API responses efficiently', async () => {
      const result = await runBenchmark(
        'Cache Write',
        () => {
          const key = `user_${Math.random()}`;
          cache.set(key, mockApiResponse);
          return key;
        },
        {
          iterations: 10000,
          warmupIterations: 500,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 缓存写入应该很快
      expect(result.averageTime).toBeLessThan(0.1);
    });

    it('should retrieve cached data efficiently', async () => {
      // 预填充缓存
      for (let i = 0; i < 1000; i++) {
        cache.set(`user_${i}`, mockApiResponse);
      }

      const result = await runBenchmark(
        'Cache Read',
        () => {
          return cache.get('user_500');
        },
        {
          iterations: 100000,
          warmupIterations: 1000,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 缓存读取应该非常快
      expect(result.averageTime).toBeLessThan(0.01);
    });

    it('should check cache existence efficiently', async () => {
      for (let i = 0; i < 1000; i++) {
        cache.set(`user_${i}`, mockApiResponse);
      }

      const result = await runBenchmark(
        'Cache Has Check',
        () => {
          return cache.has('user_500');
        },
        {
          iterations: 100000,
          warmupIterations: 1000,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 缓存检查应该非常快
      expect(result.averageTime).toBeLessThan(0.01);
    });
  });

  describe('Query String Operations', () => {
    it('should build query strings efficiently', async () => {
      const params = {
        page: 1,
        limit: 20,
        sort: 'name',
        filter: 'active',
        search: 'test',
      };

      const result = await runBenchmark(
        'Query String Building',
        () => {
          return new URLSearchParams(params as any).toString();
        },
        {
          iterations: 10000,
          warmupIterations: 500,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 构建查询字符串应该很快
      expect(result.averageTime).toBeLessThan(0.5);
    });

    it('should parse query strings efficiently', async () => {
      const queryString = 'page=1&limit=20&sort=name&filter=active&search=test';

      const result = await runBenchmark(
        'Query String Parsing',
        () => {
          return Object.fromEntries(new URLSearchParams(queryString));
        },
        {
          iterations: 10000,
          warmupIterations: 500,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 解析查询字符串应该很快
      expect(result.averageTime).toBeLessThan(0.5);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors efficiently', async () => {
      const handleError = (error: any) => {
        return {
          message: error.message || 'Unknown error',
          code: error.code || 'UNKNOWN_ERROR',
          timestamp: Date.now(),
        };
      };

      const mockError = new Error('API Error');

      const result = await runBenchmark(
        'Error Handling',
        () => {
          return handleError(mockError);
        },
        {
          iterations: 50000,
          warmupIterations: 500,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 错误处理应该很快
      expect(result.averageTime).toBeLessThan(0.1);
    });

    it('should retry failed requests efficiently', async () => {
      let attemptCount = 0;

      const mockFetch = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return mockApiResponse;
      };

      const retryFetch = async (maxRetries: number) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await mockFetch();
          } catch (error) {
            if (i === maxRetries - 1) throw error;
          }
        }
      };

      beforeEach(() => {
        attemptCount = 0;
      });

      const result = await runBenchmark(
        'Request Retry',
        async () => {
          attemptCount = 0;
          return await retryFetch(5);
        },
        {
          iterations: 1000,
          warmupIterations: 50,
        }
      );

      console.log(formatBenchmarkResult(result));

      // 重试机制应该合理
      expect(result.averageTime).toBeLessThan(5);
    });
  });
});

