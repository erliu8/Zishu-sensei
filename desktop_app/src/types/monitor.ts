/**
 * 显示器和桌面信息类型定义
 * 
 * 提供桌面显示器相关的 TypeScript 类型定义，包括：
 * - 显示器信息
 * - 桌面信息
 * - 虚拟屏幕信息
 * - 显示器方向
 */

/**
 * 显示器方向
 */
export type DisplayOrientation = 'landscape' | 'portrait' | 'square'

/**
 * 显示器尺寸信息
 */
export interface MonitorSize {
  /** 物理像素宽度 */
  width: number
  /** 物理像素高度 */
  height: number
  /** 逻辑宽度（物理宽度 / 缩放因子） */
  logical_width: number
  /** 逻辑高度（物理高度 / 缩放因子） */
  logical_height: number
}

/**
 * 显示器位置信息
 */
export interface MonitorPosition {
  /** 物理像素 X 坐标 */
  x: number
  /** 物理像素 Y 坐标 */
  y: number
  /** 逻辑 X 坐标 */
  logical_x: number
  /** 逻辑 Y 坐标 */
  logical_y: number
}

/**
 * 显示器信息
 */
export interface MonitorInfo {
  /** 显示器名称（如 Windows 上的 "\\\\.\\DISPLAY1"） */
  name: string | null
  /** 物理尺寸（像素） */
  size: MonitorSize
  /** 显示器在虚拟屏幕中的位置 */
  position: MonitorPosition
  /** DPI 缩放因子（1.0 = 100%, 1.5 = 150%, 2.0 = 200% 等） */
  scale_factor: number
  /** 显示器方向 */
  orientation: DisplayOrientation
  /** 是否为主显示器 */
  is_primary: boolean
}

/**
 * 虚拟屏幕信息（多显示器设置）
 */
export interface VirtualScreen {
  /** 横跨所有显示器的总宽度 */
  total_width: number
  /** 横跨所有显示器的总高度 */
  total_height: number
  /** 最左侧 X 坐标 */
  min_x: number
  /** 最顶部 Y 坐标 */
  min_y: number
  /** 最右侧 X 坐标 */
  max_x: number
  /** 最底部 Y 坐标 */
  max_y: number
}

/**
 * 完整的桌面信息
 */
export interface DesktopInfo {
  /** 主显示器信息 */
  primary_monitor: MonitorInfo
  /** 所有可用的显示器 */
  monitors: MonitorInfo[]
  /** 虚拟屏幕信息（多显示器配置） */
  virtual_screen: VirtualScreen
  /** 显示器数量 */
  monitor_count: number
  
  // 向后兼容的旧字段
  /** 屏幕宽度（主显示器） */
  screen_width: number
  /** 屏幕高度（主显示器） */
  screen_height: number
  /** 缩放因子（主显示器） */
  scale_factor: number
}

/**
 * 显示器统计信息
 */
export interface MonitorStats {
  /** 总显示器数 */
  total_monitors: number
  /** 主显示器索引 */
  primary_monitor_index: number
  /** 总虚拟屏幕区域 */
  total_area: number
  /** 平均 DPI 缩放 */
  average_scale_factor: number
  /** 显示器排列类型 */
  arrangement: 'single' | 'horizontal' | 'vertical' | 'mixed'
}

/**
 * 工具函数：判断是否为有效的显示器方向
 */
export const isValidOrientation = (orientation: string): orientation is DisplayOrientation => {
  return ['landscape', 'portrait', 'square'].includes(orientation)
}

/**
 * 工具函数：计算显示器统计信息
 */
export const calculateMonitorStats = (desktopInfo: DesktopInfo): MonitorStats => {
  const { monitors, virtual_screen } = desktopInfo
  
  // 找到主显示器索引
  const primaryIndex = monitors.findIndex(m => m.is_primary)
  
  // 计算平均缩放因子
  const avgScaleFactor = monitors.reduce((sum, m) => sum + m.scale_factor, 0) / monitors.length
  
  // 计算总面积
  const totalArea = monitors.reduce((sum, m) => sum + m.size.width * m.size.height, 0)
  
  // 判断排列类型
  let arrangement: 'single' | 'horizontal' | 'vertical' | 'mixed' = 'single'
  if (monitors.length > 1) {
    const hasHorizontal = monitors.some((m, i) => 
      monitors.some((n, j) => i !== j && Math.abs(m.position.y - n.position.y) < 100)
    )
    const hasVertical = monitors.some((m, i) => 
      monitors.some((n, j) => i !== j && Math.abs(m.position.x - n.position.x) < 100)
    )
    
    if (hasHorizontal && hasVertical) {
      arrangement = 'mixed'
    } else if (hasHorizontal) {
      arrangement = 'horizontal'
    } else if (hasVertical) {
      arrangement = 'vertical'
    }
  }
  
  return {
    total_monitors: monitors.length,
    primary_monitor_index: primaryIndex,
    total_area: totalArea,
    average_scale_factor: avgScaleFactor,
    arrangement,
  }
}

