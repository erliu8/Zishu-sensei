/**
 * WebGL 渲染优化器
 * 
 * 提供 WebGL 渲染性能优化，包括纹理管理、批量渲染和 LOD 控制
 */

import type {
  WebGLConfig,
  TexturePoolConfig,
  TextureInfo,
  WebGLStats,
  LODConfig,
} from '../types/rendering';
import {
  calculateTextureMemory,
  getLODLevel,
  getOptimalTextureSize,
  supportsGPUAcceleration,
} from '../types/rendering';
import { renderingService } from '../services/renderingService';

// ============================================================================
// 纹理池管理器
// ============================================================================

class TexturePool {
  private textures: Map<string, TextureInfo> = new Map();
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private config: TexturePoolConfig;
  private lruQueue: string[] = [];

  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    config: TexturePoolConfig
  ) {
    this.gl = gl;
    this.config = config;
  }

  /**
   * 加载纹理
   */
  async loadTexture(id: string, path: string): Promise<TextureInfo | null> {
    if (!this.gl) return null;

    // 检查缓存
    const cached = this.textures.get(id);
    if (cached && cached.isLoaded) {
      this.updateLRU(id);
      return cached;
    }

    // 检查纹理数量限制
    if (this.textures.size >= this.config.maxTextures) {
      this.evictOldest();
    }

    try {
      // 加载图片
      const image = await this.loadImage(path);
      
      // 创建纹理
      const glTexture = this.gl.createTexture();
      if (!glTexture) {
        throw new Error('创建纹理失败');
      }

      this.gl.bindTexture(this.gl.TEXTURE_2D, glTexture);

      // 获取最优纹理大小
      const optimalSize = getOptimalTextureSize(
        image.width,
        image.height,
        this.config.maxTextureSize || 4096
      );

      // 如果需要调整大小
      let textureImage = image;
      if (optimalSize.width !== image.width || optimalSize.height !== image.height) {
        textureImage = this.resizeImage(image, optimalSize.width, optimalSize.height);
      }

      // 上传纹理
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        textureImage
      );

      // 设置纹理参数
      this.setupTextureParameters();

      // 生成 Mipmap
      if (this.config.enableMipmap) {
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
      }

      const textureInfo: TextureInfo = {
        id,
        path,
        width: textureImage.width,
        height: textureImage.height,
        memorySize: calculateTextureMemory(textureImage.width, textureImage.height, true),
        isLoaded: true,
        lastUsedTime: Date.now(),
        glTexture,
      };

      this.textures.set(id, textureInfo);
      this.updateLRU(id);

      return textureInfo;
    } catch (error) {
      console.error(`加载纹理失败 [${id}]:`, error);
      return null;
    }
  }

  /**
   * 获取纹理
   */
  getTexture(id: string): TextureInfo | null {
    const texture = this.textures.get(id);
    if (texture) {
      this.updateLRU(id);
      return texture;
    }
    return null;
  }

  /**
   * 删除纹理
   */
  deleteTexture(id: string): void {
    const texture = this.textures.get(id);
    if (texture && texture.glTexture && this.gl) {
      this.gl.deleteTexture(texture.glTexture);
      this.textures.delete(id);
      this.removeLRU(id);
    }
  }

  /**
   * 清空所有纹理
   */
  clear(): void {
    this.textures.forEach((texture) => {
      if (texture.glTexture && this.gl) {
        this.gl.deleteTexture(texture.glTexture);
      }
    });
    this.textures.clear();
    this.lruQueue = [];
  }

  /**
   * 获取纹理统计
   */
  getStats(): {
    count: number;
    totalMemory: number;
    averageMemory: number;
  } {
    const count = this.textures.size;
    const totalMemory = Array.from(this.textures.values()).reduce(
      (sum, texture) => sum + texture.memorySize,
      0
    );
    const averageMemory = count > 0 ? totalMemory / count : 0;

    return { count, totalMemory, averageMemory };
  }

  /**
   * 加载图片
   */
  private loadImage(path: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = path;
    });
  }

  /**
   * 调整图片大小
   */
  private resizeImage(
    image: HTMLImageElement,
    width: number,
    height: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0, width, height);
    }
    return canvas;
  }

  /**
   * 设置纹理参数
   */
  private setupTextureParameters(): void {
    if (!this.gl) return;

    // 过滤模式
    if (this.config.enableMipmap) {
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MIN_FILTER,
        this.gl.LINEAR_MIPMAP_LINEAR
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MAG_FILTER,
        this.gl.LINEAR
      );
    } else {
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MIN_FILTER,
        this.gl.LINEAR
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MAG_FILTER,
        this.gl.LINEAR
      );
    }

    // 包裹模式
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
  }

  /**
   * 更新 LRU 队列
   */
  private updateLRU(id: string): void {
    this.removeLRU(id);
    this.lruQueue.push(id);

    // 更新最后使用时间
    const texture = this.textures.get(id);
    if (texture) {
      texture.lastUsedTime = Date.now();
    }
  }

  /**
   * 从 LRU 队列中移除
   */
  private removeLRU(id: string): void {
    const index = this.lruQueue.indexOf(id);
    if (index !== -1) {
      this.lruQueue.splice(index, 1);
    }
  }

  /**
   * 淘汰最旧的纹理
   */
  private evictOldest(): void {
    if (this.lruQueue.length > 0) {
      const oldestId = this.lruQueue[0];
      this.deleteTexture(oldestId);
    }
  }
}

