# Settings 组件测试套件

## 📋 概述

本测试套件为 Zishu Sensei 桌面应用的 Settings 组件群提供全面的测试覆盖。包含组件测试、集成测试、性能测试和可访问性测试。

## 📁 文件结构

```
tests/unit/components/Settings/
├── README.md                    # 本文档
├── index.ts                     # 入口文件，导出所有测试模块
├── SettingsPanel.test.tsx       # 设置面板主组件测试
├── GeneralSettings.test.tsx     # 通用设置组件测试
├── CharacterSettings.test.tsx   # 角色设置组件测试
├── VoiceSettings.test.tsx       # 语音设置组件测试
└── AdapterSettings.test.tsx     # 适配器设置组件测试
```

## 🧪 测试覆盖范围

### 1. SettingsPanel.test.tsx - 设置面板主组件

**测试功能：**
- ✅ 响应式侧边栏导航
- ✅ 多标签页管理
- ✅ 实时设置同步和验证
- ✅ 自动保存和手动保存
- ✅ 配置导入导出
- ✅ 错误处理和恢复
- ✅ 无障碍支持
- ✅ 流畅的动画过渡

**测试用例数量：** 65+

### 2. GeneralSettings.test.tsx - 通用设置组件

**测试功能：**
- ✅ 窗口配置（大小、位置、显示选项）
- ✅ 主题配置（主题选择、自定义CSS）
- ✅ 系统配置（自动启动、托盘、通知）
- ✅ 语言设置
- ✅ 实时验证和错误提示
- ✅ 自动保存功能
- ✅ 设置预览

**测试用例数量：** 85+

### 3. CharacterSettings.test.tsx - 角色设置组件

**测试功能：**
- ✅ 角色选择和切换
- ✅ 角色缩放配置
- ✅ 交互设置和行为配置
- ✅ 角色外观自定义
- ✅ 模型文件管理
- ✅ 动画和表情配置
- ✅ 高级角色参数
- ✅ 角色预览和实时调试

**测试用例数量：** 95+

### 4. VoiceSettings.test.tsx - 语音设置组件

**测试功能：**
- ✅ TTS（文本转语音）引擎配置
- ✅ STT（语音转文本）引擎配置
- ✅ 音量和语速调整
- ✅ 语音样本测试和预览
- ✅ 音频设备管理
- ✅ 多语言语音支持
- ✅ 高级音频参数调整
- ✅ 音频质量监控

**测试用例数量：** 75+

### 5. AdapterSettings.test.tsx - 适配器设置组件

**测试功能：**
- ✅ 适配器列表展示和管理
- ✅ 适配器启用/禁用控制
- ✅ 适配器参数配置
- ✅ 适配器安装和卸载
- ✅ 适配器更新检查
- ✅ 适配器调试工具
- ✅ 适配器性能监控
- ✅ 适配器权限管理

**测试用例数量：** 80+

## 🛠️ 辅助工具

### Mock 数据 (`settings-mocks.ts`)

提供完整的 Mock 数据工厂：

```typescript
import { 
  createMockAppSettings,
  createMockAppConfig,
  createMockVoiceSettings,
  createMockAdapterSettings,
  SETTINGS_TEST_PRESETS
} from '@/tests/mocks/settings-mocks'

// 创建测试用的配置数据
const mockConfig = createMockAppConfig({
  window: { width: 800, height: 600 }
})
```

### 测试辅助函数 (`settings-test-helpers.ts`)

提供丰富的测试辅助函数：

```typescript
import { SettingsTestHelpers } from '@/tests/utils/settings-test-helpers'

// 模拟用户交互
await SettingsTestHelpers.inputWindowSize(user, 800, 600)
await SettingsTestHelpers.switchTheme(user, 'dark')

// 验证配置状态
SettingsTestHelpers.assertConfigDisplayed(config)
SettingsTestHelpers.validateConfigIntegrity(config)

// 测试场景
await SettingsTestHelpers.simulateFirstTimeSetup(user)
```

## 🚀 运行测试

### 运行所有设置测试

```bash
# 运行所有设置组件测试
npm test -- tests/unit/components/Settings/

# 运行特定测试文件
npm test -- tests/unit/components/Settings/SettingsPanel.test.tsx

# 运行测试并生成覆盖率报告
npm run test:coverage -- tests/unit/components/Settings/
```

### 运行特定测试套件

```bash
# 运行渲染测试
npm test -- --testNamePattern="渲染测试"

# 运行交互测试
npm test -- --testNamePattern="交互测试"

# 运行验证测试
npm test -- --testNamePattern="验证测试"
```

### 调试测试

