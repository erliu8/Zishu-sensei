/**
 * Live2D 模型内存管理器
 * 提供 Live2D 模型的内存优化、资源管理和缓存控制
 */

import memoryService from '../services/memoryService';

/**
 * Live2D 模型资源信息
 */
export interface Live2DModelResource {
  /** 模型ID */
  id: string;
  /** 模型名称 */
  name: string;
  /** 内存占用（字节） */
  memorySize: number;
  /** 纹理数量 */
  textureCount: number;
  /** 纹理总大小（字节） */
  textureSize: number;
  /** 最后使用时间 */
  lastUsed: number;
  /** 是否已加载 */
  loaded: boolean;
  /** 加载时间 */
  loadTime?: number;
}

/**
 * Live2D 内存池配置
 */
export interface Live2DMemoryConfig {
  /** 最大同时加载模型数 */
  maxLoadedModels: number;
  /** 纹理缓存大小（字节） */
  textureCacheSize: number;
  /** 是否启用纹理压缩 */
  textureCompression: boolean;
  /** 空闲模型卸载时间（秒） */
  idleUnloadTime: number;
  /** 是否启用预加载 */
  preloadEnabled: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Live2DMemoryConfig = {
  maxLoadedModels: 3,
  textureCacheSize: 100 * 1024 * 1024, // 100MB
  textureCompression: true,
  idleUnloadTime: 300, // 5分钟
  preloadEnabled: true,
};

/**
 * Live2D 模型内存管理器类
 */
export class Live2DMemoryManager {
  private static instance: Live2DMemoryManager;
  private config: Live2DMemoryConfig;
  private loadedModels: Map<string, Live2DModelResource>;
  private textureCache: Map<string, { data: any; size: number; lastUsed: number }>;
  private currentTextureCacheSize: number;
  private idleCheckTimer: number | null;

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadedModels = new Map();
    this.textureCache = new Map();
    this.currentTextureCacheSize = 0;
    this.idleCheckTimer = null;
    this.initialize();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): Live2DMemoryManager {
    if (!Live2DMemoryManager.instance) {
      Live2DMemoryManager.instance = new Live2DMemoryManager();
    }
    return Live2DMemoryManager.instance;
  }

