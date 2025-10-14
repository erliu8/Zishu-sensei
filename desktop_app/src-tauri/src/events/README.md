# 事件处理模块

## 概述

本模块提供了完整的事件处理系统，包括窗口事件和系统托盘事件的处理。

## 模块结构

```
events/
├── mod.rs              # 模块导出
├── window.rs           # 窗口事件处理
├── tray.rs            # 系统托盘事件处理
├── chat.rs            # 聊天事件处理（待实现）
├── character.rs       # 角色事件处理（待实现）
└── desktop.rs         # 桌面事件处理（待实现）
```

## 窗口事件处理 (window.rs)

### 主要功能

1. **窗口关闭处理**
   - 支持"关闭到托盘"功能
   - 自动保存配置
   - 显示托盘通知

2. **窗口焦点管理**
   - 焦点获得/失去事件
   - 触发角色动画
   - 自动保存配置

3. **窗口位置和大小**
   - 实时跟踪窗口移动
   - 监控窗口大小变化
   - 防抖保存配置

4. **高级功能**
   - 缩放因子变化处理
   - 系统主题切换响应
   - 文件拖放支持

### 使用示例

#### 基础用法

```rust
use crate::events::window::handle_window_event;

// 在 main.rs 中注册窗口事件处理器
tauri::Builder::default()
    .on_window_event(handle_window_event)
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

#### 手动创建事件处理器

```rust
use crate::events::window::{WindowEventHandler, create_window_event_handler};

let app_handle = app.handle();
let handler = create_window_event_handler(app_handle);

// 手动处理特定事件
if let Some(window) = app.get_window("main") {
    let position = window.outer_position().unwrap();
    handler.handle_moved(&window, position);
}
```

#### 使用辅助函数

```rust
use crate::events::window_helpers;

// 安全地显示窗口
if let Some(window) = app.get_window("main") {
    window_helpers::safe_show_window(&window)?;
}

// 切换窗口可见性
if let Some(window) = app.get_window("main") {
    window_helpers::toggle_window_visibility(&window)?;
}

// 居中显示窗口
if let Some(window) = app.get_window("main") {
    window_helpers::center_and_show_window(&window)?;
}

// 保存窗口状态
if let Some(window) = app.get_window("main") {
    window_helpers::save_window_state(&app_handle, &window).await?;
}

// 恢复窗口状态
if let Some(window) = app.get_window("main") {
    window_helpers::restore_window_state(&app_handle, &window)?;
}
```

### 配置防抖

窗口事件处理器内置了配置保存防抖功能，默认延迟为 1 秒。这意味着在窗口移动或调整大小时，配置不会立即保存，而是等待 1 秒后再保存，避免频繁的磁盘写入。

## 系统托盘事件处理 (tray.rs)

### 主要功能

1. **托盘点击事件**
   - 左键单击：切换主窗口显示/隐藏
   - 右键单击：显示上下文菜单
   - 双击：打开聊天窗口

2. **丰富的菜单功能**
   - 设置子菜单（角色、主题、适配器、声音、系统）
   - 角色动作子菜单（待机、挥手、跳舞）
   - 工具菜单（适配器市场、工作流编辑器、截图）
   - 窗口控制（显示、隐藏、切换置顶）
   - 应用控制（关于、检查更新、重启、退出）

3. **智能通知**
   - 信息通知
   - 错误通知
   - 带图标的通知

4. **动态菜单更新**
   - 根据应用状态更新菜单
   - 支持重建托盘菜单

### 使用示例

#### 基础用法

```rust
use crate::events::tray::{create_system_tray, handle_system_tray_event};

// 在 main.rs 中创建系统托盘
let tray = create_system_tray();

tauri::Builder::default()
    .system_tray(tray)
    .on_system_tray_event(handle_system_tray_event)
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

#### 手动创建托盘处理器

```rust
use crate::events::tray::TrayEventHandler;

let app_handle = app.handle();
let handler = TrayEventHandler::new(app_handle);

// 手动处理特定事件
handler.handle_left_click();
handler.handle_menu_item_click("chat");
```

#### 使用辅助函数

