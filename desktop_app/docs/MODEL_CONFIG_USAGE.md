# 聊天模型配置持久化 - 使用指南

> 版本：v1.0.0  
> 更新日期：2025-10-18  
> 状态：✅ 已完成

---

## 📋 概述

聊天模型配置持久化功能提供了完整的模型配置管理系统，支持配置的创建、读取、更新、删除（CRUD），以及历史记录追踪、导入导出等高级功能。

---

## 🎯 功能特性

### 核心功能
- ✅ **配置管理**：完整的 CRUD 操作
- ✅ **配置验证**：参数范围检查和警告提示
- ✅ **历史记录**：操作历史追踪
- ✅ **导入导出**：JSON 格式配置交换
- ✅ **默认配置**：快速访问常用配置
- ✅ **搜索过滤**：按模型、适配器查询

### 技术特性
- 🗄️ **数据持久化**：SQLite 数据库存储
- 🔒 **数据完整性**：外键约束和事务支持
- 📊 **历史追踪**：完整的变更记录
- ⚡ **高性能**：索引优化查询
- 🧪 **测试覆盖**：完整的单元测试

---

## 🏗️ 架构设计

### 数据库层
```
src-tauri/src/database/model_config.rs
├── ModelConfigData           # 配置数据结构
├── ModelConfigHistory        # 历史记录结构
├── ValidationResult          # 验证结果
└── ModelConfigRegistry       # 配置管理器
```

### 命令层
```
src-tauri/src/commands/model_config.rs
├── save_model_config         # 保存配置
├── get_model_config          # 获取配置
├── delete_model_config       # 删除配置
├── get_all_model_configs     # 获取所有配置
├── get_default_model_config  # 获取默认配置
├── set_default_model_config  # 设置默认配置
├── validate_model_config     # 验证配置
├── get_config_history        # 获取历史记录
├── export_model_config       # 导出配置
└── import_model_config       # 导入配置
```

### 前端服务层
```
src/services/modelConfigService.ts
└── ModelConfigService        # 前端服务类
```

### 类型定义
```
src/types/modelConfig.ts
├── ModelConfigData           # TypeScript 类型
├── ModelConfigHistory        # 历史记录类型
├── ValidationResult          # 验证结果类型
└── Helper Functions          # 辅助函数
```

---

## 💻 使用示例

### 后端（Rust）

#### 1. 创建和保存配置

```rust
use crate::database::model_config::ModelConfigData;

// 创建新配置
let config = ModelConfigData {
    id: "my_config_001".to_string(),
    name: "GPT-4 高创造性配置".to_string(),
    model_id: "gpt-4".to_string(),
    adapter_id: Some("openai".to_string()),
    temperature: 1.0,
    top_p: 0.95,
    top_k: None,
    max_tokens: 4096,
    frequency_penalty: 0.3,
    presence_penalty: 0.3,
    stop_sequences: vec![],
    is_default: false,
    is_enabled: true,
    description: Some("适合创意写作".to_string()),
    extra_config: None,
    created_at: chrono::Utc::now().timestamp(),
    updated_at: chrono::Utc::now().timestamp(),
};

// 保存到数据库
let db = get_database().unwrap();
db.model_config_registry.save_config(config)?;
```

#### 2. 获取和使用配置

```rust
// 获取默认配置
let default_config = db.model_config_registry.get_default_config()?;

// 获取特定配置
let config = db.model_config_registry.get_config("my_config_001")?;

// 获取所有配置
let all_configs = db.model_config_registry.get_all_configs()?;

// 按模型ID查询
let gpt4_configs = db.model_config_registry.get_configs_by_model("gpt-4")?;
```

#### 3. 验证配置

```rust
let validation = db.model_config_registry.validate_config(&config);

if !validation.is_valid {
    for error in &validation.errors {
        println!("错误: {}", error);
    }
}

for warning in &validation.warnings {
    println!("警告: {}", warning);
}
```

#### 4. 导出和导入

```rust
// 导出单个配置
let json_data = db.model_config_registry.export_config("my_config_001")?;
std::fs::write("config.json", json_data)?;

// 导出所有配置
let all_json = db.model_config_registry.export_all_configs()?;
std::fs::write("all_configs.json", all_json)?;

// 导入配置
let json_data = std::fs::read_to_string("config.json")?;
let imported = db.model_config_registry.import_config(&json_data)?;
```

### 前端（TypeScript/React）

#### 1. 保存配置

