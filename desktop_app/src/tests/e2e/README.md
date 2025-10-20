# E2E 测试文档

## 概述

本目录包含桌面应用的端到端（E2E）测试套件，使用 Playwright 测试框架。

## 目录结构

```
tests/e2e/
├── setup.ts                      # 测试工具函数和选择器
├── fixtures.ts                   # Mock 数据工厂
├── global-setup.ts              # 全局设置
├── global-teardown.ts           # 全局清理
├── basic-workflow.spec.ts       # 基础工作流测试
├── adapter-management.spec.ts   # 适配器管理测试
├── character-switch.spec.ts     # 角色切换测试
├── screenshots/                 # 测试截图
├── report/                      # 测试报告
└── results/                     # 测试结果
```

## 测试套件

### 1. 基础工作流测试 (`basic-workflow.spec.ts`)

测试应用的核心功能：

- ✅ 应用启动和初始化
- ✅ 聊天消息发送和接收
- ✅ 设置面板操作
- ✅ 主题切换
- ✅ 键盘快捷键
- ✅ 错误处理
- ✅ 性能测试

**测试用例数**: 35+

### 2. 适配器管理测试 (`adapter-management.spec.ts`)

测试适配器的完整生命周期：

- ✅ 适配器搜索和浏览
- ✅ 安装和卸载
- ✅ 配置管理
- ✅ 启动和停止
- ✅ 适配器通信
- ✅ 更新检查和升级
- ✅ 完整工作流

**测试用例数**: 40+

### 3. 角色切换测试 (`character-switch.spec.ts`)

测试角色系统的各个方面：

- ✅ 角色选择和切换
- ✅ Live2D 模型加载
- ✅ 动画播放
- ✅ 表情切换
- ✅ 角色与对话联动
- ✅ 性能优化
- ✅ 错误恢复

**测试用例数**: 38+

## 运行测试

### 前置要求

1. 安装依赖：

```bash
npm install
```

2. 安装 Playwright 浏览器：

```bash
npx playwright install
```

### 运行所有测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 或使用 Playwright CLI
npx playwright test
```

### 运行特定测试

```bash
# 运行基础工作流测试
npx playwright test basic-workflow

# 运行适配器管理测试
npx playwright test adapter-management

# 运行角色切换测试
npx playwright test character-switch
```

### 调试模式

```bash
# 以调试模式运行测试（带 UI）
npx playwright test --debug

# 运行特定测试并调试
npx playwright test basic-workflow --debug
```

### 查看测试报告

```bash
# 查看 HTML 报告
npx playwright show-report tests/e2e/report
```

## 测试配置

测试配置位于 `playwright.config.ts`：

```typescript
{
  testDir: './tests/e2e',
  timeout: 60000,              // 每个测试超时 60 秒
  retries: 2,                  // CI 环境重试 2 次
  workers: 1,                  // 串行执行测试
  reporter: ['html', 'json'],  // 生成 HTML 和 JSON 报告
}
```

## 测试工具

### 选择器 (E2E_SELECTORS)

预定义的测试选择器，确保测试稳定性：

```typescript
import { E2E_SELECTORS } from './setup';

// 使用选择器
await page.click(E2E_SELECTORS.SEND_BUTTON);
```

### 辅助函数

提供常用的测试操作：

```typescript
import {
  waitForAppReady,
  sendChatMessage,
  switchCharacter,
  installAdapter,
} from './setup';

// 等待应用加载
await waitForAppReady(page);

// 发送消息
await sendChatMessage(page, '你好');

// 切换角色
await switchCharacter(page, 'Shizuku');

// 安装适配器
await installAdapter(page, 'OpenAI Adapter');
```

### Mock 数据工厂

生成测试数据：

```typescript
import {
  createMessage,
  createCharacter,
  createAdapter,
  TEST_DATA,
} from './fixtures';

// 创建单个消息
const message = createMessage({
  role: 'user',
  content: '测试消息',
});

// 使用预设数据
const characters = TEST_DATA.characters;
```

## 最佳实践

### 1. 使用 data-testid

在组件中添加 `data-testid` 属性：

```tsx
<button data-testid="send-button">发送</button>
```

### 2. 等待元素就绪

```typescript
// ✅ 好的做法
await waitForElement(page, selector);
await page.click(selector);