```rust
use crate::events::tray_helpers;

// 更新托盘图标
tray_helpers::update_tray_icon(&app_handle, "icons/icon-active.png")?;

// 更新托盘提示
tray_helpers::update_tray_tooltip(&app_handle, "Zishu Sensei - 运行中")?;

// 显示带图标的通知
tray_helpers::show_tray_notification_with_icon(
    &app_handle,
    "标题",
    "消息内容",
    Some(icon)
)?;

// 重建托盘菜单（用于动态更新）
tray_helpers::rebuild_tray_menu(&app_handle)?;

// 销毁托盘
tray_helpers::destroy_tray(&app_handle)?;
```

### 托盘菜单项 ID

| ID | 功能 | 描述 |
|---|---|---|
| `chat` | 打开聊天窗口 | 双击托盘图标也有相同效果 |
| `character_settings` | 角色设置 | 打开设置窗口的角色标签页 |
| `theme_settings` | 主题设置 | 打开设置窗口的主题标签页 |
| `adapter_settings` | 适配器管理 | 打开设置窗口的适配器标签页 |
| `sound_settings` | 声音设置 | 打开设置窗口的声音标签页 |
| `system_settings` | 系统设置 | 打开设置窗口的系统标签页 |
| `character_idle` | 角色待机 | 触发角色待机动作 |
| `character_wave` | 角色挥手 | 触发角色挥手动作 |
| `character_dance` | 角色跳舞 | 触发角色跳舞动作 |
| `adapter_market` | 适配器市场 | 在浏览器中打开适配器市场 |
| `workflow_editor` | 工作流编辑器 | 打开工作流编辑器窗口 |
| `screenshot` | 截图 | 触发截图功能 |
| `show_window` | 显示窗口 | 显示主窗口 |
| `hide_window` | 隐藏窗口 | 隐藏主窗口到托盘 |
| `toggle_always_on_top` | 切换置顶 | 切换窗口置顶状态 |
| `about` | 关于 | 显示关于对话框 |
| `check_updates` | 检查更新 | 检查应用更新 |
| `restart` | 重启应用 | 重启应用（带确认对话框） |
| `quit` | 退出 | 退出应用（带确认对话框） |

## 事件与前端通信

### 窗口事件 → 前端

窗口事件处理器会向前端发送以下事件：

```typescript
// 窗口焦点变化
window.addEventListener('window-focused', (event) => {
  console.log('窗口焦点:', event.detail); // true/false
});

// 窗口移动
window.addEventListener('window-moved', (event) => {
  console.log('窗口位置:', event.detail); // { x: number, y: number }
});

// 窗口调整大小
window.addEventListener('window-resized', (event) => {
  console.log('窗口大小:', event.detail); // { width: number, height: number }
});

// 窗口缩放因子变化
window.addEventListener('window-scale-factor-changed', (event) => {
  console.log('缩放因子:', event.detail); // number
});

// 系统主题变化
window.addEventListener('system-theme-changed', (event) => {
  console.log('系统主题:', event.detail); // 'light' | 'dark'
});

// 文件拖放
window.addEventListener('file-drop-hovered', (event) => {
  console.log('文件悬停:', event.detail); // string[]
});

window.addEventListener('file-drop-dropped', (event) => {
  console.log('文件拖放:', event.detail); // string[]
});

window.addEventListener('file-drop-cancelled', () => {
  console.log('拖放取消');
});

// 角色事件
window.addEventListener('character-event', (event) => {
  console.log('角色事件:', event.detail); // 'wave' | 'idle' 等
});

window.addEventListener('character-scale-update', (event) => {
  console.log('角色缩放:', event.detail); // number
});
```

### 托盘事件 → 前端

```typescript
// 切换设置标签页
window.addEventListener('switch-settings-tab', (event) => {
  const tab = event.detail; // 'character' | 'theme' | 'adapter' | 'sound' | 'system'
  // 切换到指定标签页
});

// 角色动作
window.addEventListener('character-action', (event) => {
  const action = event.detail; // 'idle' | 'wave' | 'dance'
  // 触发角色动作
});

// 截图
window.addEventListener('take-screenshot', () => {
  // 执行截图
});

// 检查更新
window.addEventListener('check-for-updates', () => {
  // 检查更新
});
```

## 配置集成

事件处理模块与应用配置紧密集成：

