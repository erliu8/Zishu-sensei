/**
 * API 版本管理
 * 
 * 提供 API 版本控制和兼容性管理，包括：
 * - 多版本 API 支持
 * - 版本自动协商
 * - 版本兼容性检查
 * - API 弃用警告
 * - 版本迁移辅助
 */

import type { ApiClient } from '../api'

// ================================
// 类型定义
// ================================

/**
 * API 版本
 */
export interface ApiVersion {
  version: string
  releaseDate: string
  deprecated: boolean
  deprecationDate?: string
  endOfLifeDate?: string
  breaking: boolean
  features: string[]
  changes: string[]
  migrations?: VersionMigration[]
}

/**
 * 版本迁移
 */
export interface VersionMigration {
  from: string
  to: string
  description: string
  breaking: boolean
  steps: MigrationStep[]
}

/**
 * 迁移步骤
 */
export interface MigrationStep {
  title: string
  description: string
  automated: boolean
  action?: () => Promise<void>
}

/**
 * 版本兼容性
 */
export interface VersionCompatibility {
  clientVersion: string
  serverVersion: string
  compatible: boolean
  warnings: string[]
  errors: string[]
  recommendedAction?: 'upgrade' | 'downgrade' | 'none'
}

/**
 * 版本管理配置
 */
export interface VersionManagerConfig {
  currentVersion: string
  supportedVersions: string[]
  preferredVersion?: string
  autoNegotiate?: boolean
  enableDeprecationWarnings?: boolean
  enableLogging?: boolean
}

// ================================
// 版本管理器类
// ================================

export class VersionManager {
  private config: Required<VersionManagerConfig>
  private apiClient: ApiClient
  private availableVersions: Map<string, ApiVersion> = new Map()
  private currentServerVersion: string | null = null

  constructor(apiClient: ApiClient, config: VersionManagerConfig) {
    this.apiClient = apiClient
    this.config = {
      currentVersion: config.currentVersion,
      supportedVersions: config.supportedVersions,
      preferredVersion: config.preferredVersion || config.currentVersion,
      autoNegotiate: config.autoNegotiate !== undefined ? config.autoNegotiate : true,
      enableDeprecationWarnings: config.enableDeprecationWarnings !== undefined ? config.enableDeprecationWarnings : true,
      enableLogging: config.enableLogging !== undefined ? config.enableLogging : true,
    }

    this.log('Version Manager initialized', this.config)
  }

  // ================================
  // 版本协商
  // ================================

  /**
   * 协商 API 版本
   */
  async negotiateVersion(): Promise<string> {
    this.log('Negotiating API version')

    try {
      // 获取服务器支持的版本
      const serverVersions = await this.getServerVersions()
      
      // 找到最佳匹配版本
      const bestVersion = this.findBestVersion(serverVersions)

      if (!bestVersion) {
        throw new Error('No compatible API version found')
      }

      this.log(`Negotiated version: ${bestVersion}`)
      this.currentServerVersion = bestVersion

      // 更新 API 客户端版本
      this.apiClient.updateConfig({ apiVersion: bestVersion })

      // 检查兼容性
      const compatibility = await this.checkCompatibility(this.config.currentVersion, bestVersion)
      
      if (!compatibility.compatible) {
        this.log('Version compatibility issues:', compatibility)
        
        if (compatibility.errors.length > 0) {
          throw new Error(`API version incompatible: ${compatibility.errors.join(', ')}`)
        }
      }

      // 显示弃用警告
      if (this.config.enableDeprecationWarnings) {
        await this.checkDeprecation(bestVersion)
      }

      return bestVersion
    } catch (error) {
      this.log('Version negotiation failed:', error)
      throw error
    }
  }

  /**
   * 获取服务器支持的版本
   */
  private async getServerVersions(): Promise<string[]> {
    try {
      const response = await this.apiClient.get<{ versions: string[] }>('/versions')
      
      if (response.success && response.data) {
        return response.data.versions
      }

      return []
    } catch (error) {
      this.log('Failed to get server versions:', error)
      // 降级：使用配置的版本
      return [this.config.preferredVersion]
    }
  }

  /**
   * 找到最佳版本
   */
  private findBestVersion(serverVersions: string[]): string | null {
    // 1. 尝试首选版本
    if (serverVersions.includes(this.config.preferredVersion)) {
      return this.config.preferredVersion
    }

    // 2. 尝试当前版本
    if (serverVersions.includes(this.config.currentVersion)) {
      return this.config.currentVersion
    }

    // 3. 查找支持的版本中最新的
    const supportedVersions = serverVersions.filter(v => 
      this.config.supportedVersions.includes(v)
    )

    if (supportedVersions.length === 0) {
      return null
    }

    // 按版本号排序（降序）
    supportedVersions.sort((a, b) => this.compareVersions(b, a))

    return supportedVersions[0]
  }

