# Live2D 模型系统文档

## 概述

字書老师桌面应用现在支持多个 Live2D 模型，用户可以在不同的角色之间自由切换。

## 可用模型

当前包含 7 个免费的 Live2D Cubism 模型：

| 模型 ID | 显示名称 | 性别 | 大小 | 特点 |
|---------|----------|------|------|------|
| haru | 春 (Haru) | 女性 | 4.2M | 可爱的女性角色，丰富的表情和动作 |
| hiyori | 日和 (Hiyori) | 女性 | 4.9M | 经典示例角色，完整功能 |
| mao | 真央 (Mao) | 女性 | 4.2M | 温柔的女性角色 |
| mark | 马克 (Mark) | 男性 | 716K | 帅气的男性角色 |
| natori | 名取 (Natori) | 女性 | 3.4M | 活泼的女性角色 |
| rice | 米粒 (Rice) | 中性 | 3.1M | Q版可爱角色 |
| wanko | 小狗 (Wanko) | 女性 | 792K | 可爱的犬耳角色 |

总计：约 22MB

## 架构设计

### 1. 模型管理器 (`utils/modelManager.ts`)

核心功能：
- 加载和缓存模型库配置
- 动态创建 Live2D 模型配置
- 管理当前选中的模型
- 自动解析模型的动画和表情

```typescript
import { modelManager } from '@/utils/modelManager'

// 获取所有可用模型
const models = await modelManager.getAvailableModels()

// 创建模型配置
const config = await modelManager.createModelConfig('hiyori')

// 获取/设置当前模型
const currentId = modelManager.getCurrentModelId()
modelManager.setCurrentModelId('haru')
```

### 2. 模型选择器组件 (`components/Character/ModelSelector.tsx`)

功能特性：
- 显示当前选中的模型
- 展示所有可用模型列表
- 支持模型预览图
- 动画过渡效果
- 响应式设计

```typescript
<ModelSelector
  currentModelId="hiyori"
  onModelSelect={(modelId) => console.log('切换到:', modelId)}
  className="custom-class"
/>
```

### 3. 角色组件 (`components/Character/index.tsx`)

增强功能：
- 支持动态模型切换
- 自动加载模型配置
- 加载状态显示
- 错误处理和回退
- 可选的模型选择器

```typescript
<Character
  character={character}
  onInteraction={handleInteraction}
  showModelSelector={true}  // 显示模型选择器
/>
```

## 使用指南

### 基础使用

1. **在组件中使用带模型选择器的角色组件**

```tsx
import { Character } from '@/components/Character'

function MyComponent() {
  const character = {
    id: 'zishu-sensei',
    name: '字書老师',
    avatar: '/avatar.png',
    description: 'AI 助手'
  }

  const handleInteraction = (type: string, data: any) => {
    console.log('交互事件:', type, data)
  }

  return (
    <Character
      character={character}
      onInteraction={handleInteraction}
      showModelSelector={true}
    />
  )
}
```

2. **手动控制模型切换**

```tsx
import { useState, useEffect } from 'react'
import { modelManager } from '@/utils/modelManager'
import { Live2DViewer } from '@/components/Character/Live2D/Live2DViewer'

function CustomViewer() {
  const [modelConfig, setModelConfig] = useState(null)

  const switchToModel = async (modelId: string) => {
    const config = await modelManager.createModelConfig(modelId)
    setModelConfig(config)
  }

  useEffect(() => {
    switchToModel('hiyori')
  }, [])

  return (
    <div>
      <button onClick={() => switchToModel('haru')}>切换到 Haru</button>
      <button onClick={() => switchToModel('mao')}>切换到 Mao</button>
      
      {modelConfig && (
        <Live2DViewer
          key={modelConfig.id}
          modelConfig={modelConfig}
          config={viewerConfig}
        />
      )}
    </div>
  )
}
```

### 高级用法

#### 添加自定义模型

1. 将模型文件放到 `public/live2d_models/` 目录下
2. 更新 `public/live2d_models/models.json`：

```json
{
  "models": [
    {
      "id": "my-custom-model",
      "name": "My Custom Model",
      "displayName": "我的自定义模型",
      "path": "/live2d_models/my-model/model.model3.json",
      "previewImage": "/live2d_models/my-model/preview.png",
      "description": "这是我的自定义模型",
      "gender": "female",
      "size": "5.0M",
      "features": ["expressions", "motions", "physics"]
    }
  ]
}
```

3. 清除缓存以重新加载：

```typescript
modelManager.clearCache()
```

#### 监听模型切换事件

```typescript
const handleInteraction = (type: string, data: any) => {
  if (type === 'model_changed') {
    console.log('模型已切换到:', data.modelId)
    // 执行自定义逻辑，如保存用户偏好
    localStorage.setItem('preferredModel', data.modelId)
  }
}
```

