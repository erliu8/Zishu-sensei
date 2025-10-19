/**
 * 内存管理服务
 * 提供前端与后端内存管理系统的接口封装
 */

import { invoke } from '@tauri-apps/api/tauri';
import {
  MemoryInfo,
  MemoryPoolStats,
  MemorySnapshot,
  MemoryLeakInfo,
  MemoryCleanupResult,
  MemoryThresholds,
  MemoryStatus,
  MemorySummary,
  MemoryPoolConfig,
} from '../types/memory';

/**
 * 内存管理服务类
 */
class MemoryService {
  /**
   * 获取当前内存信息
   */
  async getMemoryInfo(): Promise<MemoryInfo> {
    try {
      return await invoke<MemoryInfo>('get_memory_info');
    } catch (error) {
      console.error('获取内存信息失败:', error);
      throw error;
    }
  }

  /**
   * 注册内存池
   */
  async registerMemoryPool(name: string, capacity: number): Promise<void> {
    try {
      await invoke('register_memory_pool', { name, capacity });
    } catch (error) {
      console.error('注册内存池失败:', error);
      throw error;
    }
  }

  /**
   * 更新内存池统计
   */
  async updateMemoryPoolStats(
    name: string,
    allocatedCount: number,
    totalBytes: number
  ): Promise<void> {
    try {
      await invoke('update_memory_pool_stats', {
        name,
        allocatedCount,
        totalBytes,
      });
    } catch (error) {
      console.error('更新内存池统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有内存池统计
   */
  async getMemoryPoolStats(): Promise<MemoryPoolStats[]> {
    try {
      return await invoke<MemoryPoolStats[]>('get_memory_pool_stats');
    } catch (error) {
      console.error('获取内存池统计失败:', error);
      throw error;
    }
  }

  /**
   * 创建内存快照
   */
  async createMemorySnapshot(): Promise<MemorySnapshot> {
    try {
      return await invoke<MemorySnapshot>('create_memory_snapshot');
    } catch (error) {
      console.error('创建内存快照失败:', error);
      throw error;
    }
  }

  /**
   * 获取内存快照历史
   */
  async getMemorySnapshots(limit: number = 50): Promise<MemorySnapshot[]> {
    try {
      return await invoke<MemorySnapshot[]>('get_memory_snapshots', { limit });
    } catch (error) {
      console.error('获取内存快照历史失败:', error);
      throw error;
    }
  }

  /**
   * 检测内存泄漏
   */
  async detectMemoryLeaks(): Promise<MemoryLeakInfo[]> {
    try {
      return await invoke<MemoryLeakInfo[]>('detect_memory_leaks');
    } catch (error) {
      console.error('检测内存泄漏失败:', error);
      throw error;
    }
  }

  /**
   * 获取内存泄漏报告
   */
  async getMemoryLeakReports(limit: number = 20): Promise<MemoryLeakInfo[]> {
    try {
      return await invoke<MemoryLeakInfo[]>('get_memory_leak_reports', { limit });
    } catch (error) {
      console.error('获取内存泄漏报告失败:', error);
      throw error;
    }
  }

  /**
   * 执行内存清理
   */
  async cleanupMemory(): Promise<MemoryCleanupResult> {
    try {
      return await invoke<MemoryCleanupResult>('cleanup_memory');
    } catch (error) {
      console.error('执行内存清理失败:', error);
      throw error;
    }
  }

  /**
   * 设置内存阈值
   */
  async setMemoryThresholds(thresholds: MemoryThresholds): Promise<void> {
    try {
      await invoke('set_memory_thresholds', { thresholds });
    } catch (error) {
      console.error('设置内存阈值失败:', error);
      throw error;
    }
  }

  /**
   * 获取内存阈值
   */
  async getMemoryThresholds(): Promise<MemoryThresholds> {
    try {
      return await invoke<MemoryThresholds>('get_memory_thresholds');
    } catch (error) {
      console.error('获取内存阈值失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否需要自动清理
   */
  async shouldAutoCleanupMemory(): Promise<boolean> {
    try {
      return await invoke<boolean>('should_auto_cleanup_memory');
    } catch (error) {
      console.error('检查自动清理失败:', error);
      throw error;
    }
  }

  /**
   * 获取内存状态
   */
  async getMemoryStatus(): Promise<MemoryStatus> {
    try {
      return await invoke<MemoryStatus>('get_memory_status');
    } catch (error) {
      console.error('获取内存状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取内存统计摘要
   */
  async getMemorySummary(): Promise<MemorySummary> {
    try {
      return await invoke<MemorySummary>('get_memory_summary');
    } catch (error) {
      console.error('获取内存统计摘要失败:', error);
      throw error;
    }
  }

  /**
   * 批量注册内存池
   */
  async registerMemoryPools(configs: MemoryPoolConfig[]): Promise<void> {
    try {
      await Promise.all(
        configs.map(config =>
          config.enabled ? this.registerMemoryPool(config.name, config.capacity) : Promise.resolve()
        )
      );
    } catch (error) {
      console.error('批量注册内存池失败:', error);
      throw error;
    }
  }

  /**
   * 启动自动清理
   */
  startAutoCleanup(interval: number = 300000): number {
    return window.setInterval(async () => {
      try {
        const shouldCleanup = await this.shouldAutoCleanupMemory();
        if (shouldCleanup) {
          console.log('触发自动内存清理...');
          const result = await this.cleanupMemory();
          console.log('自动清理完成:', result);
        }
      } catch (error) {
        console.error('自动清理失败:', error);
      }
    }, interval);
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup(timerId: number): void {
    window.clearInterval(timerId);
  }

  /**
   * 启动内存泄漏检测
   */
  startLeakDetection(interval: number = 600000): number {
    return window.setInterval(async () => {
      try {
        console.log('执行内存泄漏检测...');
        const leaks = await this.detectMemoryLeaks();
        if (leaks.length > 0) {
          console.warn('检测到内存泄漏:', leaks);
          // 可以在这里触发通知或其他处理
        }
      } catch (error) {
        console.error('内存泄漏检测失败:', error);
      }
    }, interval);
  }

  /**
   * 停止内存泄漏检测
   */
  stopLeakDetection(timerId: number): void {
    window.clearInterval(timerId);
  }

  /**
   * 启动快照采集
   */
  startSnapshotCollection(interval: number = 60000): number {
    return window.setInterval(async () => {
      try {
        await this.createMemorySnapshot();
      } catch (error) {
        console.error('创建内存快照失败:', error);
      }
    }, interval);
  }

  /**
   * 停止快照采集
   */
  stopSnapshotCollection(timerId: number): void {
    window.clearInterval(timerId);
  }
}

// 导出单例
export const memoryService = new MemoryService();
export default memoryService;

