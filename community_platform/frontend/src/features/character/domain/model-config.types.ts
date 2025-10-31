/**
 * 角色模型配置类型定义
 * 支持完整模型、Lora适配器、提示词工程三种模型配置方式
 * @module features/character/domain
 */

import type { Live2DModel } from '@/features/adapter/domain/live2d.types';
import type { LoraAdapter } from '@/features/adapter/domain/lora.types';
import type { DeploymentConfig } from '@/features/adapter/domain/adapter.types';

/**
 * 模型配置类型
 */
export enum ModelConfigType {
  /** 完整微调模型 */
  FULL_MODEL = 'full_model',
  /** Lora适配器 */
  LORA_ADAPTER = 'lora_adapter',
  /** 提示词工程（使用第三方模型） */
  PROMPT_ENGINEERING = 'prompt_engineering',
}

/**
 * 第三方模型提供商
 */
export enum ThirdPartyModelProvider {
  /** OpenAI */
  OPENAI = 'openai',
  /** Anthropic */
  ANTHROPIC = 'anthropic',
  /** Google */
  GOOGLE = 'google',
  /** 阿里云 */
  ALIYUN = 'aliyun',
  /** 百度 */
  BAIDU = 'baidu',
  /** 讯飞 */
  XUNFEI = 'xunfei',
  /** 其他 */
  OTHER = 'other',
}

/**
 * 完整模型配置
 */
export interface FullModelConfig {
  /** 配置类型 */
  type: ModelConfigType.FULL_MODEL;
  /** 模型ID */
  modelId: string;
  /** 模型名称 */
  modelName: string;
  /** 模型显示名称 */
  displayName: string;
  /** 模型提供商 */
  provider?: string;
  /** 模型版本 */
  version?: string;
  /** 部署配置 */
  deployment: DeploymentConfig;
  /** 模型参数 */
  parameters?: {
    /** 温度 */
    temperature?: number;
    /** Top P */
    topP?: number;
    /** 最大tokens */
    maxTokens?: number;
    /** 其他参数 */
    [key: string]: any;
  };
}

/**
 * Lora适配器配置
 */
export interface LoraAdapterConfig {
  /** 配置类型 */
  type: ModelConfigType.LORA_ADAPTER;
  /** Lora适配器引用 */
  loraAdapter: LoraAdapter | string; // 可以是完整对象或ID
  /** 基础模型ID */
  baseModelId: string;
  /** 基础模型名称 */
  baseModelName: string;
  /** 部署配置 */
  deployment: DeploymentConfig;
  /** 模型参数 */
  parameters?: {
    /** 温度 */
    temperature?: number;
    /** Top P */
    topP?: number;
    /** 最大tokens */
    maxTokens?: number;
    /** Lora权重 */
    loraWeight?: number;
    /** 其他参数 */
    [key: string]: any;
  };
}

/**
 * 提示词工程配置
 */
export interface PromptEngineeringConfig {
  /** 配置类型 */
  type: ModelConfigType.PROMPT_ENGINEERING;
  /** 第三方模型提供商 */
  provider: ThirdPartyModelProvider;
  /** 模型ID/名称 */
  modelId: string;
  /** 模型显示名称 */
  modelName: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 角色提示词 */
  characterPrompt: string;
  /** 提示词模板 */
  promptTemplate?: string;
  /** 模型参数 */
  parameters?: {
    /** 温度 */
    temperature?: number;
    /** Top P */
    topP?: number;
    /** 最大tokens */
    maxTokens?: number;
    /** 其他参数 */
    [key: string]: any;
  };
  /** API配置 */
  apiConfig?: {
    /** API密钥（加密存储） */
    apiKey?: string;
    /** API端点 */
    endpoint?: string;
    /** 其他配置 */
    [key: string]: any;
  };
}

/**
 * 角色模型配置联合类型
 */
export type CharacterModelConfig = 
  | FullModelConfig 
  | LoraAdapterConfig 
  | PromptEngineeringConfig;

/**
 * Live2D模型引用
 */
export interface Live2DModelReference {
  /** 模型ID */
  modelId: string;
  /** 模型名称 */
  modelName: string;
  /** 模型显示名称 */
  displayName: string;
  /** 部署配置 */
  deployment: DeploymentConfig;
  /** 完整的Live2D模型信息（可选） */
  fullModel?: Live2DModel;
}

/**
 * 角色完整配置
 * 包含AI模型和外观模型
 */
export interface CharacterFullConfig {
  /** AI模型配置 */
  aiModel: CharacterModelConfig;
  /** Live2D模型（可选） */
  live2dModel?: Live2DModelReference;
  /** 插件列表（对应硬适配器） */
  plugins?: string[]; // 插件ID数组
}

