/**
 * 离线数据同步机制
 * 
 * 提供完整的离线数据同步功能，包括：
 * - 数据版本管理
 * - 冲突检测和解决
 * - 增量同步
 * - 同步队列管理
 * - 同步状态追踪
 * - 同步策略配置
 */

import { invoke } from '@tauri-apps/api/core'
import { EventEmitter } from 'events'
import type { ApiClient } from '../api'

// ================================
// 类型定义
// ================================

/**
 * 同步配置
 */
export interface SyncConfig {
  /** 同步间隔（毫秒） */
  syncInterval: number
  /** 批量同步大小 */
  batchSize: number
  /** 启用自动同步 */
  autoSync: boolean
  /** 启用增量同步 */
  incrementalSync: boolean
  /** 冲突解决策略 */
  conflictResolution: ConflictResolution
  /** 同步优先级 */
  priority: SyncPriority[]
  /** 启用日志 */
  enableLogging: boolean
}

/**
 * 冲突解决策略
 */
export enum ConflictResolution {
  /** 使用本地版本 */
  LOCAL_WINS = 'LOCAL_WINS',
  /** 使用远程版本 */
  REMOTE_WINS = 'REMOTE_WINS',
  /** 使用最新版本（根据时间戳） */
  LATEST_WINS = 'LATEST_WINS',
  /** 手动解决 */
  MANUAL = 'MANUAL',
  /** 合并 */
  MERGE = 'MERGE',
}

/**
 * 同步优先级
 */
export interface SyncPriority {
  entity: string
  priority: number
}

/**
 * 同步状态
 */
export enum SyncStatus {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  ERROR = 'ERROR',
  CONFLICT = 'CONFLICT',
}

/**
 * 同步项
 */
export interface SyncItem {
  id: string
  entity: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  data: any
  version: number
  timestamp: number
  deviceId: string
  synced: boolean
  retryCount: number
}

/**
 * 同步冲突
 */
export interface SyncConflict {
  id: string
  entity: string
  localData: any
  remoteData: any
  localVersion: number
  remoteVersion: number
  localTimestamp: number
  remoteTimestamp: number
  resolution?: ConflictResolution
  resolved: boolean
}

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  conflicts: number
  items: {
    entity: string
    synced: number
    failed: number
  }[]
  errors?: string[]
  duration: number
}

/**
 * 实体同步器接口
 */
export interface EntitySyncer {
  entity: string
  getLocalChanges(since: number): Promise<SyncItem[]>
  getRemoteChanges(since: number): Promise<SyncItem[]>
  applyLocalChange(item: SyncItem): Promise<void>
  applyRemoteChange(item: SyncItem): Promise<void>
  resolveConflict(conflict: SyncConflict): Promise<any>
}

/**
 * 同步事件
 */
export enum SyncEvent {
  SYNC_START = 'sync:start',
  SYNC_PROGRESS = 'sync:progress',
  SYNC_COMPLETE = 'sync:complete',
  SYNC_ERROR = 'sync:error',
  CONFLICT_DETECTED = 'conflict:detected',
  CONFLICT_RESOLVED = 'conflict:resolved',
}

// ================================
// 同步管理器类
// ================================

export class SyncManager extends EventEmitter {
  private config: SyncConfig
  private apiClient: ApiClient
  private status: SyncStatus = SyncStatus.IDLE
  private lastSyncTime: number = 0
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private syncQueue: SyncItem[] = []
  private conflicts: SyncConflict[] = []
  private syncers: Map<string, EntitySyncer> = new Map()
  private isSyncing: boolean = false

  constructor(apiClient: ApiClient, config: Partial<SyncConfig> = {}) {
    super()

    this.apiClient = apiClient
    this.config = {
      syncInterval: config.syncInterval || 60000, // 1分钟
      batchSize: config.batchSize || 50,
      autoSync: config.autoSync !== undefined ? config.autoSync : true,
      incrementalSync: config.incrementalSync !== undefined ? config.incrementalSync : true,
      conflictResolution: config.conflictResolution || ConflictResolution.LATEST_WINS,
      priority: config.priority || [],
      enableLogging: config.enableLogging !== undefined ? config.enableLogging : true,
    }

    this.log('Sync Manager initialized', this.config)

    // 加载上次同步时间和队列
    this.initialize()
  }

  // ================================
  // 初始化
  // ================================