// ❌ 不好的做法
await page.click(selector); // 可能元素还未加载
```

### 3. 使用辅助函数

```typescript
// ✅ 好的做法
await sendChatMessage(page, '消息');

// ❌ 不好的做法
await page.fill('[data-testid="message-input"]', '消息');
await page.click('[data-testid="send-button"]');
```

### 4. Mock Tauri 命令

```typescript
// Mock 后端响应
await mockTauriCommand(page, 'send_message', {
  role: 'assistant',
  content: 'AI 回复',
  timestamp: Date.now(),
});
```

### 5. 截图记录

```typescript
// 在关键步骤截图
await takeScreenshot(page, 'step-name');

// 测试失败时自动截图
test.afterEach(async () => {
  if (test.info().status !== 'passed') {
    await takeScreenshot(page, `${test.info().title}-failure`);
  }
});
```

## 调试技巧

### 1. 查看浏览器

```bash
# 运行时显示浏览器
npx playwright test --headed
```

### 2. 慢速执行

```bash
# 减慢执行速度
npx playwright test --slow-mo=500
```

### 3. 检查器

```bash
# 使用 Playwright Inspector
npx playwright test --debug
```

### 4. 查看截图和视频

测试失败时会自动保存：

- 截图：`tests/e2e/screenshots/`
- 视频：`tests/e2e/videos/`

## 持续集成

### GitHub Actions 示例

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: tests/e2e/report/
```

## 性能基准

测试包含性能验证：

| 指标 | 目标 | 测试 |
|------|------|------|
| 应用启动时间 | < 5s | ✅ |
| 角色切换时间 | < 5s | ✅ |
| 消息发送响应 | < 1s | ✅ |
| 100条消息渲染 | < 3s | ✅ |
| 动画帧率 | ≥ 30 FPS | ✅ |

## 覆盖的功能

### 核心功能
- ✅ 应用启动和初始化
- ✅ 聊天消息收发
- ✅ 历史记录管理
- ✅ 设置持久化

### 角色系统
- ✅ 角色选择和切换
- ✅ Live2D 模型渲染
- ✅ 动画和表情
- ✅ 角色配置

### 适配器系统
- ✅ 适配器市场浏览
- ✅ 安装和卸载
- ✅ 配置和管理
- ✅ 启动和停止
- ✅ 更新检查

### 用户界面
- ✅ 主题切换
- ✅ 布局调整
- ✅ 响应式设计
- ✅ 键盘快捷键

### 错误处理
- ✅ 网络错误
- ✅ 超时处理
- ✅ 数据验证
- ✅ 降级策略

## 故障排除

### 测试超时

如果测试经常超时，可以增加超时时间：

```typescript
test('长时间运行的测试', async ({ page }) => {
  test.setTimeout(120000); // 2分钟
  // ...
});
```

### 元素找不到

确保使用正确的选择器和等待：

```typescript
// 等待元素出现
await waitForElement(page, selector);

// 或使用 Playwright 的等待
await page.waitForSelector(selector, { state: 'visible' });
```

### Mock 不生效

检查 Mock 的时机：

```typescript
// ✅ 在操作之前 Mock
await mockTauriCommand(page, 'command', data);
await doSomething();

// ❌ 在操作之后 Mock
await doSomething();
await mockTauriCommand(page, 'command', data); // 太晚了
```

## 贡献指南

添加新的 E2E 测试时：

1. 在适当的测试文件中添加测试用例
2. 使用 `describe` 和 `test` 组织测试
3. 添加必要的 Mock 数据
4. 在关键步骤截图
5. 验证测试通过
6. 更新本文档

## 相关资源

- [Playwright 文档](https://playwright.dev/)
- [测试最佳实践](https://playwright.dev/docs/best-practices)
- [Tauri 测试指南](https://tauri.app/v1/guides/testing/)
- [项目测试计划](../docs/TEST_IMPLEMENTATION_PLAN.md)

## 维护者

- Zishu Team

## 更新日志

- **2025-10-20**: 创建 E2E 测试套件
  - 基础工作流测试 (35+ 用例)
  - 适配器管理测试 (40+ 用例)
  - 角色切换测试 (38+ 用例)
  - 总计 113+ 测试用例

---

**最后更新**: 2025-10-20