/**
 * 工具函数：获取显示器的实际物理尺寸（英寸）
 * 注意：这是基于标准 DPI (96) 的估算
 */
export const getPhysicalSize = (monitor: MonitorInfo): { widthInches: number; heightInches: number; diagonal: number } => {
  const DPI = 96 // 标准 Windows DPI
  const widthInches = monitor.size.logical_width / DPI
  const heightInches = monitor.size.logical_height / DPI
  const diagonal = Math.sqrt(widthInches ** 2 + heightInches ** 2)
  
  return {
    widthInches: Math.round(widthInches * 10) / 10,
    heightInches: Math.round(heightInches * 10) / 10,
    diagonal: Math.round(diagonal * 10) / 10,
  }
}

/**
 * 工具函数：检查点是否在显示器范围内
 */
export const isPointInMonitor = (x: number, y: number, monitor: MonitorInfo): boolean => {
  return (
    x >= monitor.position.x &&
    x < monitor.position.x + monitor.size.width &&
    y >= monitor.position.y &&
    y < monitor.position.y + monitor.size.height
  )
}

/**
 * 工具函数：找到包含指定点的显示器
 */
export const findMonitorAtPosition = (x: number, y: number, monitors: MonitorInfo[]): MonitorInfo | null => {
  return monitors.find(monitor => isPointInMonitor(x, y, monitor)) || null
}

/**
 * 工具函数：获取显示器的边界矩形
 */
export const getMonitorBounds = (monitor: MonitorInfo) => {
  return {
    left: monitor.position.x,
    top: monitor.position.y,
    right: monitor.position.x + monitor.size.width,
    bottom: monitor.position.y + monitor.size.height,
    width: monitor.size.width,
    height: monitor.size.height,
  }
}

/**
 * 工具函数：检查两个显示器是否相邻
 */
export const areMonitorsAdjacent = (monitor1: MonitorInfo, monitor2: MonitorInfo): boolean => {
  const bounds1 = getMonitorBounds(monitor1)
  const bounds2 = getMonitorBounds(monitor2)
  
  // 检查水平相邻
  const horizontalAdjacent = 
    (bounds1.right === bounds2.left || bounds1.left === bounds2.right) &&
    !(bounds1.bottom < bounds2.top || bounds1.top > bounds2.bottom)
  
  // 检查垂直相邻
  const verticalAdjacent = 
    (bounds1.bottom === bounds2.top || bounds1.top === bounds2.bottom) &&
    !(bounds1.right < bounds2.left || bounds1.left > bounds2.right)
  
  return horizontalAdjacent || verticalAdjacent
}

/**
 * 工具函数：格式化显示器信息为易读字符串
 */
export const formatMonitorInfo = (monitor: MonitorInfo): string => {
  const name = monitor.name || '未命名显示器'
  const resolution = `${monitor.size.width}x${monitor.size.height}`
  const scale = `${Math.round(monitor.scale_factor * 100)}%`
  const position = `(${monitor.position.x}, ${monitor.position.y})`
  const primary = monitor.is_primary ? ' [主]' : ''
  
  return `${name}${primary}: ${resolution} @ ${scale} ${position}`
}

/**
 * 工具函数：创建空的桌面信息（用于初始化）
 */
export const createEmptyDesktopInfo = (): DesktopInfo => ({
  primary_monitor: {
    name: null,
    size: {
      width: 1920,
      height: 1080,
      logical_width: 1920,
      logical_height: 1080,
    },
    position: {
      x: 0,
      y: 0,
      logical_x: 0,
      logical_y: 0,
    },
    scale_factor: 1.0,
    orientation: 'landscape',
    is_primary: true,
  },
  monitors: [],
  virtual_screen: {
    total_width: 1920,
    total_height: 1080,
    min_x: 0,
    min_y: 0,
    max_x: 1920,
    max_y: 1080,
  },
  monitor_count: 1,
  screen_width: 1920,
  screen_height: 1080,
  scale_factor: 1.0,
})