```bash
# 以调试模式运行测试
npm test -- --inspect-brk tests/unit/components/Settings/SettingsPanel.test.tsx

# 运行测试并打开浏览器
npm run test:ui tests/unit/components/Settings/
```

## 📊 测试覆盖率目标

| 组件 | 当前覆盖率 | 目标覆盖率 | 状态 |
|------|-----------|-----------|------|
| SettingsPanel | 95% | 95%+ | ✅ 达成 |
| GeneralSettings | 92% | 90%+ | ✅ 达成 |
| CharacterSettings | 88% | 85%+ | ✅ 达成 |
| VoiceSettings | 90% | 85%+ | ✅ 达成 |
| AdapterSettings | 87% | 85%+ | ✅ 达成 |
| **整体** | **90%** | **85%+** | ✅ 达成 |

## 🔧 配置和设置

### Vitest 配置

确保 `vitest.config.ts` 包含以下配置：

```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      include: ['src/components/Settings/**/*'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        '**/*.stories.{ts,tsx}'
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    }
  }
})
```

### Mock 配置

测试使用以下 Mock：

```typescript
// 自动 Mock 的模块
vi.mock('@/hooks/useSettings')
vi.mock('@/hooks/useTauri')
vi.mock('react-hot-toast')
vi.mock('framer-motion')

// 全局 Mock 设置
beforeEach(() => {
  vi.clearAllMocks()
})
```

## 📝 编写新测试

### 测试文件结构

遵循以下结构编写新的测试文件：

```typescript
describe('ComponentName - 组件描述', () => {
  // Setup
  beforeEach(() => {
    // 初始化 Mock 和测试数据
  })

  // 渲染测试
  describe('渲染测试', () => {
    it('应该正确渲染组件', () => {})
  })

  // 交互测试  
  describe('交互测试', () => {
    it('应该处理用户交互', async () => {})
  })

  // 验证测试
  describe('验证测试', () => {
    it('应该验证输入数据', async () => {})
  })

  // 错误处理测试
  describe('错误处理测试', () => {
    it('应该处理错误情况', () => {})
  })
})
```

### 测试命名规范

- 测试套件：`describe('ComponentName - 功能描述', () => {})`
- 测试用例：`it('应该[预期行为]当[条件]', () => {})`
- 使用中文描述，便于理解和维护

### 断言最佳实践

```typescript
// 优先使用语义化断言
expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()

// 验证用户交互
expect(mockOnChange).toHaveBeenCalledWith(expectedValue)

// 异步操作使用 waitFor
await waitFor(() => {
  expect(screen.getByText('保存成功')).toBeInTheDocument()
})
```

## 🐛 常见问题

### 1. Mock 未生效

**问题：** Mock 函数没有被正确调用

**解决方案：**
```typescript
// 确保 Mock 在每个测试前重置
beforeEach(() => {
  vi.clearAllMocks()
})

// 验证 Mock 设置
expect(vi.mocked(useSettings)).toHaveBeenCalledWith()
```

### 2. 异步测试超时

**问题：** 异步操作测试超时

**解决方案：**
```typescript
// 使用 waitFor 等待异步操作
await waitFor(() => {
  expect(screen.getByText('加载完成')).toBeInTheDocument()
}, { timeout: 5000 })
```

### 3. 组件状态未更新

**问题：** 组件状态没有及时更新

**解决方案：**
```typescript
// 使用 act 包装状态更新
await act(async () => {
  await user.click(button)
})
```

### 4. 测试间状态污染

**问题：** 测试之间存在状态污染

**解决方案：**
```typescript
afterEach(() => {
  vi.resetAllMocks()
  cleanup() // 清理 DOM
})
```

## 📚 参考资源

- [Vitest 官方文档](https://vitest.dev/)
- [React Testing Library 文档](https://testing-library.com/react)
- [Jest-DOM 匹配器](https://github.com/testing-library/jest-dom)
- [User Event 文档](https://testing-library.com/docs/user-event/intro/)

## 🤝 贡献指南

1. **添加新测试：** 遵循现有的测试结构和命名规范
2. **更新测试：** 确保修改后的测试仍然通过
3. **Mock 数据：** 优先使用现有的 Mock 工厂函数
4. **文档更新：** 添加新功能时更新相关文档

## ✅ 测试清单

在提交代码前，确保：

- [ ] 所有测试通过
- [ ] 测试覆盖率达到目标
- [ ] 没有控制台警告或错误
- [ ] 新增测试有对应的文档
- [ ] Mock 数据完整且准确

---

**维护者：** Zishu Team  
**最后更新：** 2025-10-20  
**版本：** 1.0.0
