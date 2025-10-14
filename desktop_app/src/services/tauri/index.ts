/**
 * Tauri 服务统一导出
 * 
 * 提供完整的 Tauri 功能封装，包括命令调用、事件监听、窗口管理等
 */

export * from './clipboard'
export * from './commands'
export * from './config'
export * from './dialogs'
export * from './events'
export * from './files'
export * from './notifications'
export * from './shortcuts'
export * from './system'
export * from './tray'
export * from './updater'
export * from './utils'
export * from './windows'

// 主要服务类
export { TauriCommandService } from './commands'
export { TauriConfigService } from './config'
export { TauriService } from './core'
export { TauriEventService } from './events'
export { TauriSystemService } from './system'
export { TauriWindowService } from './windows'

