/**
 * 模型领域模型（Live2D、VRM等）
 */

import type { ModelType } from '../types';

/**
 * 物理参数配置
 */
export interface PhysicsConfig {
  /** 重力 */
  gravity: number;
  /** 风力 */
  wind: number;
  /** 弹性 */
  elasticity: number;
  /** 阻尼 */
  damping: number;
}

/**
 * 模型模型接口
 */
export interface Model {
  /** 模型ID */
  id: string;
  /** 所属角色ID */
  characterId: string;
  /** 模型名称 */
  name: string;
  /** 模型类型 */
  type: ModelType;
  /** 模型文件URL */
  modelUrl: string;
  /** 缩略图URL */
  thumbnailUrl?: string;
  /** 模型尺寸（字节） */
  fileSize: number;
  /** 模型配置（JSON） */
  config?: Record<string, any>;
  /** 物理参数配置 */
  physics?: PhysicsConfig;
  /** 是否为默认模型 */
  isDefault: boolean;
  /** 模型版本 */
  version: string;
  /** 创建者 */
  creator?: string;
  /** 许可证 */
  license?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 创建模型的输入数据
 */
export interface CreateModelInput {
  characterId: string;
  name: string;
  type: ModelType;
  modelUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  config?: Record<string, any>;
  physics?: PhysicsConfig;
  isDefault?: boolean;
  version?: string;
  creator?: string;
  license?: string;
}

/**
 * 更新模型的输入数据
 */
export interface UpdateModelInput {
  name?: string;
  type?: ModelType;
  modelUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  config?: Record<string, any>;
  physics?: Partial<PhysicsConfig>;
  isDefault?: boolean;
  version?: string;
  creator?: string;
  license?: string;
}

/**
 * 模型领域模型类
 */
export class ModelModel implements Model {
  id: string;
  characterId: string;
  name: string;
  type: ModelType;
  modelUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  config?: Record<string, any>;
  physics?: PhysicsConfig;
  isDefault: boolean;
  version: string;
  creator?: string;
  license?: string;
  createdAt: string;
  updatedAt: string;

  constructor(data: Model) {
    this.id = data.id;
    this.characterId = data.characterId;
    this.name = data.name;
    this.type = data.type;
    this.modelUrl = data.modelUrl;
    this.thumbnailUrl = data.thumbnailUrl;
    this.fileSize = data.fileSize;
    this.config = data.config;
    this.physics = data.physics;
    this.isDefault = data.isDefault;
    this.version = data.version;
    this.creator = data.creator;
    this.license = data.license;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * 检查是否为 Live2D 模型
   */
  isLive2D(): boolean {
    return this.type === ModelType.LIVE2D;
  }

  /**
   * 检查是否为 VRM 模型
   */
  isVRM(): boolean {
    return this.type === ModelType.VRM;
  }

  /**
   * 检查是否为精灵图模型
   */
  isSprite(): boolean {
    return this.type === ModelType.SPRITE;
  }

  /**
   * 获取文件大小（人类可读格式）
   */
  getFileSizeFormatted(): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = this.fileSize;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 获取模型类型显示名称
   */
  getTypeDisplayName(): string {
    const typeMap: Record<ModelType, string> = {
      [ModelType.LIVE2D]: 'Live2D',
      [ModelType.VRM]: 'VRM',
      [ModelType.SPRITE]: 'Sprite',
      [ModelType.AVATAR]: 'Avatar',
    };

    return typeMap[this.type];
  }

  /**
   * 验证模型配置
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Model name is required');
    }

    if (!this.modelUrl || this.modelUrl.trim().length === 0) {
      errors.push('Model URL is required');
    }

    if (this.fileSize <= 0) {
      errors.push('File size must be positive');
    }

    // 验证物理参数
    if (this.physics) {
      if (this.physics.gravity < 0 || this.physics.gravity > 10) {
        errors.push('Gravity must be between 0 and 10');
      }
      if (this.physics.wind < 0 || this.physics.wind > 10) {
        errors.push('Wind must be between 0 and 10');
      }
      if (this.physics.elasticity < 0 || this.physics.elasticity > 1) {
        errors.push('Elasticity must be between 0 and 1');
      }
      if (this.physics.damping < 0 || this.physics.damping > 1) {
        errors.push('Damping must be between 0 and 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 转换为普通对象
   */
  toJSON(): Model {
    return {
      id: this.id,
      characterId: this.characterId,
      name: this.name,
      type: this.type,
      modelUrl: this.modelUrl,
      thumbnailUrl: this.thumbnailUrl,
      fileSize: this.fileSize,
      config: this.config,
      physics: this.physics,
      isDefault: this.isDefault,
      version: this.version,
      creator: this.creator,
      license: this.license,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