  /**
   * 初始化
   */
  private async initialize() {
    try {
      // 注册内存池
      await memoryService.registerMemoryPool('live2d_models', this.config.maxLoadedModels);
      await memoryService.registerMemoryPool(
        'live2d_textures',
        Math.floor(this.config.textureCacheSize / (1024 * 1024))
      );

      // 启动空闲检查
      this.startIdleCheck();

      console.log('Live2D 内存管理器初始化完成');
    } catch (error) {
      console.error('Live2D 内存管理器初始化失败:', error);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<Live2DMemoryConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.enforceMemoryLimits();
  }

  /**
   * 获取当前配置
   */
  getConfig(): Live2DMemoryConfig {
    return { ...this.config };
  }

  /**
   * 注册模型加载
   */
  async registerModel(resource: Live2DModelResource): Promise<boolean> {
    try {
      // 检查是否超过最大加载数
      if (this.loadedModels.size >= this.config.maxLoadedModels && !this.loadedModels.has(resource.id)) {
        // 卸载最旧的模型
        await this.unloadOldestModel();
      }

      // 更新模型信息
      resource.loaded = true;
      resource.lastUsed = Date.now();
      this.loadedModels.set(resource.id, resource);

      // 更新内存池统计
      const totalMemory = Array.from(this.loadedModels.values()).reduce(
        (sum, model) => sum + model.memorySize,
        0
      );
      await memoryService.updateMemoryPoolStats('live2d_models', this.loadedModels.size, totalMemory);

      console.log(`模型 ${resource.name} 已注册，当前加载 ${this.loadedModels.size} 个模型`);
      return true;
    } catch (error) {
      console.error('注册模型失败:', error);
      return false;
    }
  }

  /**
   * 卸载模型
   */
  async unloadModel(modelId: string): Promise<boolean> {
    try {
      const model = this.loadedModels.get(modelId);
      if (!model) {
        return false;
      }

      // 清理纹理缓存
      this.clearModelTextures(modelId);

      // 移除模型
      this.loadedModels.delete(modelId);

      // 更新内存池统计
      const totalMemory = Array.from(this.loadedModels.values()).reduce(
        (sum, model) => sum + model.memorySize,
        0
      );
      await memoryService.updateMemoryPoolStats('live2d_models', this.loadedModels.size, totalMemory);

      console.log(`模型 ${model.name} 已卸载`);
      return true;
    } catch (error) {
      console.error('卸载模型失败:', error);
      return false;
    }
  }

  /**
   * 卸载最旧的模型
   */
  private async unloadOldestModel(): Promise<void> {
    let oldestModel: Live2DModelResource | null = null;
    let oldestTime = Infinity;

    for (const model of this.loadedModels.values()) {
      if (model.lastUsed < oldestTime) {
        oldestTime = model.lastUsed;
        oldestModel = model;
      }
    }

    if (oldestModel) {
      await this.unloadModel(oldestModel.id);
    }
  }

  /**
   * 更新模型使用时间
   */
  updateModelUsage(modelId: string): void {
    const model = this.loadedModels.get(modelId);
    if (model) {
      model.lastUsed = Date.now();
    }
  }

  /**
   * 缓存纹理
   */
  cacheTexture(key: string, data: any, size: number): boolean {
    try {
      // 检查缓存大小限制
      if (this.currentTextureCacheSize + size > this.config.textureCacheSize) {
        this.evictOldTextures(size);
      }

      this.textureCache.set(key, {
        data,
        size,
        lastUsed: Date.now(),
      });
      this.currentTextureCacheSize += size;

      // 更新内存池统计
      memoryService
        .updateMemoryPoolStats('live2d_textures', this.textureCache.size, this.currentTextureCacheSize)
        .catch(console.error);

      return true;
    } catch (error) {
      console.error('缓存纹理失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存的纹理
   */
  getCachedTexture(key: string): any | null {
    const cached = this.textureCache.get(key);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.data;
    }
    return null;
  }

  /**
   * 淘汰旧纹理
   */
  private evictOldTextures(requiredSize: number): void {
    // 按最后使用时间排序
    const entries = Array.from(this.textureCache.entries()).sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed
    );

    let freedSize = 0;
    for (const [key, value] of entries) {
      if (freedSize >= requiredSize) {
        break;
      }
      this.textureCache.delete(key);
      this.currentTextureCacheSize -= value.size;
      freedSize += value.size;
    }

    console.log(`淘汰纹理缓存，释放 ${(freedSize / 1024 / 1024).toFixed(2)} MB`);
  }

  /**
   * 清理模型的纹理
   */
  private clearModelTextures(modelId: string): void {
    let clearedSize = 0;
    for (const [key, value] of this.textureCache.entries()) {
      if (key.startsWith(`${modelId}_`)) {
        this.textureCache.delete(key);
        this.currentTextureCacheSize -= value.size;
        clearedSize += value.size;
      }
    }

    if (clearedSize > 0) {
      console.log(`清理模型 ${modelId} 的纹理缓存，释放 ${(clearedSize / 1024 / 1024).toFixed(2)} MB`);
    }
  }

  /**
   * 启动空闲检查
   */
  private startIdleCheck(): void {
    if (this.idleCheckTimer !== null) {
      return;
    }

    this.idleCheckTimer = window.setInterval(() => {
      this.checkIdleModels();
    }, 60000); // 每分钟检查一次
  }

  /**
   * 停止空闲检查
   */
  stopIdleCheck(): void {
    if (this.idleCheckTimer !== null) {
      window.clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
  }

  /**
   * 检查空闲模型
   */
  private async checkIdleModels(): Promise<void> {
    const now = Date.now();
    const idleThreshold = this.config.idleUnloadTime * 1000;

    for (const [modelId, model] of this.loadedModels.entries()) {
      if (now - model.lastUsed > idleThreshold) {
        console.log(`模型 ${model.name} 已空闲 ${this.config.idleUnloadTime} 秒，自动卸载`);
        await this.unloadModel(modelId);
      }
    }
  }

  /**
   * 强制内存限制
   */
  private enforceMemoryLimits(): void {
    // 检查模型数量
    while (this.loadedModels.size > this.config.maxLoadedModels) {
      this.unloadOldestModel();
    }

    // 检查纹理缓存大小
    if (this.currentTextureCacheSize > this.config.textureCacheSize) {
      const excessSize = this.currentTextureCacheSize - this.config.textureCacheSize;
      this.evictOldTextures(excessSize);
    }
  }

  /**
   * 获取内存统计
   */
  getMemoryStats(): {
    loadedModels: number;
    totalModelMemory: number;
    cachedTextures: number;
    totalTextureMemory: number;
  } {
    const totalModelMemory = Array.from(this.loadedModels.values()).reduce(
      (sum, model) => sum + model.memorySize,
      0
    );

    return {
      loadedModels: this.loadedModels.size,
      totalModelMemory,
      cachedTextures: this.textureCache.size,
      totalTextureMemory: this.currentTextureCacheSize,
    };
  }

  /**
   * 获取已加载的模型列表
   */
  getLoadedModels(): Live2DModelResource[] {
    return Array.from(this.loadedModels.values());
  }

  /**
   * 清理所有资源
   */
  async cleanup(): Promise<void> {
    try {
      // 卸载所有模型
      const modelIds = Array.from(this.loadedModels.keys());
      for (const modelId of modelIds) {
        await this.unloadModel(modelId);
      }

      // 清理纹理缓存
      this.textureCache.clear();
      this.currentTextureCacheSize = 0;

      // 停止空闲检查
      this.stopIdleCheck();

      console.log('Live2D 内存管理器已清理');
    } catch (error) {
      console.error('清理 Live2D 资源失败:', error);
    }
  }
}

// 导出单例实例
export const live2dMemoryManager = Live2DMemoryManager.getInstance();
export default live2dMemoryManager;

