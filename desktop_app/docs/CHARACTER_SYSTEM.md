# 角色系统文档

这个文档介绍了 Zishu-sensei 的角色管理系统，包括数据库存储、模型加载、切换动画和配置持久化等功能。

## 📋 目录

- [系统架构](#系统架构)
- [后端实现](#后端实现)
- [前端实现](#前端实现)
- [使用示例](#使用示例)
- [API 参考](#api-参考)

## 🏗️ 系统架构

角色系统采用前后端分离的架构：

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (React)                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Character  │  │ ModelLoader  │  │  Animations  │     │
│  │  Component   │  │     Hook     │  │  Transition  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                          │                                   │
│                    Tauri IPC                                │
│                          │                                   │
├─────────────────────────────────────────────────────────────┤
│                       后端 (Rust)                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Character  │  │   Database   │  │   Character  │     │
│  │   Commands   │  │    Module    │  │   Registry   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                          │                                   │
│                    SQLite Database                           │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 后端实现

### 数据库模块

位置: `src-tauri/src/database/`

#### 数据库架构

```sql
-- 角色表
CREATE TABLE characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    path TEXT NOT NULL,
    preview_image TEXT,
    description TEXT,
    gender TEXT NOT NULL,
    size TEXT NOT NULL,
    features TEXT NOT NULL,  -- JSON array
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 角色动作表
CREATE TABLE character_motions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    motion_name TEXT NOT NULL,
    motion_group TEXT NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE(character_id, motion_name)
);

-- 角色表情表
CREATE TABLE character_expressions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    expression_name TEXT NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE(character_id, expression_name)
);

-- 角色配置表
CREATE TABLE character_configs (
    character_id TEXT PRIMARY KEY,
    scale REAL NOT NULL DEFAULT 1.0,
    position_x REAL NOT NULL DEFAULT 0.0,
    position_y REAL NOT NULL DEFAULT 0.0,
    interaction_enabled INTEGER NOT NULL DEFAULT 1,
    config_json TEXT,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);
```

#### CharacterRegistry API

```rust
// 注册角色
pub fn register_character(&self, character: CharacterData) -> SqliteResult<()>

// 获取角色信息
pub fn get_character(&self, character_id: &str) -> SqliteResult<Option<CharacterData>>

// 获取所有角色
pub fn get_all_characters(&self) -> SqliteResult<Vec<CharacterData>>

// 获取当前激活的角色
pub fn get_active_character(&self) -> SqliteResult<Option<CharacterData>>

// 设置激活角色
pub fn set_active_character(&self, character_id: &str) -> SqliteResult<()>

// 保存角色配置
pub fn save_character_config(&self, config: CharacterConfig) -> SqliteResult<()>

// 获取角色配置
pub fn get_character_config(&self, character_id: &str) -> SqliteResult<Option<CharacterConfig>>
```

### Tauri 命令

位置: `src-tauri/src/commands/character.rs`

#### 可用命令

```rust
// 获取角色列表
#[tauri::command]
pub async fn get_characters() -> Result<CommandResponse<Vec<CharacterInfo>>, String>

// 获取角色详细信息
#[tauri::command]
pub async fn get_character_info(character_id: String) -> Result<CommandResponse<CharacterInfo>, String>

// 切换角色
#[tauri::command]
pub async fn switch_character(character_id: String) -> Result<CommandResponse<CharacterInfo>, String>

// 保存角色配置
#[tauri::command]
pub async fn save_character_config(config: CharacterConfigData) -> Result<CommandResponse<()>, String>

// 获取角色配置
#[tauri::command]
pub async fn get_character_config(character_id: String) -> Result<CommandResponse<CharacterConfigData>, String>
```

## 🎨 前端实现

### ModelLoader Hook

位置: `src/components/Character/ModelLoader.tsx`

提供角色加载和管理功能：

```typescript
const { 
    currentCharacter,     // 当前角色信息
    loadCharacters,       // 加载角色列表
    switchCharacter,      // 切换角色
    getCharacterInfo      // 获取角色信息
} = useModelLoader()
```

### 角色过渡动画

位置: `src/components/Character/Animations/CharacterTransition.tsx`

支持多种过渡效果：

- `fade` - 淡入淡出
- `slide-left` - 从右滑入
- `slide-right` - 从左滑入
- `zoom` - 缩放
- `flip` - 翻转
- `dissolve` - 溶解

```typescript
<CharacterTransition
    characterId={currentModelId}
    transitionType="fade"
    duration={600}
    onTransitionComplete={() => {
        console.log('过渡完成')
    }}
>
    {children}
</CharacterTransition>
```

### 模型热加载 Hook

位置: `src/hooks/useModelHotReload.ts`

开发环境下支持模型文件变化自动重新加载：

```typescript
const { 
    reload,        // 重新加载指定模型
    reloadAll,     // 重新加载所有模型
    clearCache,    // 清除缓存
    state          // 热加载状态
} = useModelHotReload({
    enabled: true,
    debounceDelay: 500,
    showNotification: true,
    onReloadSuccess: (modelId) => {
        console.log('重新加载成功:', modelId)
    }
})
```

#### 开发快捷键

- `Ctrl/Cmd + Shift + R` - 重新加载当前模型
- `Ctrl/Cmd + Shift + Alt + R` - 重新加载所有模型

## 📚 使用示例

### 1. 获取角色列表

```typescript
import { invoke } from '@tauri-apps/api/tauri'

async function getCharacters() {
    const response = await invoke('get_characters')
    console.log('角色列表:', response.data)
}
```

### 2. 切换角色

```typescript
import { useModelLoader } from '@/components/Character/ModelLoader'

function CharacterSwitcher() {
    const { switchCharacter } = useModelLoader()
    
    const handleSwitch = async (characterId: string) => {
        try {
            await switchCharacter(characterId)
            console.log('切换成功')
        } catch (error) {
            console.error('切换失败:', error)
        }
    }
    
    return (
        <button onClick={() => handleSwitch('hiyori')}>
            切换到 Hiyori
        </button>
    )
}
```

### 3. 保存角色配置

```typescript
import { invoke } from '@tauri-apps/api/tauri'

async function saveConfig() {
    const config = {
        character_id: 'hiyori',
        scale: 1.2,
        position_x: 0,
        position_y: 0,
        interaction_enabled: true,
        config_json: JSON.stringify({ custom: 'data' })
    }
    
    await invoke('save_character_config', { config })
}
```

### 4. 使用角色组件

```tsx
import { Character } from '@/components/Character'

function App() {
    const character = {
        id: 'hiyori',
        name: 'Hiyori',
        avatar: '/avatars/hiyori.png',
        description: '可爱的桌面宠物'
    }
    
    return (
        <Character
            character={character}
            onInteraction={(type, data) => {
                console.log('交互事件:', type, data)
            }}
            showModelSelector={true}
        />
    )
}
```

### 5. 启用热加载（开发环境）

```tsx
import { useModelHotReload } from '@/hooks/useModelHotReload'

function DevTools() {
    const { reload, reloadAll, state } = useModelHotReload({
        enabled: process.env.NODE_ENV === 'development',
        onReloadSuccess: (modelId) => {
            console.log('✅ 热加载成功:', modelId)
        }
    })
    
    return (
        <div>
            <button onClick={() => reload('hiyori')}>重新加载当前</button>
            <button onClick={reloadAll}>重新加载全部</button>
            <div>重新加载次数: {state.reloadCount}</div>
        </div>
    )
}
```

## 🔌 API 参考

### Tauri 命令

#### `get_characters()`

获取所有可用角色列表

**返回:**
```typescript
{
    success: boolean
    data: CharacterInfo[]
    message?: string
}
```

#### `get_character_info(character_id: string)`

获取指定角色的详细信息

**参数:**
- `character_id` - 角色 ID

**返回:**
```typescript
{
    success: boolean
    data: CharacterInfo
    message?: string
}
```

#### `switch_character(character_id: string)`

切换到指定角色

**参数:**
- `character_id` - 角色 ID

**返回:**
```typescript
{
    success: boolean
    data: CharacterInfo
    message?: string
}
```

**事件:**
触发 `character-changed` 事件:
```typescript
{
    old_character: string | null
    new_character: string
    character_info: CharacterInfo
}
```

#### `save_character_config(config: CharacterConfigData)`

保存角色配置到数据库

**参数:**
```typescript
{
    character_id: string
    scale: number
    position_x: number
    position_y: number
    interaction_enabled: boolean
    config_json?: string
}
```

#### `get_character_config(character_id: string)`

获取角色配置

**参数:**
- `character_id` - 角色 ID

**返回:**
```typescript
{
    success: boolean
    data: CharacterConfigData
    message?: string
}
```

### 类型定义

#### CharacterInfo

```typescript
interface CharacterInfo {
    id: string
    name: string
    description?: string
    preview_image?: string
    motions: string[]
    expressions: string[]
    is_active: boolean
}
```

#### CharacterConfigData

```typescript
interface CharacterConfigData {
    character_id: string
    scale: number
    position_x: number
    position_y: number
    interaction_enabled: boolean
    config_json?: string
}
```

## 🎯 最佳实践

1. **角色切换**
   - 总是使用 `switchCharacter` API 进行角色切换
   - 监听 `character-changed` 事件来同步 UI 状态
   - 切换时显示过渡动画以提升用户体验

2. **配置持久化**
   - 在用户修改配置后自动保存
   - 使用防抖避免频繁写入数据库
   - 在应用启动时加载保存的配置

3. **模型加载**
   - 使用缓存减少重复加载
   - 显示加载状态提升用户体验
   - 处理加载错误并提供回退方案

4. **热加载**
   - 仅在开发环境启用
   - 使用防抖避免频繁重新加载
   - 提供键盘快捷键方便开发

## 🐛 故障排除

### 角色切换失败

1. 检查角色 ID 是否正确
2. 确认角色在数据库中存在
3. 查看控制台错误信息

### 配置无法保存

1. 检查数据库连接状态
2. 确认角色 ID 存在
3. 验证配置数据格式

### 模型加载失败

1. 检查模型文件路径
2. 确认 models.json 格式正确
3. 查看网络请求状态

## 📝 更新日志

### 2025-10-18

- ✅ 实现角色注册表数据库模块
- ✅ 完善 character.rs，从数据库读取而非硬编码
- ✅ 实现 ModelLoader.tsx 的模型加载逻辑
- ✅ 实现角色切换动画效果
- ✅ 实现角色配置持久化存储
- ✅ 实现角色模型热加载功能

## 📚 相关文档

- [Live2D 集成文档](./LIVE2D_INTEGRATION.md)
- [数据库架构文档](./DATABASE_SCHEMA.md)
- [API 文档](./API_REFERENCE.md)