```typescript
import ModelConfigService from '@/services/modelConfigService';
import { ModelConfigData } from '@/types/modelConfig';

// 创建配置
const config: ModelConfigData = {
  id: 'my_config_001',
  name: 'GPT-4 高创造性配置',
  model_id: 'gpt-4',
  adapter_id: 'openai',
  temperature: 1.0,
  top_p: 0.95,
  max_tokens: 4096,
  frequency_penalty: 0.3,
  presence_penalty: 0.3,
  stop_sequences: [],
  is_default: false,
  is_enabled: true,
  description: '适合创意写作',
  created_at: Math.floor(Date.now() / 1000),
  updated_at: Math.floor(Date.now() / 1000),
};

// 保存
try {
  const result = await ModelConfigService.saveConfig(config);
  console.log('配置已保存:', result);
} catch (error) {
  console.error('保存失败:', error);
}
```

#### 2. 获取和显示配置

```typescript
// 获取所有配置
const { configs, total } = await ModelConfigService.getAllConfigs();

// 获取默认配置
const defaultConfig = await ModelConfigService.getDefaultConfig();

// 获取特定配置
const config = await ModelConfigService.getConfig('my_config_001');

// 在 React 组件中使用
function ConfigList() {
  const [configs, setConfigs] = useState<ModelConfigData[]>([]);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    const result = await ModelConfigService.getAllConfigs();
    setConfigs(result.configs);
  };

  return (
    <div>
      {configs.map(config => (
        <div key={config.id}>
          <h3>{config.name}</h3>
          <p>模型: {config.model_id}</p>
          <p>温度: {config.temperature}</p>
          {config.is_default && <span>默认</span>}
        </div>
      ))}
    </div>
  );
}
```

#### 3. 配置验证

```typescript
import { validateModelConfig } from '@/types/modelConfig';

const validation = validateModelConfig(config);

if (!validation.valid) {
  validation.errors.forEach(error => {
    console.error('错误:', error);
  });
}

validation.warnings.forEach(warning => {
  console.warn('警告:', warning);
});
```

#### 4. 导入导出

```typescript
// 导出配置到文件
await ModelConfigService.exportConfigToFile('my_config_001', 'my-config.json');

// 导出所有配置
await ModelConfigService.exportConfigToFile(undefined, 'all-configs.json');

// 从文件导入
const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    const result = await ModelConfigService.importConfigFromFile(file, true);
    console.log('导入成功:', result.imported_ids);
  }
};
```

#### 5. 配置历史

```typescript
// 获取配置历史
const { history, total } = await ModelConfigService.getConfigHistory('my_config_001', 10);

history.forEach(record => {
  console.log(`${record.action} at ${new Date(record.created_at * 1000)}`);
  if (record.old_data) {
    console.log('旧数据:', JSON.parse(record.old_data));
  }
  if (record.new_data) {
    console.log('新数据:', JSON.parse(record.new_data));
  }
});
```

#### 6. 高级功能

```typescript
// 复制配置
const result = await ModelConfigService.copyConfig(
  'my_config_001',
  'GPT-4 高创造性配置 (副本)'
);

// 搜索配置
const gpt4Configs = await ModelConfigService.searchByModelId('gpt-4');
const openaiConfigs = await ModelConfigService.searchByAdapterId('openai');

// 获取启用的配置
const enabledConfigs = await ModelConfigService.getEnabledConfigs();

// 设置默认配置
await ModelConfigService.setDefaultConfig('my_config_001');

// 删除配置
await ModelConfigService.deleteConfig('my_config_001');
```

---

## 📊 数据库结构

### model_configs 表

| 字段                | 类型    | 说明                    |
|-------------------|-------|----------------------|
| id                | TEXT  | 配置ID（主键）           |
| name              | TEXT  | 配置名称                |
| model_id          | TEXT  | 模型ID                 |
| adapter_id        | TEXT  | 适配器ID（可选）         |
| temperature       | REAL  | 温度参数 (0.0-2.0)     |
| top_p             | REAL  | Top-P参数 (0.0-1.0)    |
| top_k             | INT   | Top-K参数（可选）       |
| max_tokens        | INT   | 最大token数            |
| frequency_penalty | REAL  | 频率惩罚 (-2.0-2.0)    |
| presence_penalty  | REAL  | 存在惩罚 (-2.0-2.0)    |
| stop_sequences    | TEXT  | 停止序列（JSON数组）     |
| is_default        | INT   | 是否默认配置 (0/1)      |
| is_enabled        | INT   | 是否启用 (0/1)         |
| description       | TEXT  | 配置描述（可选）        |
| extra_config      | TEXT  | 额外配置（JSON，可选）   |
| created_at        | INT   | 创建时间（Unix时间戳）   |
| updated_at        | INT   | 更新时间（Unix时间戳）   |

### model_config_history 表