```rust
// 配置结构（来自 main.rs）
pub struct AppConfig {
    pub window: WindowConfig,     // 窗口配置
    pub character: CharacterConfig, // 角色配置
    pub theme: ThemeConfig,        // 主题配置
    pub system: SystemConfig,      // 系统配置
}

pub struct SystemConfig {
    pub auto_start: bool,          // 开机自启
    pub minimize_to_tray: bool,    // 最小化到托盘
    pub close_to_tray: bool,       // 关闭到托盘
    pub show_notifications: bool,   // 显示通知
}
```

### 配置影响

1. **close_to_tray**: 控制窗口关闭行为
   - `true`: 关闭窗口时隐藏到托盘
   - `false`: 关闭窗口时退出应用

2. **show_notifications**: 控制通知显示
   - `true`: 显示系统通知
   - `false`: 不显示通知

3. **window 配置**: 自动保存和恢复
   - 窗口位置 (position)
   - 窗口大小 (width, height)
   - 置顶状态 (always_on_top)
   - 可调整大小 (resizable)

## 错误处理

所有事件处理函数都包含完善的错误处理：

```rust
// 错误会被记录到日志
if let Err(e) = window.hide() {
    error!("隐藏窗口失败: {}", e);
}

// 辅助函数返回 Result
match window_helpers::safe_show_window(&window) {
    Ok(_) => info!("窗口已显示"),
    Err(e) => error!("显示窗口失败: {}", e),
}
```

## 日志级别

- `debug!`: 调试信息（如防抖、菜单更新）
- `info!`: 一般信息（如窗口操作、配置保存）
- `warn!`: 警告信息（如事件发送失败）
- `error!`: 错误信息（如窗口操作失败）

## 性能优化

1. **配置保存防抖**: 避免频繁磁盘写入
2. **异步保存**: 不阻塞主线程
3. **条件更新**: 只在配置实际变化时保存
4. **锁优化**: 及时释放 Mutex 锁

## 扩展开发

### 添加新的托盘菜单项

1. 在 `create_system_tray()` 中添加菜单项：
```rust
let new_item = CustomMenuItem::new("new_feature".to_string(), "🎯 新功能");
```

2. 在 `handle_menu_item_click()` 中处理点击：
```rust
"new_feature" => self.handle_new_feature(),
```

3. 实现处理函数：
```rust
fn handle_new_feature(&self) {
    info!("处理新功能");
    // 实现逻辑
}
```

### 添加新的窗口事件

1. 在 `handle_window_event()` 中添加事件匹配：
```rust
tauri::WindowEvent::NewEvent(data) => {
    handler.handle_new_event(window, data);
}
```

2. 实现处理方法：
```rust
pub fn handle_new_event(&self, window: &Window, data: EventData) {
    // 处理逻辑
}
```

## 最佳实践

1. **始终使用辅助函数**: 使用 `window_helpers` 和 `tray_helpers` 中的函数，它们包含完善的错误处理
2. **检查窗口存在**: 在操作窗口前检查其是否存在
3. **优雅降级**: 当操作失败时提供友好的错误提示
4. **日志记录**: 记录关键操作和错误，便于调试
5. **配置验证**: 在更新配置前进行验证
6. **异步操作**: 对耗时操作使用异步，避免阻塞

## 测试建议

### 窗口事件测试

1. 测试窗口关闭到托盘功能
2. 测试窗口位置和大小的保存/恢复
3. 测试防抖功能（快速移动窗口）
4. 测试文件拖放功能
5. 测试系统主题切换

### 托盘事件测试

1. 测试所有菜单项的功能
2. 测试左键、右键、双击事件
3. 测试通知显示
4. 测试窗口显示/隐藏切换
5. 测试置顶状态切换
6. 测试退出和重启确认对话框

## 故障排查

### 窗口不响应关闭到托盘

检查 `AppState` 和配置是否正确加载：
```rust
if let Some(app_state) = app_handle.try_state::<AppState>() {
    let config = app_state.config.lock();
    println!("close_to_tray: {}", config.system.close_to_tray);
}
```

### 托盘菜单不显示

检查系统托盘是否正确创建：
```rust
let tray = create_system_tray();
// 确保在 Builder 中正确注册
.system_tray(tray)
```

### 配置未保存

检查日志中的保存错误：
```bash
# 查看日志文件
tail -f ~/.config/zishu-sensei/logs/zishu-sensei.log
```

### 事件未传递到前端

检查事件发送是否成功：
```rust
if let Err(e) = window.emit("event-name", data) {
    error!("事件发送失败: {}", e);
}
```

