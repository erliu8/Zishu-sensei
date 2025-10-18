/**
 * 显示器服务
 * 
 * 提供显示器和桌面信息的获取功能，包括：
 * - 获取完整的桌面信息
 * - 获取特定位置的显示器
 * - 获取主显示器信息
 * - 获取所有显示器列表
 */

import { invoke } from '@tauri-apps/api/core'
import type { DesktopInfo, MonitorInfo } from '@/types/monitor'

/**
 * API 响应包装类型
 */
interface CommandResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

/**
 * 显示器服务类
 */
export class MonitorService {
  /**
   * 获取完整的桌面信息
   * 
   * 包含主显示器、所有显示器列表、虚拟屏幕信息等
   * 
   * @returns 桌面信息
   * @throws 如果获取失败
   */
  async getDesktopInfo(): Promise<DesktopInfo> {
    try {
      const response = await invoke<CommandResponse<DesktopInfo>>('get_desktop_info')
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '获取桌面信息失败')
      }
      
      return response.data
    } catch (error) {
      console.error('[MonitorService] 获取桌面信息失败:', error)
      throw error
    }
  }

  /**
   * 获取指定位置的显示器信息
   * 
   * @param x - X 坐标（物理像素）
   * @param y - Y 坐标（物理像素）
   * @returns 显示器信息，如果位置不在任何显示器内则返回 null
   * @throws 如果获取失败
   */
  async getMonitorAtPosition(x: number, y: number): Promise<MonitorInfo | null> {
    try {
      const response = await invoke<CommandResponse<MonitorInfo | null>>(
        'get_monitor_at_position',
        { x, y }
      )
      
      if (!response.success) {
        throw new Error(response.error || '获取显示器信息失败')
      }
      
      return response.data || null
    } catch (error) {
      console.error(`[MonitorService] 获取位置 (${x}, ${y}) 的显示器失败:`, error)
      throw error
    }
  }

  /**
   * 获取主显示器信息
   * 
   * @returns 主显示器信息
   * @throws 如果获取失败
   */
  async getPrimaryMonitor(): Promise<MonitorInfo> {
    try {
      const response = await invoke<CommandResponse<MonitorInfo>>('get_primary_monitor')
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '获取主显示器信息失败')
      }
      
      return response.data
    } catch (error) {
      console.error('[MonitorService] 获取主显示器失败:', error)
      throw error
    }
  }

  /**
   * 获取所有显示器信息
   * 
   * @returns 所有显示器信息列表
   * @throws 如果获取失败
   */
  async getAllMonitors(): Promise<MonitorInfo[]> {
    try {
      const response = await invoke<CommandResponse<MonitorInfo[]>>('get_all_monitors')
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '获取显示器列表失败')
      }
      
      return response.data
    } catch (error) {
      console.error('[MonitorService] 获取所有显示器失败:', error)
      throw error
    }
  }

  /**
   * 获取当前窗口所在的显示器
   * 
   * @param windowX - 窗口 X 坐标
   * @param windowY - 窗口 Y 坐标
   * @returns 窗口所在的显示器信息
   */
  async getWindowMonitor(windowX: number, windowY: number): Promise<MonitorInfo | null> {
    return await this.getMonitorAtPosition(windowX, windowY)
  }

  /**
   * 检测显示器配置变化
   * 
   * 比较新旧桌面信息，检测显示器的添加、移除或配置变化
   * 
   * @param oldInfo - 旧的桌面信息
   * @param newInfo - 新的桌面信息
   * @returns 变化检测结果
   */
  detectChanges(oldInfo: DesktopInfo, newInfo: DesktopInfo): {
    hasChanges: boolean
    added: MonitorInfo[]
    removed: MonitorInfo[]
    modified: MonitorInfo[]
  } {
    const added: MonitorInfo[] = []
    const removed: MonitorInfo[] = []
    const modified: MonitorInfo[] = []

    // 检查新增的显示器
    for (const newMonitor of newInfo.monitors) {
      const oldMonitor = oldInfo.monitors.find(m => m.name === newMonitor.name)
      if (!oldMonitor) {
        added.push(newMonitor)
      } else {
        // 检查配置是否变化
        if (
          oldMonitor.size.width !== newMonitor.size.width ||
          oldMonitor.size.height !== newMonitor.size.height ||
          oldMonitor.position.x !== newMonitor.position.x ||
          oldMonitor.position.y !== newMonitor.position.y ||
          oldMonitor.scale_factor !== newMonitor.scale_factor
        ) {
          modified.push(newMonitor)
        }
      }
    }

    // 检查移除的显示器
    for (const oldMonitor of oldInfo.monitors) {
      const newMonitor = newInfo.monitors.find(m => m.name === oldMonitor.name)
      if (!newMonitor) {
        removed.push(oldMonitor)
      }
    }

    return {
      hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0,
      added,
      removed,
      modified,
    }
  }

  /**
   * 格式化桌面信息为易读的调试字符串
   * 
   * @param desktopInfo - 桌面信息
   * @returns 格式化的字符串
   */
  formatDesktopInfo(desktopInfo: DesktopInfo): string {
    const lines: string[] = [
      '=== 桌面信息 ===',
      `显示器数量: ${desktopInfo.monitor_count}`,
      `虚拟屏幕: ${desktopInfo.virtual_screen.total_width}x${desktopInfo.virtual_screen.total_height}`,
      '',
      '显示器列表:',
    ]

    desktopInfo.monitors.forEach((monitor, index) => {
      const primary = monitor.is_primary ? ' [主]' : ''
      const name = monitor.name || `显示器 ${index + 1}`
      lines.push(`  ${name}${primary}:`)
      lines.push(`    分辨率: ${monitor.size.width}x${monitor.size.height} (物理)`)
      lines.push(`    逻辑尺寸: ${monitor.size.logical_width}x${monitor.size.logical_height}`)
      lines.push(`    位置: (${monitor.position.x}, ${monitor.position.y})`)
      lines.push(`    缩放: ${Math.round(monitor.scale_factor * 100)}%`)
      lines.push(`    方向: ${monitor.orientation}`)
    })

    return lines.join('\n')
  }
}

/**
 * 单例实例
 */
export const monitorService = new MonitorService()

/**
 * 便捷方法
 */
export const getDesktopInfo = () => monitorService.getDesktopInfo()
export const getMonitorAtPosition = (x: number, y: number) => monitorService.getMonitorAtPosition(x, y)
export const getPrimaryMonitor = () => monitorService.getPrimaryMonitor()
export const getAllMonitors = () => monitorService.getAllMonitors()

/**
 * 默认导出
 */
export default monitorService