| 字段        | 类型    | 说明                         |
|-----------|-------|----------------------------|
| id        | INT   | 历史记录ID（自增主键）          |
| config_id | TEXT  | 配置ID（外键）                |
| action    | TEXT  | 操作类型（created/updated/deleted） |
| old_data  | TEXT  | 变更前数据（JSON，可选）        |
| new_data  | TEXT  | 变更后数据（JSON，可选）        |
| reason    | TEXT  | 变更原因（可选）               |
| created_at | INT   | 创建时间（Unix时间戳）         |

---

## 🔧 配置参数说明

### 基本参数

- **temperature** (0.0 - 2.0)
  - 控制输出的随机性
  - 0.0：确定性输出
  - 1.0：平衡随机性
  - 2.0：高度随机

- **top_p** (0.0 - 1.0)
  - 核采样参数
  - 控制候选词的概率质量
  - 推荐值：0.9

- **max_tokens**
  - 最大生成token数
  - 影响响应长度和成本

- **frequency_penalty** (-2.0 - 2.0)
  - 频率惩罚
  - 正值降低重复词汇
  - 负值增加重复

- **presence_penalty** (-2.0 - 2.0)
  - 存在惩罚
  - 正值鼓励新话题
  - 负值聚焦当前话题

### 预设配置

#### 1. 默认配置
```json
{
  "name": "默认配置",
  "model_id": "gpt-3.5-turbo",
  "temperature": 0.7,
  "top_p": 0.9,
  "max_tokens": 2048
}
```

#### 2. 创造性配置
```json
{
  "name": "创造性配置",
  "model_id": "gpt-4",
  "temperature": 1.2,
  "top_p": 0.95,
  "max_tokens": 4096,
  "frequency_penalty": 0.5,
  "presence_penalty": 0.5
}
```

#### 3. 精确性配置
```json
{
  "name": "精确性配置",
  "model_id": "gpt-4",
  "temperature": 0.3,
  "top_p": 0.8,
  "max_tokens": 2048
}
```

---

## 🎨 前端组件示例

### 配置编辑器

```typescript
import React, { useState } from 'react';
import { ModelConfigData } from '@/types/modelConfig';
import ModelConfigService from '@/services/modelConfigService';

interface ConfigEditorProps {
  config?: ModelConfigData;
  onSave: (config: ModelConfigData) => void;
}

export function ConfigEditor({ config, onSave }: ConfigEditorProps) {
  const [formData, setFormData] = useState<Partial<ModelConfigData>>(
    config || {
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 2048,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newConfig: ModelConfigData = {
      id: formData.id || `config_${Date.now()}`,
      name: formData.name!,
      model_id: formData.model_id!,
      adapter_id: formData.adapter_id,
      temperature: formData.temperature!,
      top_p: formData.top_p!,
      max_tokens: formData.max_tokens!,
      frequency_penalty: formData.frequency_penalty!,
      presence_penalty: formData.presence_penalty!,
      stop_sequences: formData.stop_sequences || [],
      is_default: formData.is_default || false,
      is_enabled: formData.is_enabled || true,
      description: formData.description,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    };

    await ModelConfigService.saveConfig(newConfig);
    onSave(newConfig);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="配置名称"
        value={formData.name || ''}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      
      <input
        type="text"
        placeholder="模型 ID"
        value={formData.model_id || ''}
        onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
        required
      />
      
      <label>
        温度: {formData.temperature}
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={formData.temperature || 0.7}
          onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
        />
      </label>
      
      <label>
        Top-P: {formData.top_p}
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={formData.top_p || 0.9}
          onChange={(e) => setFormData({ ...formData, top_p: parseFloat(e.target.value) })}
        />
      </label>
      
      <input
        type="number"
        placeholder="最大 Tokens"
        value={formData.max_tokens || 2048}
        onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
        required
      />
      
      <button type="submit">保存配置</button>
    </form>
  );
}
```

---

## ⚠️ 注意事项

1. **配置 ID 唯一性**：确保每个配置的 ID 唯一
2. **参数范围**：遵守参数的有效范围
3. **默认配置**：系统只能有一个默认配置
4. **历史记录**：建议定期清理旧的历史记录
5. **导入验证**：导入配置前进行验证
6. **备份重要配置**：定期导出重要配置

---

## 🚀 最佳实践

1. **命名规范**：使用描述性的配置名称
2. **参数调优**：根据实际使用场景调整参数
3. **版本管理**：利用历史记录追踪配置变更
4. **配置复用**：通过复制功能创建变体
5. **定期备份**：导出重要配置到文件

---

## 📚 相关文档

- [IMPROVEMENT_TODO.md](./IMPROVEMENT_TODO.md) - 项目待完善清单
- [DATABASE.md](./DATABASE.md) - 数据库设计文档
- [API.md](./API.md) - API 接口文档

---

**文档维护者**: 开发团队  
**最后更新**: 2025-10-18  
**版本**: v1.0.0

