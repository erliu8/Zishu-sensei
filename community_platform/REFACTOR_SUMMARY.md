# 紫舒-Sensei 系统重构总结

## 概述
本次重构主要是对社区平台前端进行重大调整，将"适配器市场"改为"插件市场"，并增强角色创建功能，支持更灵活的模型配置选项。**重要：底层逻辑保持不变，只是更改了前端展示层的显示名称和用户交互界面。**

## 重构内容

### 1. 显示名称映射

#### 文件：`community_platform/frontend/src/features/adapter/utils/display-names.ts`

创建了显示名称映射工具，将底层适配器类型映射到用户友好的名称：

- **硬适配器 (HARD)** → **插件** 🔌
- **软适配器 (SOFT)** → **提示词工程** 💭
- **智能硬适配器 (INTELLIGENT)** → **微调模型** 🤖

提供了以下工具函数：
- `getAdapterTypeDisplayName()` - 获取类型显示名称
- `getAdapterTypeDescription()` - 获取类型描述
- `getAdapterTypeIcon()` - 获取类型图标
- `MARKET_DISPLAY_NAME` - 市场显示名称常量
- `MARKET_DESCRIPTION` - 市场描述常量

### 2. 类型定义扩展

#### 2.1 适配器类型 (`adapter.types.ts`)

新增字段：
```typescript
export enum DeploymentLocation {
  CLOUD = 'cloud',  // 云端部署
  LOCAL = 'local',  // 本地部署
}

export interface DeploymentConfig {
  location: DeploymentLocation;
  localPath?: string;    // 本地路径（本地部署时必填）
  cloudUrl?: string;     // 云端URL（云端部署时使用）
}

interface Adapter {
  // ... 原有字段
  deployment?: DeploymentConfig;  // 新增：部署配置
}
```

#### 2.2 Live2D模型类型 (`live2d.types.ts`)

新建文件，定义Live2D模型相关类型：
- `Live2DModel` - Live2D模型主模型
- `Live2DModelConfig` - 模型配置
- `Live2DModelCategory` - 模型分类
- `CreateLive2DModelInput` - 创建输入
- `Live2DModelQueryParams` - 查询参数

#### 2.3 Lora适配器类型 (`lora.types.ts`)

新建文件，定义Lora适配器相关类型：
- `LoraAdapter` - Lora适配器主模型
- `BaseModel` - 基础模型信息
- `LoraAdapterConfig` - Lora配置
- `CreateLoraAdapterInput` - 创建输入
- `LoraAdapterQueryParams` - 查询参数

#### 2.4 角色模型配置类型 (`model-config.types.ts`)

新建文件，定义角色模型配置相关类型：

```typescript
export enum ModelConfigType {
  FULL_MODEL = 'full_model',           // 完整微调模型
  LORA_ADAPTER = 'lora_adapter',       // Lora适配器
  PROMPT_ENGINEERING = 'prompt_engineering',  // 提示词工程
}

export type CharacterModelConfig = 
  | FullModelConfig 
  | LoraAdapterConfig 
  | PromptEngineeringConfig;

export interface CharacterFullConfig {
  aiModel: CharacterModelConfig;      // AI模型配置
  live2dModel?: Live2DModelReference; // Live2D模型
  plugins?: string[];                 // 插件列表
}
```

#### 2.5 角色类型更新 (`character.ts`)

在Character接口中新增字段：
```typescript
export interface Character {
  // ... 原有字段
  config?: CharacterFullConfig;  // 新增：角色完整配置
}
```

### 3. UI组件创建

#### 3.1 本地路径输入组件 (`LocalPathInput.tsx`)

通用组件，用于所有需要本地路径的场景：
- 实时路径格式验证
- 支持Windows和Unix路径格式
- 显示路径类型提示（文件/文件夹）
- 内置验证状态显示

#### 3.2 部署位置选择组件 (`DeploymentLocationSelect.tsx`)

用于选择云端或本地部署：
- 卡片式单选设计
- 清晰的图标和描述
- 自动显示部署位置说明

#### 3.3 插件选择组件 (`PluginSelector.tsx`)

支持云端和本地插件选择：
- **云端插件**：从插件市场选择（只显示硬适配器）
- **本地插件**：填写本地路径
- 插件列表管理（启用/禁用/删除）
- 支持搜索和筛选

主要功能：
```typescript
export interface PluginReference {
  id: string;
  name: string;
  displayName: string;
  version?: string;
  deployment: DeploymentConfig;
  enabled?: boolean;
}
```

#### 3.4 Lora适配器选择组件 (`LoraAdapterSelector.tsx`)

