# Settings Management API

本文档介绍了 Zishu Sensei 桌面应用的设置管理 API。

## 目录

- [概述](#概述)
- [配置结构](#配置结构)
- [设置命令](#设置命令)
- [角色命令](#角色命令)
- [窗口命令](#窗口命令)
- [系统命令](#系统命令)
- [适配器命令](#适配器命令)
- [使用示例](#使用示例)

## 概述

设置管理系统提供了完整的配置管理功能，包括：

- ✅ 配置持久化存储（JSON 格式）
- ✅ 自动备份和恢复
- ✅ 导入/导出配置
- ✅ 部分更新支持
- ✅ 配置验证
- ✅ 平台特定路径（Windows/macOS/Linux）

### 配置文件位置

- **Windows**: `%APPDATA%\zishu-sensei\config.json`
- **macOS**: `~/Library/Application Support/zishu-sensei/config.json`
- **Linux**: `~/.config/zishu-sensei/config.json`

## 配置结构

```typescript
interface AppConfig {
  window: WindowConfig;
  character: CharacterConfig;
  theme: ThemeConfig;
  system: SystemConfig;
}

interface WindowConfig {
  width: number;
  height: number;
  always_on_top: boolean;
  transparent: boolean;
  decorations: boolean;
  resizable: boolean;
  position: [number, number] | null;
}

interface CharacterConfig {
  current_character: string;
  scale: number;
  auto_idle: boolean;
  interaction_enabled: boolean;
}

interface ThemeConfig {
  current_theme: string;
  custom_css: string | null;
}

interface SystemConfig {
  auto_start: boolean;
  minimize_to_tray: boolean;
  close_to_tray: boolean;
  show_notifications: boolean;
}
```

## 设置命令

### `get_settings`

获取所有应用设置。

```typescript
import { invoke } from '@tauri-apps/api/tauri';

const response = await invoke('get_settings');
console.log(response.data); // AppConfig
```

### `update_settings`

更新应用设置（完整替换）。

```typescript
const newConfig: AppConfig = {
  window: { ... },
  character: { ... },
  theme: { ... },
  system: { ... }
};

const response = await invoke('update_settings', { config: newConfig });
```

### `update_partial_settings`

部分更新设置（只更新指定的字段）。

```typescript
const updates = {
  window: {
    always_on_top: true
  },
  character: {
    scale: 1.5
  }
};

const response = await invoke('update_partial_settings', { updates });
```

### `reset_settings`

重置设置为默认值。

```typescript
const response = await invoke('reset_settings');
console.log(response.message); // "设置已重置为默认值"
```

### `export_settings`

导出设置到文件。

```typescript
const filePath = '/path/to/export/config.json';
const response = await invoke('export_settings', { filePath });
```

### `import_settings`

从文件导入设置。

```typescript
const filePath = '/path/to/import/config.json';
const response = await invoke('import_settings', { filePath });
```

### 分类设置命令

#### 窗口配置

```typescript
// 获取窗口配置
const windowConfig = await invoke('get_window_config');

// 更新窗口配置
await invoke('update_window_config', {
  updates: {
    width: 800,
    height: 600,
    always_on_top: true
  }
});
```

#### 角色配置

```typescript
// 获取角色配置
const characterConfig = await invoke('get_character_config');

// 更新角色配置
await invoke('update_character_config', {
  updates: {
    current_character: 'shizuku',
    scale: 1.2,
    interaction_enabled: true
  }
});
```

#### 主题配置

```typescript
// 获取主题配置
const themeConfig = await invoke('get_theme_config');

// 更新主题配置
await invoke('update_theme_config', {
  updates: {
    current_theme: 'dark',
    custom_css: '.custom { color: red; }'
  }
});
```

#### 系统配置

```typescript
// 获取系统配置
const systemConfig = await invoke('get_system_config');

// 更新系统配置
await invoke('update_system_config', {
  updates: {
    auto_start: true,
    minimize_to_tray: true,
    show_notifications: true
  }
});
```

### `get_config_paths`

获取配置文件路径。

```typescript
const response = await invoke('get_config_paths');
console.log(response.data);
// {
//   config: "/path/to/config.json",
//   backup: "/path/to/config.backup.json",
//   data_dir: "/path/to/data"
// }
```

## 角色命令

### `get_characters`

获取可用角色列表。

```typescript
const response = await invoke('get_characters');
console.log(response.data); // CharacterInfo[]
```

### `get_character_info`

获取指定角色的详细信息。

```typescript
const response = await invoke('get_character_info', { 
  characterId: 'shizuku' 
});
console.log(response.data); // CharacterInfo
```

### `switch_character`

切换当前角色。

```typescript
const response = await invoke('switch_character', {
  characterId: 'haru'
});
```

### `play_motion`

播放角色动作。

```typescript
await invoke('play_motion', {
  request: {
    character_id: 'shizuku',  // 可选，默认为当前角色
    motion: 'tap_head',
    priority: 2,               // 可选，默认为 1
    loop_motion: false         // 可选，默认为 false
  }
});
```

### `set_expression`

设置角色表情。

```typescript
await invoke('set_expression', {
  request: {
    character_id: 'shizuku',  // 可选
    expression: 'happy'
  }
});
```

### `get_current_character`

获取当前角色信息。

```typescript
const response = await invoke('get_current_character');
console.log(response.data); // CharacterInfo
```

### `toggle_character_interaction`

切换角色交互开关。

```typescript
await invoke('toggle_character_interaction', { enabled: true });
```

### `set_character_scale`

设置角色缩放比例。

```typescript
await invoke('set_character_scale', { scale: 1.5 });
```

## 窗口命令

### `minimize_to_tray`

最小化窗口到系统托盘。

```typescript
await invoke('minimize_to_tray');
```

### `show_window` / `hide_window`

显示/隐藏窗口。

```typescript
await invoke('show_window');
await invoke('hide_window');
```

### `set_window_position`

设置窗口位置。

```typescript
await invoke('set_window_position', {
  request: { x: 100, y: 100 }
});
```

### `set_window_size`

设置窗口大小。

```typescript
await invoke('set_window_size', {
  request: { width: 800, height: 600 }
});
```

### `toggle_always_on_top`

切换窗口置顶状态。

```typescript
const response = await invoke('toggle_always_on_top');
console.log(response.data); // true 或 false
```

### `get_window_info`

获取窗口信息。

```typescript
const response = await invoke('get_window_info');
console.log(response.data);
// {
//   label: "main",
//   is_visible: true,
//   is_focused: true,
//   position: [100, 100],
//   size: [800, 600],
//   ...
// }
```

### `center_window`

居中窗口。

```typescript
await invoke('center_window');
```

### `maximize_window` / `unmaximize_window`

最大化/取消最大化窗口。

```typescript
await invoke('maximize_window');
await invoke('unmaximize_window');
```

### `close_window`

关闭指定窗口。

```typescript
await invoke('close_window', { label: 'settings' });
```

## 系统命令

### `get_system_info`

获取系统信息。

```typescript
const response = await invoke('get_system_info');
console.log(response.data);
// {
//   os: "linux",
//   os_version: "Linux",
//   arch: "x86_64",
//   cpu_count: 8,
//   total_memory: 16777216000,
//   app_version: "0.1.0",
//   app_name: "zishu-sensei"
// }
```

### `get_app_version`

获取应用版本信息。

```typescript
const response = await invoke('get_app_version');
console.log(response.data);
// {
//   version: "0.1.0",
//   build_date: "2024-01-15",
//   git_hash: "abc123"
// }
```

### `check_for_updates`

检查应用更新。

```typescript
const response = await invoke('check_for_updates');
console.log(response.data);
// {
//   current_version: "0.1.0",
//   latest_version: "0.2.0",
//   update_available: true,
//   message: "有新版本可用"
// }
```

### `restart_app`

重启应用。

```typescript
await invoke('restart_app');
```

### `quit_app`

退出应用。

```typescript
await invoke('quit_app');
```

### `show_in_folder`

在文件管理器中显示文件/文件夹。

```typescript
await invoke('show_in_folder', { 
  path: '/path/to/file' 
});
```

### `open_url`


```typescript
await invoke('open_url', { 
  url: 'https://example.com' 
});
```

### `get_app_data_path` / `get_app_log_path`

获取应用数据/日志目录路径。

```typescript
const dataPath = await invoke('get_app_data_path');
const logPath = await invoke('get_app_log_path');
```

### `set_auto_start`

设置开机自启。

```typescript
await invoke('set_auto_start', { enabled: true });
```

### `copy_to_clipboard` / `read_from_clipboard`

剪贴板操作。

```typescript
// 复制到剪贴板
await invoke('copy_to_clipboard', { 
  text: 'Hello, World!' 
});

// 从剪贴板读取
const response = await invoke('read_from_clipboard');
console.log(response.data); // "Hello, World!"
```

## 适配器命令

### `get_adapters`

获取已安装的适配器列表。

```typescript
const response = await invoke('get_adapters');
console.log(response.data); // AdapterInfo[]
```

### `install_adapter` / `uninstall_adapter`

安装/卸载适配器。

```typescript
await invoke('install_adapter', { adapterId: 'weather-adapter' });
await invoke('uninstall_adapter', { adapterId: 'weather-adapter' });
```

### `execute_adapter`

执行适配器操作。

```typescript
const response = await invoke('execute_adapter', {
  adapterId: 'weather-adapter',
  action: 'get_weather',
  params: { city: 'Beijing' }
});
```

### `get_adapter_config` / `update_adapter_config`

获取/更新适配器配置。

```typescript
const config = await invoke('get_adapter_config', {
  adapterId: 'weather-adapter'
});

await invoke('update_adapter_config', {
  adapterId: 'weather-adapter',
  config: { apiKey: 'xxx' }
});
```

## 使用示例

### React Hook 示例

```typescript
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

function useSettings() {
  const [settings, setSettings] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await invoke('get_settings');
      setSettings(response.data);
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<AppConfig>) => {
    try {
      const response = await invoke('update_partial_settings', { updates });
      setSettings(response.data);
      return true;
    } catch (error) {
      console.error('更新设置失败:', error);
      return false;
    }
  };

  const resetSettings = async () => {
    try {
      const response = await invoke('reset_settings');
      setSettings(response.data);
      return true;
    } catch (error) {
      console.error('重置设置失败:', error);
      return false;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    resetSettings,
    reload: loadSettings
  };
}

// 使用
function SettingsPanel() {
  const { settings, updateSettings } = useSettings();

  const handleToggleAlwaysOnTop = async () => {
    await updateSettings({
      window: {
        ...settings.window,
        always_on_top: !settings.window.always_on_top
      }
    });
  };

  return (
    <div>
      <button onClick={handleToggleAlwaysOnTop}>
        切换窗口置顶
      </button>
    </div>
  );
}
```

### 监听配置变化

```typescript
import { listen } from '@tauri-apps/api/event';

// 监听角色切换事件
listen('character-changed', (event) => {
  console.log('角色已切换:', event.payload);
  // { old_character: "shizuku", new_character: "haru" }
});

// 监听窗口缩放变化
listen('scale-changed', (event) => {
  console.log('缩放已改变:', event.payload);
  // 1.5
});

// 监听交互开关
listen('interaction-toggled', (event) => {
  console.log('交互状态:', event.payload);
  // true 或 false
});
```

## 响应格式

所有命令都返回统一的响应格式：

```typescript
interface CommandResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}
```

### 成功响应示例

```typescript
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "timestamp": 1705320000
}
```

### 错误响应示例

```typescript
{
  "success": false,
  "error": "配置验证失败: 窗口宽度必须在 200-4000 之间",
  "timestamp": 1705320000
}
```

## 配置验证规则

- 窗口宽度/高度: 200-4000 像素
- 角色缩放: 0.1-5.0 倍
- 角色名称: 不能为空
- 主题名称: 不能为空

## 最佳实践

1. **错误处理**: 始终使用 try-catch 处理命令调用
2. **加载状态**: 在 UI 中显示加载状态
3. **乐观更新**: 先更新 UI，再调用命令，失败时回滚
4. **防抖**: 对频繁的设置更新使用防抖
5. **验证**: 在前端也进行基本验证
6. **备份**: 定期导出配置作为备份

## 故障排除

### 配置文件损坏

如果配置文件损坏，系统会自动尝试：
1. 加载备份配置文件
2. 如果备份也损坏，使用默认配置

### 权限问题

确保应用有权限访问配置目录：
- Windows: 检查 `%APPDATA%` 权限
- macOS: 检查 `~/Library/Application Support` 权限
- Linux: 检查 `~/.config` 权限

### 日志

查看日志文件获取详细错误信息：
- Windows: `%TEMP%\zishu-sensei\logs\`
- macOS: `~/Library/Application Support/zishu-sensei/logs/`
- Linux: `~/.config/zishu-sensei/logs/`

## 更新日志

### v0.1.0 (2024-01-15)

- ✅ 初始实现设置管理系统
- ✅ 配置持久化存储
- ✅ 自动备份和恢复
- ✅ 导入/导出功能
- ✅ 角色管理命令
- ✅ 窗口管理命令
- ✅ 系统命令
- ✅ 适配器命令框架

