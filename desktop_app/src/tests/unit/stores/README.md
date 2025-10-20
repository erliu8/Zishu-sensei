# Store 状态管理测试套件

这个目录包含了所有 Store 状态管理的单元测试，使用 Vitest 和 React Testing Library 进行测试。

## 📋 测试覆盖

### ✅ 已完成的测试套件

1. **`adapterStore.test.ts`** - 适配器状态管理测试
   - 适配器列表管理（添加、更新、删除）
   - 操作状态管理（安装、卸载、加载等）
   - 搜索和过滤功能
   - 缓存管理（元数据、配置、搜索结果）
   - 事件管理（历史记录、监听器）
   - 统计信息计算
   - 工具方法和错误处理
   - **测试数量**: ~150个测试用例

2. **`characterStore.test.ts`** - 角色状态管理测试
   - 角色管理（添加、更新、删除、切换）
   - 状态管理（情绪、活动状态、属性）
   - 动画控制（播放、停止、表情设置）
   - 交互管理（记录、处理交互事件）
   - Live2D 管理（模型实例、动画管理器、交互管理器）
   - 统计和分析（交互计数、在线时间、情绪历史）
   - 辅助 Hooks 测试
   - **测试数量**: ~120个测试用例

3. **`chatStore.test.ts`** - 聊天状态管理测试
   - 会话管理（创建、删除、切换、归档、复制）
   - 消息管理（发送、删除、更新、搜索）
   - 流式响应管理（开始、停止、处理数据块）
   - 统计信息（会话统计、全局统计）
   - 模板管理（添加、更新、删除、应用）
   - 建议管理（设置、获取、分类）
   - 事件系统和批量操作
   - **测试数量**: ~140个测试用例

4. **`desktopStore.test.ts`** - 桌面操作状态管理测试
   - 应用状态管理（初始化、系统信息、性能监控）
   - 操作状态管理（加载状态、错误处理、历史记录）
   - 窗口管理（位置、尺寸、状态控制）
   - 快捷键管理（添加、更新、删除、触发）
   - 文件操作管理（进度跟踪、状态更新）
   - 通知管理（添加、更新、标记已读）
   - 设置和配置管理
   - **测试数量**: ~130个测试用例

5. **`themeStore.test.ts`** - 主题状态管理测试
   - 主题模式管理（light/dark/system）
   - 系统主题检测和监听
   - CSS变量管理（更新、应用、重置）
   - 主题切换动画控制
   - 自动切换功能（时间控制）
   - 事件系统（监听器、触发、错误处理）
   - 辅助 Hooks 测试
   - **测试数量**: ~110个测试用例

### 📊 测试覆盖统计

- **总测试用例数**: ~650个
- **预估覆盖率**: 85%+
- **测试文件数**: 5个
- **代码行数**: ~3500行

## 🚀 运行测试

### 运行所有 Store 测试

```bash
# 运行所有 Store 测试
npm test tests/unit/stores

# 运行特定 Store 测试
npm test tests/unit/stores/adapterStore.test.ts

# 运行测试并生成覆盖率报告
npm test tests/unit/stores -- --coverage
```

### 监视模式

```bash
# 监视模式运行测试
npm test tests/unit/stores -- --watch

# 监视特定测试文件
npm test tests/unit/stores/chatStore.test.ts -- --watch
```

## 📋 测试特点

### 全面性
- ✅ 覆盖所有公共 API 方法
- ✅ 测试正常流程和边界情况
- ✅ 包含错误处理测试
- ✅ 测试异步操作
- ✅ 验证副作用和状态更新

### 健壮性
- ✅ 使用 Mock 隔离外部依赖
- ✅ 测试用例相互独立
- ✅ 完整的测试数据工厂
- ✅ 错误场景覆盖
- ✅ 性能测试（大量数据处理）

### 可维护性
- ✅ 清晰的测试结构和命名
- ✅ 详细的测试描述
- ✅ 模块化的测试工具函数
- ✅ 统一的 Mock 策略
- ✅ 完整的类型注释

## 🧪 测试工具

### Mock 工厂函数

每个测试文件都包含完整的 Mock 工厂函数：

```typescript
// 示例：创建测试数据
const createMockAdapter = (overrides = {}) => ({
  name: 'test-adapter',
  status: AdapterStatus.Unloaded,
  // ... 其他默认属性
  ...overrides
})
```

### 测试工具

- **Zustand Mock**: 模拟 Zustand 中间件
- **DOM Mock**: 模拟浏览器 DOM API
- **Timer Mock**: 模拟时间相关操作
- **Storage Mock**: 模拟 localStorage
- **Event Mock**: 模拟事件监听和触发

## 🔧 配置和依赖

### 测试依赖

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  }
}
```

### Mock 配置

所有 Store 测试都包含以下 Mock 配置：

```typescript
// Zustand 中间件 Mock
vi.mock('zustand/middleware', () => ({
  devtools: vi.fn((fn) => fn),
  persist: vi.fn((fn, options) => fn),
  subscribeWithSelector: vi.fn((fn) => fn),
  immer: vi.fn((fn) => fn),
}))

// 外部依赖 Mock
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-id')
}))
```

## 📝 最佳实践

### 测试结构

```typescript
describe('StoreName', () => {
  beforeEach(() => {
    // 重置 Store 状态
    act(() => {
      useStore.getState().reset()
    })
  })

  describe('功能模块', () => {
    it('应该正确处理正常情况', () => {
      // 测试实现
    })
    
    it('应该正确处理边界情况', () => {
      // 测试实现
    })
    
    it('应该正确处理错误情况', () => {
      // 测试实现
    })
  })
})
```

### 异步测试

```typescript
it('应该正确处理异步操作', async () => {
  await act(async () => {
    await store.asyncMethod()
  })
  
  expect(store.getState().result).toBe(expected)
})
```

### 错误测试

```typescript
it('应该正确处理错误', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  
  // 执行可能出错的操作
  
  expect(store.getState().error).toBeTruthy()
  expect(consoleSpy).toHaveBeenCalled()
  
  consoleSpy.mockRestore()
})
```

## 🚨 注意事项

1. **状态重置**: 每个测试前都要重置 Store 状态，避免测试间相互影响
2. **Mock 清理**: 使用 `beforeEach/afterEach` 清理 Mock 状态
3. **异步操作**: 正确使用 `act()` 包装状态更新
4. **内存泄漏**: 及时清理事件监听器和定时器
5. **类型安全**: 保持完整的 TypeScript 类型注释

## 📈 持续改进

- 定期更新测试用例以覆盖新功能
- 监控测试覆盖率，目标 85%+
- 优化测试性能，减少运行时间
- 增加集成测试覆盖 Store 间交互
- 添加 E2E 测试验证用户场景

---

**维护者**: Zishu Team  
**最后更新**: 2025-10-20  
**版本**: 1.0.0
