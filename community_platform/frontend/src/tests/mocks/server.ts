/**
 * MSW 服务器配置
 * 用于Node环境（Vitest测试）
 * @module tests/mocks/server
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * 创建MSW服务器实例
 * 用于拦截和模拟HTTP请求
 */
export const server = setupServer(...handlers);

/**
 * 测试生命周期钩子
 */

// 在所有测试开始前启动服务器
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn', // 对未处理的请求发出警告
  });
});

// 每个测试后重置处理器
afterEach(() => {
  server.resetHandlers();
});

// 所有测试完成后关闭服务器
afterAll(() => {
  server.close();
});

export default server;