支持选择Lora适配器并配置基础模型：
- **云端Lora**：从云端Lora库选择
- **本地Lora**：配置本地Lora文件
- 必须选择基础模型
- 按基础模型筛选Lora

#### 3.5 Live2D模型选择组件 (`Live2DModelSelector.tsx`)

支持三种方式选择Live2D模型：
- **云端选择**：从云端Live2D模型库选择
- **上传托管**：上传模型文件到云服务器
- **本地部署**：填写本地模型路径

特点：
- 网格式模型预览
- 支持文件上传（.model3.json, .model.json, .zip）
- 显示模型预览图

#### 3.6 角色配置摘要组件 (`CharacterConfigSummary.tsx`)

展示角色的完整配置信息：
- AI模型配置（完整模型/Lora/提示词工程）
- Live2D模型信息
- 已启用插件列表
- 部署位置信息
- 支持紧凑模式和详细模式

### 4. 前端页面更新

#### 4.1 插件市场页面 (`app/[locale]/(main)/adapters/page.tsx`)

更新内容：
- 页面标题：`适配器市场` → `插件市场`
- 按钮文本：`上传适配器` → `上传插件`
- 导入并使用显示名称常量
- 页面描述更新为插件相关描述

#### 4.2 适配器徽章组件 (`AdapterBadge.tsx`)

更新类型徽章显示：
```typescript
{
  [AdapterType.HARD]: {
    label: '插件',          // 原：硬适配器
    icon: Plug,
  },
  [AdapterType.SOFT]: {
    label: '提示词工程',    // 原：软适配器
    icon: MessageSquare,
  },
  [AdapterType.INTELLIGENT]: {
    label: '微调模型',      // 原：智能硬适配器
    icon: Bot,
  },
}
```

## 技术架构

### 类型系统层次

```
Character (角色)
├── CharacterFullConfig (完整配置)
│   ├── CharacterModelConfig (AI模型配置)
│   │   ├── FullModelConfig (完整微调模型)
│   │   ├── LoraAdapterConfig (Lora适配器)
│   │   └── PromptEngineeringConfig (提示词工程)
│   ├── Live2DModelReference (Live2D模型)
│   └── plugins[] (插件列表)
│
└── adapters[] (旧版适配器列表，保持兼容)
```

### 组件依赖关系

```
CharacterCreator (角色创建器)
├── PluginSelector (插件选择)
│   ├── DeploymentLocationSelect
│   └── LocalPathInput
├── LoraAdapterSelector (Lora选择)
│   ├── DeploymentLocationSelect
│   └── LocalPathInput
└── Live2DModelSelector (Live2D选择)
    └── LocalPathInput

CharacterConfigSummary (配置摘要)
└── 用于显示角色的完整配置信息
```

## 文件清单

### 新建文件

**类型定义：**
1. `/community_platform/frontend/src/features/adapter/utils/display-names.ts` - 显示名称映射
2. `/community_platform/frontend/src/features/adapter/domain/live2d.types.ts` - Live2D类型
3. `/community_platform/frontend/src/features/adapter/domain/lora.types.ts` - Lora类型
4. `/community_platform/frontend/src/features/character/domain/model-config.types.ts` - 模型配置类型

**UI组件：**
5. `/community_platform/frontend/src/shared/components/common/LocalPathInput.tsx` - 本地路径输入
6. `/community_platform/frontend/src/shared/components/common/DeploymentLocationSelect.tsx` - 部署位置选择
7. `/community_platform/frontend/src/features/adapter/components/PluginSelector.tsx` - 插件选择器
8. `/community_platform/frontend/src/features/adapter/components/LoraAdapterSelector.tsx` - Lora选择器
9. `/community_platform/frontend/src/features/adapter/components/Live2DModelSelector.tsx` - Live2D选择器
10. `/community_platform/frontend/src/features/character/components/CharacterConfigSummary.tsx` - 配置摘要

**文档：**
11. `/community_platform/REFACTOR_SUMMARY.md` - 本文档

### 修改的文件

1. `/community_platform/frontend/src/features/adapter/domain/adapter.types.ts`
   - 新增 `DeploymentLocation` 枚举
   - 新增 `DeploymentConfig` 接口
   - `Adapter` 接口新增 `deployment` 字段

2. `/community_platform/frontend/src/features/adapter/domain/index.ts`
   - 导出 `live2d.types` 和 `lora.types`

3. `/community_platform/frontend/src/features/character/domain/character.ts`
   - `Character` 接口新增 `config` 字段
   - `CreateCharacterInput` 新增 `config` 字段
   - `UpdateCharacterInput` 新增 `config` 字段