#### 自定义模型选择器样式

模型选择器使用 CSS 变量，可以通过覆盖这些变量来自定义样式：

```css
.model-selector {
  --primary-color: #your-color;
  --background-primary: #your-bg;
  --border-color: #your-border;
  --text-primary: #your-text;
}
```

## 演示页面

访问 `/live2d-demo` 查看完整的演示页面，包括：
- 实时模型切换
- 交互事件日志
- 控制选项

## 性能优化

### 模型缓存

模型配置在首次加载后会被缓存，避免重复解析：

```typescript
// 首次加载 - 从服务器获取
const config1 = await modelManager.createModelConfig('hiyori')

// 再次加载 - 从缓存获取（瞬间完成）
const config2 = await modelManager.createModelConfig('hiyori')
```

### 懒加载

模型文件只在真正需要时才加载：
- JSON 配置文件在选择模型时加载
- 纹理和动画文件在 Live2DViewer 渲染时才加载

### 内存管理

切换模型时，使用 `key` 属性强制重新挂载组件，确保旧模型资源被正确释放：

```tsx
<Live2DViewer
  key={currentModelId}  // 重要！确保模型切换时重新挂载
  modelConfig={modelConfig}
  config={viewerConfig}
/>
```

## 故障排除

### 模型加载失败

**问题**: 模型无法加载，显示错误

**解决方案**:
1. 检查模型文件是否存在于 `public/live2d_models/` 目录
2. 验证 `models.json` 中的路径是否正确
3. 确保模型文件完整（.model3.json, .moc3, 纹理等）
4. 查看浏览器控制台的详细错误信息

### 模型显示不正确

**问题**: 模型加载了但显示异常

**解决方案**:
1. 检查模型的 `metadata` 配置是否合理
2. 调整 `viewerConfig` 中的 `scale` 和 `position`
3. 确保 WebGL 正常工作（检查 WebGL 诊断）

### 切换模型卡顿

**问题**: 切换模型时有明显延迟

**解决方案**:
1. 预加载常用模型的配置
2. 优化模型文件大小（压缩纹理）
3. 使用加载状态提示用户

```typescript
const [isLoading, setIsLoading] = useState(false)

const switchModel = async (modelId: string) => {
  setIsLoading(true)
  try {
    const config = await modelManager.createModelConfig(modelId)
    setModelConfig(config)
  } finally {
    setIsLoading(false)
  }
}
```

## API 参考

### ModelManager

```typescript
class ModelManager {
  // 获取单例实例
  static getInstance(): ModelManager
  
  // 加载模型库配置
  async loadModelLibrary(): Promise<ModelLibrary>
  
  // 获取所有可用模型
  async getAvailableModels(): Promise<ModelInfo[]>
  
  // 根据 ID 获取模型信息
  async getModelInfo(modelId: string): Promise<ModelInfo | undefined>
  
  // 创建模型配置
  async createModelConfig(modelId: string): Promise<Live2DModelConfig>
  
  // 获取当前模型 ID
  getCurrentModelId(): string
  
  // 设置当前模型 ID
  setCurrentModelId(modelId: string): void
  
  // 清除缓存
  clearCache(): void
}
```

### ModelSelector Props

```typescript
interface ModelSelectorProps {
  currentModelId: string        // 当前选中的模型 ID
  onModelSelect: (modelId: string) => void  // 模型选择回调
  className?: string            // 自定义类名
}
```

### Character Props

```typescript
interface CharacterProps {
  character: Character | null   // 角色信息
  onInteraction: (type: string, data: any) => void  // 交互回调
  showModelSelector?: boolean   // 是否显示模型选择器（默认 false）
}
```

## 版权声明

所有 Live2D 模型来自 [Live2D Cubism SDK for Web](https://github.com/Live2D/CubismWebSamples) 官方示例，遵循 Live2D Proprietary Software License Agreement。

这些模型仅供学习和测试使用。如需商业使用，请访问 [Live2D 官网](https://www.live2d.com/) 了解授权信息。

## 更新日志

### v1.0.0 (2025-10-18)

- ✨ 新增模型管理器系统
- ✨ 新增模型选择器组件
- ✨ 支持动态模型切换
- ✨ 添加 7 个官方示例模型
- ✨ 创建演示页面
- 📝 完善文档

## 未来计划

- [ ] 支持用户上传自定义模型
- [ ] 模型市场/商店功能
- [ ] 模型预加载和预热
- [ ] 更多交互动画
- [ ] 语音对口型功能
- [ ] VRM 模型支持
- [ ] 模型编辑器集成