  // ================================
  // 版本兼容性
  // ================================

  /**
   * 检查版本兼容性
   */
  async checkCompatibility(clientVersion: string, serverVersion: string): Promise<VersionCompatibility> {
    const compatibility: VersionCompatibility = {
      clientVersion,
      serverVersion,
      compatible: true,
      warnings: [],
      errors: [],
    }

    // 获取版本信息
    const serverVersionInfo = await this.getVersionInfo(serverVersion)
    const clientVersionInfo = await this.getVersionInfo(clientVersion)

    if (!serverVersionInfo || !clientVersionInfo) {
      compatibility.compatible = false
      compatibility.errors.push('Version information not available')
      return compatibility
    }

    // 检查主版本号
    const serverMajor = this.getMajorVersion(serverVersion)
    const clientMajor = this.getMajorVersion(clientVersion)

    if (serverMajor !== clientMajor) {
      if (serverVersionInfo.breaking) {
        compatibility.compatible = false
        compatibility.errors.push('Breaking changes in server version')
        compatibility.recommendedAction = serverMajor > clientMajor ? 'upgrade' : 'downgrade'
      } else {
        compatibility.warnings.push('Different major versions, but no breaking changes')
      }
    }

    // 检查弃用
    if (serverVersionInfo.deprecated) {
      compatibility.warnings.push(
        `Server API version ${serverVersion} is deprecated` +
        (serverVersionInfo.endOfLifeDate ? ` (EOL: ${serverVersionInfo.endOfLifeDate})` : '')
      )
      compatibility.recommendedAction = 'upgrade'
    }

    if (clientVersionInfo.deprecated) {
      compatibility.warnings.push(
        `Client API version ${clientVersion} is deprecated` +
        (clientVersionInfo.endOfLifeDate ? ` (EOL: ${clientVersionInfo.endOfLifeDate})` : '')
      )
      compatibility.recommendedAction = 'upgrade'
    }

    // 检查次版本号（功能差异）
    const serverMinor = this.getMinorVersion(serverVersion)
    const clientMinor = this.getMinorVersion(clientVersion)

    if (serverMinor > clientMinor) {
      compatibility.warnings.push('Server has newer features that client may not support')
    } else if (clientMinor > serverMinor) {
      compatibility.warnings.push('Client may use features not available on server')
    }

    return compatibility
  }

  /**
   * 获取版本信息
   */
  async getVersionInfo(version: string): Promise<ApiVersion | null> {
    // 检查缓存
    if (this.availableVersions.has(version)) {
      return this.availableVersions.get(version)!
    }

    try {
      const response = await this.apiClient.get<ApiVersion>(`/versions/${version}`)
      
      if (response.success && response.data) {
        this.availableVersions.set(version, response.data)
        return response.data
      }

      return null
    } catch (error) {
      this.log(`Failed to get version info for ${version}:`, error)
      return null
    }
  }

  // ================================
  // 版本弃用
  // ================================

  /**
   * 检查版本弃用
   */
  private async checkDeprecation(version: string): Promise<void> {
    const versionInfo = await this.getVersionInfo(version)
    
    if (!versionInfo || !versionInfo.deprecated) {
      return
    }

    const message = `API version ${version} is deprecated`
    let details = ''

    if (versionInfo.deprecationDate) {
      details += `\nDeprecated since: ${versionInfo.deprecationDate}`
    }

    if (versionInfo.endOfLifeDate) {
      details += `\nEnd of life: ${versionInfo.endOfLifeDate}`
    }

    if (versionInfo.changes.length > 0) {
      details += `\nChanges: ${versionInfo.changes.join(', ')}`
    }

    console.warn(`[VersionManager] ${message}${details}`)

    // 可以触发UI通知
    // this.emit('deprecation-warning', { version, versionInfo })
  }

  // ================================
  // 版本迁移
  // ================================

  /**
   * 获取迁移路径
   */
  async getMigrationPath(from: string, to: string): Promise<VersionMigration[]> {
    const migrations: VersionMigration[] = []

    try {
      const response = await this.apiClient.get<{ migrations: VersionMigration[] }>(
        `/versions/migrations`,
        {
          params: { from, to },
        }
      )

      if (response.success && response.data) {
        migrations.push(...response.data.migrations)
      }
    } catch (error) {
      this.log('Failed to get migration path:', error)
    }

    return migrations
  }