4. `/community_platform/frontend/src/features/character/domain/index.ts`
   - 导出 `model-config.types`

5. `/community_platform/frontend/src/shared/components/common/index.ts`
   - 导出 `LocalPathInput` 和 `DeploymentLocationSelect`

6. `/community_platform/frontend/src/features/adapter/components/index.ts`
   - 导出新的选择器组件

7. `/community_platform/frontend/app/[locale]/(main)/adapters/page.tsx`
   - 更新页面标题和描述
   - 更新按钮文本
   - 导入显示名称常量

8. `/community_platform/frontend/src/features/adapter/components/marketplace/AdapterBadge.tsx`
   - 更新类型徽章的显示名称和图标

## 使用示例

### 1. 使用新的显示名称

```typescript
import { 
  getAdapterTypeDisplayName, 
  MARKET_DISPLAY_NAME 
} from '@/features/adapter/utils/display-names';

// 在UI中显示
<h1>{MARKET_DISPLAY_NAME}</h1>  // 显示：插件市场

// 获取类型显示名称
const typeName = getAdapterTypeDisplayName(AdapterType.HARD);  // 返回：插件
```

### 2. 使用插件选择器

```typescript
import { PluginSelector } from '@/features/adapter/components';

<PluginSelector
  selectedPlugins={plugins}
  onChange={setPlugins}
  maxPlugins={10}
  availableCloudPlugins={cloudPlugins}
/>
```

### 3. 使用Lora适配器选择器

```typescript
import { LoraAdapterSelector } from '@/features/adapter/components';

<LoraAdapterSelector
  value={loraConfig}
  onChange={setLoraConfig}
  availableBaseModels={baseModels}
  availableLoraAdapters={loraAdapters}
/>
```

### 4. 使用Live2D模型选择器

```typescript
import { Live2DModelSelector } from '@/features/adapter/components';

<Live2DModelSelector
  value={live2dConfig}
  onChange={setLive2dConfig}
  availableModels={models}
/>
```

### 5. 显示角色配置摘要

```typescript
import { CharacterConfigSummary } from '@/features/character/components';

<CharacterConfigSummary
  config={character.config}
  compact={false}
/>
```

## 后续工作建议

### 必需工作

1. **更新角色创建组件**（CharacterCreator）
   - 添加AI模型配置步骤（选择完整模型/Lora/提示词工程）
   - 集成Live2D模型选择
   - 集成插件选择
   - 更新表单验证逻辑

2. **更新角色详情页面**
   - 使用 `CharacterConfigSummary` 组件展示配置
   - 显示部署位置信息

4. **后端API适配**
   - 创建或更新Character时处理新的`config`字段
   - 验证本地路径格式
   - 处理文件上传（Live2D模型、Lora文件）
   - 更新数据库schema

### 可选增强

1. **搜索和筛选增强**
   - 在插件市场添加部署位置筛选
   - 按模型配置类型筛选角色
   - 按Live2D模型筛选角色

2. **验证和测试**
   - 添加本地路径可达性验证（桌面应用端）
   - 文件上传进度显示
   - 配置兼容性检查

3. **用户体验优化**
   - 添加配置向导（引导用户完成配置）
   - 提供配置模板（预设常用配置）
   - 配置导入导出功能

4. **文档和帮助**
   - 为每种配置类型提供详细说明
   - 添加最佳实践指南
   - 创建常见问题解答

## 兼容性说明

- **向后兼容**：旧的`adapters`字段保留，新功能使用`config`字段
- **渐进式迁移**：可以同时支持旧版和新版配置
- **数据迁移**：建议提供迁移工具将旧版配置转换为新版

## 注意事项

1. **本地路径验证**：前端只做格式验证，实际可达性需要桌面应用验证
2. **文件上传**：需要配置文件大小限制和类型检查
3. **部署位置**：本地部署的资源不会上传到服务器，确保用户理解
4. **Lora基础模型**：确保Lora适配器与基础模型兼容
5. **插件兼容性**：需要机制确保插件与角色模型兼容

## 总结

本次重构成功地将"适配器"概念细化为更具体的"插件"、"提示词工程"和"微调模型"，并为角色系统增加了灵活的模型配置选项。通过支持本地和云端两种部署方式，既满足了云端分享的需求，也支持了本地部署的使用场景。

整个重构遵循了渐进式增强的原则，保持了与旧系统的兼容性，同时为未来的功能扩展留下了空间。

---

**文档版本**：1.0  
**更新日期**：2025-10-31  