  /**
   * 初始化同步管理器
   */
  private async initialize(): Promise<void> {
    try {
      // 加载上次同步时间
      const lastSync = await invoke<number | null>('get_last_sync_time')
      if (lastSync) {
        this.lastSyncTime = lastSync
      }

      // 加载同步队列
      await this.loadSyncQueue()

      // 加载冲突列表
      await this.loadConflicts()

      // 启动自动同步
      if (this.config.autoSync) {
        this.startAutoSync()
      }

      this.log('Sync Manager initialized successfully')
    } catch (error) {
      this.log('Failed to initialize Sync Manager:', error)
      throw error
    }
  }

  // ================================
  // 实体同步器管理
  // ================================

  /**
   * 注册实体同步器
   */
  registerSyncer(syncer: EntitySyncer): void {
    this.syncers.set(syncer.entity, syncer)
    this.log(`Entity syncer registered: ${syncer.entity}`)
  }

  /**
   * 注销实体同步器
   */
  unregisterSyncer(entity: string): void {
    this.syncers.delete(entity)
    this.log(`Entity syncer unregistered: ${entity}`)
  }

  /**
   * 获取实体同步器
   */
  getSyncer(entity: string): EntitySyncer | undefined {
    return this.syncers.get(entity)
  }

  // ================================
  // 同步操作
  // ================================

  /**
   * 执行同步
   */
  async sync(entities?: string[]): Promise<SyncResult> {
    if (this.isSyncing) {
      this.log('Sync already in progress')
      throw new Error('Sync already in progress')
    }

    this.isSyncing = true
    this.status = SyncStatus.SYNCING

    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      items: [],
      duration: 0,
    }

    this.log('Sync started', { entities })
    this.emit(SyncEvent.SYNC_START, { entities })

    try {
      // 确定要同步的实体
      const entitiesToSync = entities || Array.from(this.syncers.keys())

      // 按优先级排序
      const sortedEntities = this.sortByPriority(entitiesToSync)

      // 同步每个实体
      for (const entity of sortedEntities) {
        const syncer = this.syncers.get(entity)
        if (!syncer) {
          this.log(`No syncer found for entity: ${entity}`)
          continue
        }

        this.log(`Syncing entity: ${entity}`)

        const entityResult = await this.syncEntity(syncer)
        result.items.push(entityResult)
        result.synced += entityResult.synced
        result.failed += entityResult.failed

        // 触发进度事件
        this.emit(SyncEvent.SYNC_PROGRESS, {
          entity,
          synced: entityResult.synced,
          failed: entityResult.failed,
        })
      }

      // 处理同步队列
      await this.processSyncQueue()

      // 更新最后同步时间
      this.lastSyncTime = Date.now()
      await invoke('save_last_sync_time', { timestamp: this.lastSyncTime })

      result.conflicts = this.conflicts.length
      result.duration = Date.now() - startTime

      this.log('Sync completed', result)
      this.emit(SyncEvent.SYNC_COMPLETE, result)

      this.status = SyncStatus.IDLE
    } catch (error) {
      this.log('Sync failed:', error)
      
      result.success = false
      result.errors = [(error as Error).message]
      result.duration = Date.now() - startTime

      this.status = SyncStatus.ERROR
      this.emit(SyncEvent.SYNC_ERROR, error)
    } finally {
      this.isSyncing = false
    }