  /**
   * 执行版本迁移
   */
  async migrate(from: string, to: string): Promise<boolean> {
    this.log(`Migrating from ${from} to ${to}`)

    try {
      const migrations = await this.getMigrationPath(from, to)

      if (migrations.length === 0) {
        this.log('No migrations needed')
        return true
      }

      for (const migration of migrations) {
        this.log(`Running migration: ${migration.from} -> ${migration.to}`)

        // 执行自动化步骤
        for (const step of migration.steps) {
          if (step.automated && step.action) {
            this.log(`Executing step: ${step.title}`)
            try {
              await step.action()
            } catch (error) {
              this.log(`Migration step failed: ${step.title}`, error)
              return false
            }
          } else {
            this.log(`Manual step required: ${step.title} - ${step.description}`)
          }
        }
      }

      this.log('Migration completed successfully')
      return true
    } catch (error) {
      this.log('Migration failed:', error)
      return false
    }
  }

  // ================================
  // 版本比较
  // ================================

  /**
   * 比较版本号
   * @returns 1 if a > b, -1 if a < b, 0 if a === b
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.replace(/[^\d.]/g, '').split('.').map(Number)
    const partsB = b.replace(/[^\d.]/g, '').split('.').map(Number)

    const maxLength = Math.max(partsA.length, partsB.length)

    for (let i = 0; i < maxLength; i++) {
      const numA = partsA[i] || 0
      const numB = partsB[i] || 0

      if (numA > numB) return 1
      if (numA < numB) return -1
    }

    return 0
  }

  /**
   * 获取主版本号
   */
  private getMajorVersion(version: string): number {
    const match = version.match(/^v?(\d+)/)
    return match ? parseInt(match[1]) : 0
  }

  /**
   * 获取次版本号
   */
  private getMinorVersion(version: string): number {
    const match = version.match(/^v?\d+\.(\d+)/)
    return match ? parseInt(match[1]) : 0
  }

  /**
   * 获取修订版本号
   */
  private getPatchVersion(version: string): number {
    const match = version.match(/^v?\d+\.\d+\.(\d+)/)
    return match ? parseInt(match[1]) : 0
  }

  // ================================
  // 版本信息
  // ================================

  /**
   * 获取当前版本
   */
  getCurrentVersion(): string {
    return this.config.currentVersion
  }

  /**
   * 获取服务器版本
   */
  getServerVersion(): string | null {
    return this.currentServerVersion
  }

  /**
   * 获取支持的版本列表
   */
  getSupportedVersions(): string[] {
    return [...this.config.supportedVersions]
  }

  /**
   * 是否支持版本
   */
  isVersionSupported(version: string): boolean {
    return this.config.supportedVersions.includes(version)
  }

  // ================================
  // 配置更新
  // ================================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VersionManagerConfig>): void {
    Object.assign(this.config, config)
    this.log('Configuration updated', config)
  }

  /**
   * 获取配置
   */
  getConfig(): Readonly<Required<VersionManagerConfig>> {
    return { ...this.config }
  }

  // ================================
  // 辅助方法
  // ================================

  /**
   * 日志记录
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[VersionManager] ${message}`, ...args)
    }
  }
}

// ================================
// 导出
// ================================

/**
 * 创建版本管理器
 */
export function createVersionManager(apiClient: ApiClient, config: VersionManagerConfig): VersionManager {
  return new VersionManager(apiClient, config)
}

/**
 * 版本工具函数
 */
export const versionUtils = {
  /**
   * 解析版本号
   */
  parseVersion(version: string): { major: number; minor: number; patch: number; prerelease?: string } {
    const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
    
    if (!match) {
      throw new Error(`Invalid version format: ${version}`)
    }

    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
      prerelease: match[4],
    }
  },

  /**
   * 格式化版本号
   */
  formatVersion(major: number, minor: number, patch: number, prerelease?: string): string {
    let version = `v${major}.${minor}.${patch}`
    if (prerelease) {
      version += `-${prerelease}`
    }
    return version
  },

  /**
   * 检查版本是否兼容（宽松模式）
   */
  isCompatible(clientVersion: string, serverVersion: string): boolean {
    try {
      const client = this.parseVersion(clientVersion)
      const server = this.parseVersion(serverVersion)

      // 主版本号必须相同
      return client.major === server.major
    } catch {
      return false
    }
  },

  /**
   * 检查版本是否严格兼容
   */
  isStrictlyCompatible(clientVersion: string, serverVersion: string): boolean {
    try {
      const client = this.parseVersion(clientVersion)
      const server = this.parseVersion(serverVersion)

      // 主版本和次版本号必须相同
      return client.major === server.major && client.minor === server.minor
    } catch {
      return false
    }
  },
}