// ============================================================================
// WebGL 优化器
// ============================================================================

class WebGLOptimizer {
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private texturePool: TexturePool | null = null;
  private config: WebGLConfig;
  private stats: WebGLStats = {
    drawCalls: 0,
    triangles: 0,
    textureCount: 0,
    textureMemory: 0,
    frameTime: 0,
    renderTime: 0,
    gpuEnabled: false,
  };
  private lastFrameTime: number = 0;

  constructor(config: WebGLConfig) {
    this.config = config;
    this.stats.gpuEnabled = supportsGPUAcceleration();
  }

  /**
   * 初始化 WebGL 上下文
   */
  initializeContext(
    canvas: HTMLCanvasElement,
    texturePoolConfig: TexturePoolConfig
  ): WebGLRenderingContext | WebGL2RenderingContext | null {
    const contextAttributes: WebGLContextAttributes = {
      alpha: this.config.alpha,
      antialias: this.config.antialias,
      depth: this.config.depth,
      stencil: this.config.stencil,
      powerPreference: this.config.powerPreference,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    };

    // 尝试 WebGL2
    this.gl = canvas.getContext('webgl2', contextAttributes) as WebGL2RenderingContext;

    // 回退到 WebGL1
    if (!this.gl) {
      this.gl = canvas.getContext('webgl', contextAttributes) as WebGLRenderingContext;
    }

    if (!this.gl) {
      console.error('无法创建 WebGL 上下文');
      return null;
    }

    // 初始化纹理池
    this.texturePool = new TexturePool(this.gl, texturePoolConfig);

    // 设置视口
    this.gl.viewport(0, 0, canvas.width, canvas.height);

    // 启用混合
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    return this.gl;
  }

  /**
   * 开始帧
   */
  beginFrame(): void {
    this.lastFrameTime = performance.now();
    this.resetFrameStats();
  }

  /**
   * 结束帧
   */
  endFrame(): void {
    const now = performance.now();
    this.stats.frameTime = now - this.lastFrameTime;

    // 计算 FPS
    const fps = this.stats.frameTime > 0 ? 1000 / this.stats.frameTime : 0;

    // 更新纹理统计
    if (this.texturePool) {
      const textureStats = this.texturePool.getStats();
      this.stats.textureCount = textureStats.count;
      this.stats.textureMemory = textureStats.totalMemory;
    }

    // 上报统计到后端
    renderingService.updateWebGLStats({
      drawCalls: this.stats.drawCalls,
      triangles: this.stats.triangles,
      textureCount: this.stats.textureCount,
      textureMemory: this.stats.textureMemory,
      frameTime: this.stats.frameTime,
      fps,
    });
  }

  /**
   * 记录绘制调用
   */
  recordDrawCall(triangleCount: number = 0): void {
    this.stats.drawCalls++;
    this.stats.triangles += triangleCount;
  }

  /**
   * 获取统计
   */
  getStats(): WebGLStats {
    return { ...this.stats };
  }

  /**
   * 重置帧统计
   */
  private resetFrameStats(): void {
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;
  }

  /**
   * 获取纹理池
   */
  getTexturePool(): TexturePool | null {
    return this.texturePool;
  }

  /**
   * 启用批量渲染
   */
  enableBatchRendering(): void {
    // 实现批量渲染逻辑
    // 这需要根据具体的渲染系统实现
  }

  /**
   * 禁用批量渲染
   */
  disableBatchRendering(): void {
    // 禁用批量渲染
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.texturePool) {
      this.texturePool.clear();
    }
    this.gl = null;
  }
}

// ============================================================================
// LOD 管理器
// ============================================================================

class LODManager {
  private config: LODConfig;
  private currentLevel: number = 0;

  constructor(config: LODConfig) {
    this.config = config;
  }

  /**
   * 更新 LOD 级别
   */
  updateLevel(distance: number): number {
    const newLevel = getLODLevel(distance, this.config.distances);
    
    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
    }

    return this.currentLevel;
  }

  /**
   * 获取当前 LOD 模型
   */
  getCurrentModel(): string {
    return this.config.models[this.currentLevel] || this.config.models[0];
  }

  /**
   * 获取当前级别
   */
  getCurrentLevel(): number {
    return this.currentLevel;
  }
}

// 导出实例和类
export { WebGLOptimizer, TexturePool, LODManager };

// 创建默认优化器
export function createWebGLOptimizer(config?: Partial<WebGLConfig>): WebGLOptimizer {
  const defaultConfig: WebGLConfig = {
    antialias: true,
    alpha: true,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
    textureFiltering: 'linear',
    maxTextureSize: 4096,
    ...config,
  };

  return new WebGLOptimizer(defaultConfig);
}

// 导出类型
export type { WebGLOptimizer as WebGLOptimizerType };

