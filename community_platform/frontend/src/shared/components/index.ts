/**
 * 共享组件统一导出
 * 包含所有可复用的 UI 组件
 */

// ============================================
// 布局组件
// ============================================
export * from './layout'

// ============================================
// 通用业务组件 (优先级最高，包含增强版本)
// ============================================
export * from './common'

// ============================================
// UI 基础组件 (排除与 common 重复的组件)
// ============================================
// 布局与导航组件
export * from './ui/card'
export * from './ui/dialog'
export * from './ui/alert-dialog'
// export * from './ui/dropdown-menu' // 待实现
export * from './ui/sheet'
export * from './ui/tabs'
export * from './ui/separator'
export * from './ui/scroll-area'

// 表单组件
export * from './ui/button'
export * from './ui/input'
export * from './ui/textarea'
export * from './ui/select'
export * from './ui/checkbox'
export * from './ui/radio-group'
export * from './ui/label'
export * from './ui/switch'
export * from './ui/slider'
export * from './ui/form'

// 反馈组件
export * from './ui/alert'
export * from './ui/badge'
export * from './ui/progress'
// export * from './ui/skeleton' // 使用 common 中的增强版本
export * from './ui/tooltip'
export * from './ui/popover'
export * from './ui/toast'
export * from './ui/toaster'
export * from './ui/use-toast'
// export * from './ui/loading-spinner' // 使用 common 中的增强版本

// 数据展示组件
export * from './ui/table'
// export * from './ui/avatar' // 使用 common 中的增强版本
// export * from './ui/calendar' // 待实现
// export * from './ui/command' // 待实现
// export * from './ui/empty-state' // 使用 common 中的增强版本

// 业务组件
export * from './ui/role-badge'

