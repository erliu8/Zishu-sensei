# 设置组件文档

## 概述

设置组件提供了完整的应用配置管理界面，包括窗口、角色、主题和系统等各个方面的设置。

## 组件结构

```
Settings/
├── index.tsx                 # 主入口组件
├── GeneralSettings/          # 通用设置子组件
│   └── index.tsx
└── README.md                 # 本文档
```

## 主要功能

### 1. Settings (主入口组件)

**功能特性：**
- 🎨 响应式侧边栏导航
- 📱 多标签页管理（通用、角色、主题、系统、高级）
- ⚡ 实时设置同步和验证
- 💾 自动保存和手动保存
- 🔄 配置导入导出
- 🛡️ 错误处理和恢复
- ♿ 无障碍支持
- 🎭 流畅的动画过渡

**基本用法：**

```tsx
import { Settings } from '@/components/Settings'

function App() {
  return (
    <Settings
      initialTab="general"
      onClose={() => console.log('关闭设置')}
      onReset={() => console.log('重置设置')}
      showHeader={true}
      showSidebar={true}
    />
  )
}
```

**Props：**

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `initialTab` | `SettingsTab` | `'general'` | 初始显示的标签页 |
| `onClose` | `() => void` | - | 关闭回调函数 |
| `onReset` | `() => void` | - | 重置回调函数 |
| `showHeader` | `boolean` | `true` | 是否显示头部 |
| `showSidebar` | `boolean` | `true` | 是否显示侧边栏 |
| `className` | `string` | - | 自定义样式类名 |

**标签页类型：**

```typescript
type SettingsTab = 'general' | 'character' | 'theme' | 'system' | 'advanced'
```

### 2. GeneralSettings (通用设置组件)

**功能特性：**
- 🪟 窗口配置（大小、位置、显示选项）
- 🎨 主题配置（主题选择、自定义CSS）
- 💻 系统配置（自动启动、托盘、通知）
- 🎭 角色配置（当前角色、缩放、交互）
- ✅ 实时验证和错误提示
- 🔄 自动保存和手动保存
- 📊 设置预览

**基本用法：**

```tsx
import { GeneralSettings } from '@/components/Settings/GeneralSettings'

function MySettings() {
  const { config, updateConfig } = useSettings()
  
  return (
    <GeneralSettings
      config={config}
      onConfigChange={updateConfig}
    />
  )
}
```

**Props：**

| 属性 | 类型 | 描述 |
|------|------|------|
| `config` | `AppConfig` | 当前配置对象 |
| `onConfigChange` | `(config: AppConfig) => void` | 配置变更回调 |
| `className` | `string` | 自定义样式类名 |

### 3. 内置表单组件

GeneralSettings 组件内置了以下表单控件：

#### Switch (开关组件)

```tsx
<Switch
  checked={value}
  onChange={(checked) => handleChange(checked)}
  disabled={false}
  id="switch-id"
/>
```

#### Select (选择器组件)

```tsx
<Select
  value={currentValue}
  onChange={(value) => handleChange(value)}
  options={[
    { value: 'option1', label: '选项1' },
    { value: 'option2', label: '选项2' },
  ]}
  disabled={false}
  id="select-id"
/>
```

#### NumberInput (数字输入组件)

```tsx
<NumberInput
  value={number}
  onChange={(value) => handleChange(value)}
  min={0}
  max={100}
  step={1}
  disabled={false}
  id="number-id"
/>
```

#### Slider (滑块组件)

```tsx
<Slider
  value={number}
  onChange={(value) => handleChange(value)}
  min={0}
  max={100}
  step={0.1}
  showValue={true}
  disabled={false}
  id="slider-id"
/>
```

## 配置项说明

### 窗口配置 (WindowConfig)

- **width**: 窗口宽度 (200-4000px)
- **height**: 窗口高度 (200-4000px)
- **always_on_top**: 窗口置顶
- **transparent**: 窗口透明
- **decorations**: 显示窗口装饰（标题栏等）
- **resizable**: 允许调整大小
- **position**: 窗口位置 [x, y]

### 角色配置 (CharacterConfig)

- **current_character**: 当前角色ID
- **scale**: 角色缩放比例 (0.1-5.0)
- **auto_idle**: 自动待机
- **interaction_enabled**: 启用交互

### 主题配置 (ThemeConfig)

- **current_theme**: 当前主题 (anime, modern, classic, dark, light, custom)
- **custom_css**: 自定义CSS（最多10000字符）

### 系统配置 (SystemConfig)

- **auto_start**: 开机自启动
- **minimize_to_tray**: 最小化到托盘
- **close_to_tray**: 关闭到托盘
- **show_notifications**: 显示通知

## 数据流

```
用户操作 → 组件状态更新 → 配置验证 → 触发回调 → Zustand Store → Tauri后端 → 持久化存储
```

## 验证机制

所有配置更改都会经过以下验证步骤：

1. **类型验证**: 确保数据类型正确
2. **范围验证**: 检查数值是否在有效范围内
3. **格式验证**: 验证特定格式（如角色ID、主题名称等）
4. **业务规则验证**: 检查配置的逻辑一致性

验证失败时会：
- 显示错误提示（Toast）
- 在界面上标记错误位置
- 阻止无效配置保存

## 错误处理

组件内置了完善的错误处理机制：

1. **加载错误**: 显示友好的错误页面，提供重新加载选项
2. **验证错误**: 实时显示验证错误信息
3. **保存错误**: 显示保存失败原因，保留用户输入
4. **网络错误**: 自动重试，提供离线提示

## 性能优化

- ✅ 使用 `useMemo` 缓存计算结果
- ✅ 使用 `useCallback` 避免不必要的重渲染
- ✅ 延迟加载子组件（Lazy Loading）
- ✅ 虚拟化长列表（如果需要）
- ✅ 防抖/节流处理频繁操作

## 无障碍支持

- ✅ 完整的键盘导航支持
- ✅ ARIA 标签和角色
- ✅ 焦点管理
- ✅ 屏幕阅读器优化
- ✅ 高对比度模式支持

## 样式定制

组件使用 Tailwind CSS，支持以下定制方式：

1. **通过 className prop**: 传入自定义类名
2. **通过主题变量**: 修改 CSS 变量
3. **通过自定义 CSS**: 在主题设置中添加自定义样式

```css
/* 示例：自定义主色调 */
:root {
  --color-primary-500: #your-color;
}
```

## 集成指南

### 在 App.tsx 中使用

```tsx
import { Settings } from '@/components/Settings'

function App() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div>
      {/* 其他内容 */}
      
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
```

### 作为路由页面使用

```tsx
import { Route } from 'react-router-dom'
import { Settings } from '@/components/Settings'

function AppRoutes() {
  return (
    <>
      <Route path="/settings" element={<Settings />} />
    </>
  )
}
```

### 作为模态框使用

```tsx
import { Modal } from '@/components/common/Modal'
import { Settings } from '@/components/Settings'

function SettingsModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <Settings
        onClose={onClose}
        showHeader={true}
        showSidebar={true}
      />
    </Modal>
  )
}
```

## 测试

```bash
# 运行单元测试
npm test Settings

# 运行集成测试
npm run test:e2e Settings

# 检查类型
npm run type-check
```

## 开发计划

- [ ] 角色设置子组件
- [ ] 主题设置子组件
- [ ] 系统设置子组件
- [ ] 高级设置子组件
- [ ] 搜索功能
- [ ] 快捷键支持
- [ ] 设置对比功能
- [ ] 历史记录/撤销功能

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证。

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 加入讨论组

---

最后更新：2025-10-14

