/**
 * UI 组件相关类型定义
 */

/**
 * 上下文菜单选项
 */
export interface ContextMenuOption {
    id: string
    label: string
    icon?: string
    shortcut?: string
    disabled?: boolean
    checked?: boolean
    type?: 'normal' | 'separator' | 'submenu'
    children?: ContextMenuOption[]
    onClick?: () => void
}

/**
 * 上下文菜单位置
 */
export interface ContextMenuPosition {
    x: number
    y: number
}

/**
 * 模态框大小
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

/**
 * 按钮变体
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'

/**
 * 按钮大小
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/**
 * 输入框类型
 */
export type InputType = 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search'

/**
 * 表单字段状态
 */
export type FieldState = 'default' | 'success' | 'warning' | 'error'

/**
 * Toast 类型
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error'

/**
 * Toast 位置
 */
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

/**
 * 加载状态
 */
export interface LoadingState {
    isLoading: boolean
    message?: string
    progress?: number
}

/**
 * 分页组件属性
 */
export interface PaginationProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    showSizeChanger?: boolean
    pageSizeOptions?: number[]
    pageSize?: number
    onPageSizeChange?: (size: number) => void
    showQuickJumper?: boolean
    showTotal?: boolean | ((total: number, range: [number, number]) => string)
    disabled?: boolean
}

/**
 * 表格列定义
 */
export interface TableColumn<T = any> {
    key: string
    title: string
    dataIndex?: string
    width?: number | string
    align?: 'left' | 'center' | 'right'
    sortable?: boolean
    filterable?: boolean
    render?: (value: any, record: T, index: number) => React.ReactNode
    onHeaderCell?: () => React.HTMLAttributes<HTMLTableHeaderCellElement>
    onCell?: (record: T, index: number) => React.HTMLAttributes<HTMLTableCellElement>
}

/**
 * 表格排序信息
 */
export interface TableSortInfo {
    columnKey: string
    order: 'asc' | 'desc'
}

/**
 * 表格筛选信息
 */
export interface TableFilterInfo {
    [key: string]: any
}

/**
 * 树形节点
 */
export interface TreeNode<T = any> {
    key: string
    title: string
    children?: TreeNode<T>[]
    disabled?: boolean
    checkable?: boolean
    selectable?: boolean
    icon?: React.ReactNode
    data?: T
}

/**
 * 拖拽状态
 */
export interface DragState {
    isDragging: boolean
    draggedItem?: any
    dropTarget?: any
    dropPosition?: 'before' | 'after' | 'inside'
}

/**
 * 虚拟滚动配置
 */
export interface VirtualScrollConfig {
    itemHeight: number | ((index: number) => number)
    overscan?: number
    scrollToIndex?: number
    scrollToAlignment?: 'start' | 'center' | 'end' | 'auto'
}

/**
 * 响应式断点
 */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/**
 * 响应式配置
 */
export type ResponsiveConfig<T> = T | Partial<Record<Breakpoint, T>>

/**
 * 颜色模式
 */
export type ColorMode = 'light' | 'dark'

/**
 * 主题配置
 */
export interface ThemeConfig {
    colorMode: ColorMode
    primaryColor: string
    borderRadius: number
    fontFamily: string
    fontSize: number
    lineHeight: number
    spacing: number
}

/**
 * 动画配置
 */
export interface AnimationConfig {
    duration: number
    easing: string
    delay?: number
}

/**
 * 过渡效果类型
 */
export type TransitionType = 'fade' | 'slide' | 'scale' | 'rotate' | 'flip'

/**
 * 手势事件
 */
export interface GestureEvent {
    type: 'tap' | 'doubletap' | 'press' | 'swipe' | 'pinch' | 'rotate'
    target: EventTarget
    clientX: number
    clientY: number
    deltaX?: number
    deltaY?: number
    scale?: number
    rotation?: number
    velocity?: number
    direction?: 'up' | 'down' | 'left' | 'right'
}

/**
 * 快捷键配置
 */
export interface ShortcutConfig {
    key: string
    modifier?: 'ctrl' | 'alt' | 'shift' | 'meta'
    action: () => void
    description?: string
    global?: boolean
}