    return result
  }

  /**
   * 同步单个实体
   */
  private async syncEntity(syncer: EntitySyncer): Promise<{ entity: string; synced: number; failed: number }> {
    const result = {
      entity: syncer.entity,
      synced: 0,
      failed: 0,
    }

    try {
      // 1. 获取本地变更
      const localChanges = await syncer.getLocalChanges(this.lastSyncTime)
      this.log(`Local changes for ${syncer.entity}:`, localChanges.length)

      // 2. 上传本地变更到服务器
      for (const change of localChanges) {
        try {
          await this.uploadChange(syncer, change)
          result.synced++
        } catch (error) {
          this.log(`Failed to upload change:`, error)
          result.failed++
          
          // 加入同步队列
          this.syncQueue.push(change)
        }
      }

      // 3. 获取远程变更
      const remoteChanges = await syncer.getRemoteChanges(this.lastSyncTime)
      this.log(`Remote changes for ${syncer.entity}:`, remoteChanges.length)

      // 4. 应用远程变更到本地
      for (const change of remoteChanges) {
        try {
          // 检测冲突
          const conflict = await this.detectConflict(syncer, change)
          if (conflict) {
            this.log('Conflict detected:', conflict)
            this.conflicts.push(conflict)
            this.emit(SyncEvent.CONFLICT_DETECTED, conflict)
            
            // 根据策略解决冲突
            if (this.config.conflictResolution !== ConflictResolution.MANUAL) {
              await this.resolveConflict(syncer, conflict)
            }
          } else {
            await syncer.applyRemoteChange(change)
            result.synced++
          }
        } catch (error) {
          this.log(`Failed to apply remote change:`, error)
          result.failed++
        }
      }
    } catch (error) {
      this.log(`Failed to sync entity ${syncer.entity}:`, error)
      throw error
    }

    return result
  }

  /**
   * 上传变更到服务器
   */
  private async uploadChange(syncer: EntitySyncer, change: SyncItem): Promise<void> {
    const endpoint = `/sync/${syncer.entity}`
    
    await this.apiClient.post(endpoint, {
      operation: change.operation,
      data: change.data,
      version: change.version,
      timestamp: change.timestamp,
      deviceId: change.deviceId,
    })
  }

  /**
   * 检测冲突
   */
  private async detectConflict(syncer: EntitySyncer, remoteChange: SyncItem): Promise<SyncConflict | null> {
    try {
      // 获取本地数据
      const localData = await invoke<any>('get_entity_data', {
        entity: syncer.entity,
        id: remoteChange.id,
      })

      if (!localData) {
        return null
      }

      // 检查版本是否冲突
      if (localData.version !== remoteChange.version - 1) {
        return {
          id: remoteChange.id,
          entity: syncer.entity,
          localData: localData.data,
          remoteData: remoteChange.data,
          localVersion: localData.version,
          remoteVersion: remoteChange.version,
          localTimestamp: localData.timestamp,
          remoteTimestamp: remoteChange.timestamp,
          resolved: false,
        }
      }

      return null
    } catch (error) {
      this.log('Error detecting conflict:', error)
      return null
    }
  }

  /**
   * 解决冲突
   */
  private async resolveConflict(syncer: EntitySyncer, conflict: SyncConflict): Promise<void> {
    this.log('Resolving conflict:', conflict.id, this.config.conflictResolution)

    try {
      let resolvedData: any

      switch (this.config.conflictResolution) {
        case ConflictResolution.LOCAL_WINS:
          resolvedData = conflict.localData
          break

        case ConflictResolution.REMOTE_WINS:
          resolvedData = conflict.remoteData
          break

        case ConflictResolution.LATEST_WINS:
          resolvedData = conflict.localTimestamp > conflict.remoteTimestamp
            ? conflict.localData
            : conflict.remoteData
          break

        case ConflictResolution.MERGE:
          resolvedData = await syncer.resolveConflict(conflict)
          break

        default:
          this.log('Manual conflict resolution required')
          return
      }

      // 应用解决方案
      await invoke('update_entity_data', {
        entity: syncer.entity,
        id: conflict.id,
        data: resolvedData,
        version: Math.max(conflict.localVersion, conflict.remoteVersion) + 1,
        timestamp: Date.now(),
      })

      conflict.resolved = true
      conflict.resolution = this.config.conflictResolution

      this.log('Conflict resolved:', conflict.id)
      this.emit(SyncEvent.CONFLICT_RESOLVED, conflict)

      // 从冲突列表中移除
      const index = this.conflicts.findIndex(c => c.id === conflict.id)
      if (index !== -1) {
        this.conflicts.splice(index, 1)
      }

      // 保存冲突列表
      await this.saveConflicts()
    } catch (error) {
      this.log('Failed to resolve conflict:', error)
      throw error
    }
  }

  // ================================
  // 同步队列管理
  // ================================

  /**
   * 添加到同步队列
   */
  async addToSyncQueue(item: SyncItem): Promise<void> {
    this.syncQueue.push(item)
    await this.saveSyncQueue()
    this.log('Item added to sync queue:', item.id)
  }

  /**
   * 处理同步队列
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) {
      return
    }

    this.log(`Processing sync queue (${this.syncQueue.length} items)`)

    const queue = [...this.syncQueue]
    this.syncQueue = []

    for (const item of queue) {
      const syncer = this.syncers.get(item.entity)
      if (!syncer) {
        this.log(`No syncer found for entity: ${item.entity}`)
        continue
      }

      try {
        await this.uploadChange(syncer, item)
        this.log('Queued item synced:', item.id)
      } catch (error) {
        this.log('Failed to sync queued item:', error)
        
        // 重新入队（有限次数）
        if (item.retryCount < 3) {
          item.retryCount++
          this.syncQueue.push(item)
        }
      }
    }

    await this.saveSyncQueue()
  }

  /**
   * 保存同步队列
   */
  private async saveSyncQueue(): Promise<void> {
    try {
      await invoke('save_sync_queue', {
        queue: JSON.stringify(this.syncQueue),
      })
    } catch (error) {
      this.log('Failed to save sync queue:', error)
    }
  }

  /**
   * 加载同步队列
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const queueStr = await invoke<string>('load_sync_queue')
      if (queueStr) {
        this.syncQueue = JSON.parse(queueStr)
        this.log(`Loaded sync queue (${this.syncQueue.length} items)`)
      }
    } catch (error) {
      this.log('Failed to load sync queue:', error)
    }
  }

  // ================================
  // 冲突管理
  // ================================

  /**
   * 获取所有冲突
   */
  getConflicts(): ReadonlyArray<SyncConflict> {
    return [...this.conflicts]
  }

  /**
   * 手动解决冲突
   */
  async manualResolveConflict(conflictId: string, resolution: ConflictResolution, data?: any): Promise<void> {
    const conflict = this.conflicts.find(c => c.id === conflictId)
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`)
    }

    const syncer = this.syncers.get(conflict.entity)
    if (!syncer) {
      throw new Error(`No syncer found for entity: ${conflict.entity}`)
    }

    // 应用自定义解决方案
    if (data) {
      await invoke('update_entity_data', {
        entity: conflict.entity,
        id: conflict.id,
        data,
        version: Math.max(conflict.localVersion, conflict.remoteVersion) + 1,
        timestamp: Date.now(),
      })
    } else {
      // 使用指定的策略
      const originalResolution = this.config.conflictResolution
      this.config.conflictResolution = resolution
      await this.resolveConflict(syncer, conflict)
      this.config.conflictResolution = originalResolution
    }
  }

  /**
   * 保存冲突列表
   */
  private async saveConflicts(): Promise<void> {
    try {
      await invoke('save_conflicts', {
        conflicts: JSON.stringify(this.conflicts),
      })
    } catch (error) {
      this.log('Failed to save conflicts:', error)
    }
  }

  /**
   * 加载冲突列表
   */
  private async loadConflicts(): Promise<void> {
    try {
      const conflictsStr = await invoke<string>('load_conflicts')
      if (conflictsStr) {
        this.conflicts = JSON.parse(conflictsStr)
        this.log(`Loaded conflicts (${this.conflicts.length} items)`)
      }
    } catch (error) {
      this.log('Failed to load conflicts:', error)
    }
  }

  // ================================
  // 自动同步
  // ================================

  /**
   * 启动自动同步
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      this.log('Auto sync already started')
      return
    }

    this.log(`Starting auto sync (interval: ${this.config.syncInterval}ms)`)

    this.syncTimer = setInterval(() => {
      if (!this.isSyncing) {
        this.sync().catch(error => {
          this.log('Auto sync failed:', error)
        })
      }
    }, this.config.syncInterval)
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
      this.log('Auto sync stopped')
    }
  }

  // ================================
  // 状态管理
  // ================================

  /**
   * 获取同步状态
   */
  getStatus(): SyncStatus {
    return this.status
  }

  /**
   * 是否正在同步
   */
  isSyncInProgress(): boolean {
    return this.isSyncing
  }

  /**
   * 获取最后同步时间
   */
  getLastSyncTime(): number {
    return this.lastSyncTime
  }

  // ================================
  // 辅助方法
  // ================================

  /**
   * 按优先级排序实体
   */
  private sortByPriority(entities: string[]): string[] {
    return entities.sort((a, b) => {
      const priorityA = this.config.priority.find(p => p.entity === a)?.priority || 0
      const priorityB = this.config.priority.find(p => p.entity === b)?.priority || 0
      return priorityB - priorityA
    })
  }

  /**
   * 日志记录
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[SyncManager] ${message}`, ...args)
    }
  }

  // ================================
  // 清理
  // ================================

  /**
   * 销毁同步管理器
   */
  destroy(): void {
    this.log('Destroying Sync Manager')
    
    // 停止自动同步
    this.stopAutoSync()

    // 保存状态
    this.saveSyncQueue()
    this.saveConflicts()

    // 清理
    this.syncers.clear()
    this.removeAllListeners()
  }
}

// ================================
// 导出
// ================================

/**
 * 创建同步管理器
 */
export function createSyncManager(apiClient: ApiClient, config?: Partial<SyncConfig>): SyncManager {
  return new SyncManager(apiClient, config)
}

/**
 * 导出类型
 */
export type {
  SyncConfig,
  SyncItem,
  SyncConflict,
  SyncResult,
  EntitySyncer,
}

