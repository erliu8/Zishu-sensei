/**
 * 语音领域模型
 */

import type { VoiceGender, TTSEngine } from '../types';

/**
 * 语音模型接口
 */
export interface Voice {
  /** 语音ID */
  id: string;
  /** 所属角色ID */
  characterId: string;
  /** 语音名称 */
  name: string;
  /** TTS 引擎 */
  engine: TTSEngine;
  /** 语音ID（引擎中的语音标识） */
  voiceId: string;
  /** 语音性别 */
  gender: VoiceGender;
  /** 语言代码 (e.g., zh-CN, en-US, ja-JP) */
  languageCode: string;
  /** 语速 (0.5-2.0) */
  speechRate: number;
  /** 音调 (0.5-2.0) */
  pitch: number;
  /** 音量 (0.0-1.0) */
  volume: number;
  /** TTS 引擎特定配置 */
  engineConfig?: Record<string, any>;
  /** 是否为默认语音 */
  isDefault: boolean;
  /** 语音样本URL */
  sampleUrl?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 创建语音的输入数据
 */
export interface CreateVoiceInput {
  characterId: string;
  name: string;
  engine: TTSEngine;
  voiceId: string;
  gender: VoiceGender;
  languageCode: string;
  speechRate?: number;
  pitch?: number;
  volume?: number;
  engineConfig?: Record<string, any>;
  isDefault?: boolean;
  sampleUrl?: string;
}

/**
 * 更新语音的输入数据
 */
export interface UpdateVoiceInput {
  name?: string;
  engine?: TTSEngine;
  voiceId?: string;
  gender?: VoiceGender;
  languageCode?: string;
  speechRate?: number;
  pitch?: number;
  volume?: number;
  engineConfig?: Record<string, any>;
  isDefault?: boolean;
  sampleUrl?: string;
}

/**
 * 语音领域模型类
 */
export class VoiceModel implements Voice {
  id: string;
  characterId: string;
  name: string;
  engine: TTSEngine;
  voiceId: string;
  gender: VoiceGender;
  languageCode: string;
  speechRate: number;
  pitch: number;
  volume: number;
  engineConfig?: Record<string, any>;
  isDefault: boolean;
  sampleUrl?: string;
  createdAt: string;
  updatedAt: string;

  constructor(data: Voice) {
    this.id = data.id;
    this.characterId = data.characterId;
    this.name = data.name;
    this.engine = data.engine;
    this.voiceId = data.voiceId;
    this.gender = data.gender;
    this.languageCode = data.languageCode;
    this.speechRate = data.speechRate;
    this.pitch = data.pitch;
    this.volume = data.volume;
    this.engineConfig = data.engineConfig;
    this.isDefault = data.isDefault;
    this.sampleUrl = data.sampleUrl;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * 验证语音参数
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.speechRate < 0.5 || this.speechRate > 2.0) {
      errors.push('Speech rate must be between 0.5 and 2.0');
    }

    if (this.pitch < 0.5 || this.pitch > 2.0) {
      errors.push('Pitch must be between 0.5 and 2.0');
    }

    if (this.volume < 0.0 || this.volume > 1.0) {
      errors.push('Volume must be between 0.0 and 1.0');
    }

    if (!this.languageCode || this.languageCode.trim().length === 0) {
      errors.push('Language code is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取语言显示名称
   */
  getLanguageDisplayName(): string {
    const languageMap: Record<string, string> = {
      'zh-CN': '中文（简体）',
      'zh-TW': '中文（繁体）',
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'ja-JP': '日本語',
      'ko-KR': '한국어',
      'fr-FR': 'Français',
      'de-DE': 'Deutsch',
      'es-ES': 'Español',
      'it-IT': 'Italiano',
      'ru-RU': 'Русский',
    };

    return languageMap[this.languageCode] || this.languageCode;
  }

  /**
   * 获取性别显示名称
   */
  getGenderDisplayName(): string {
    const genderMap: Record<VoiceGender, string> = {
      [VoiceGender.MALE]: '男性',
      [VoiceGender.FEMALE]: '女性',
      [VoiceGender.NEUTRAL]: '中性',
    };

    return genderMap[this.gender];
  }

  /**
   * 获取TTS引擎显示名称
   */
  getEngineDisplayName(): string {
    const engineMap: Record<TTSEngine, string> = {
      [TTSEngine.AZURE]: 'Azure TTS',
      [TTSEngine.GOOGLE]: 'Google Cloud TTS',
      [TTSEngine.AMAZON]: 'Amazon Polly',
      [TTSEngine.OPENAI]: 'OpenAI TTS',
      [TTSEngine.CUSTOM]: 'Custom Engine',
    };

    return engineMap[this.engine];
  }

  /**
   * 转换为普通对象
   */
  toJSON(): Voice {
    return {
      id: this.id,
      characterId: this.characterId,
      name: this.name,
      engine: this.engine,
      voiceId: this.voiceId,
      gender: this.gender,
      languageCode: this.languageCode,
      speechRate: this.speechRate,
      pitch: this.pitch,
      volume: this.volume,
      engineConfig: this.engineConfig,
      isDefault: this.isDefault,
      sampleUrl: this.sampleUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

