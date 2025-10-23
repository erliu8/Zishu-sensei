/**
 * 角色模块共享类型定义
 */

/**
 * 适配器类型枚举（对应后端适配器框架）
 */
export enum AdapterType {
  /** 软适配器 - 基于提示词工程和RAG */
  SOFT = 'soft',
  /** 硬适配器 - 基于原生代码实现 */
  HARD = 'hard',
  /** 智能硬适配器 - 基于微调模型 */
  INTELLIGENT = 'intelligent',
}

/**
 * 适配器能力等级
 */
export enum CapabilityLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

/**
 * MBTI 人格类型
 */
export enum MBTIType {
  INTJ = 'INTJ',
  INTP = 'INTP',
  ENTJ = 'ENTJ',
  ENTP = 'ENTP',
  INFJ = 'INFJ',
  INFP = 'INFP',
  ENFJ = 'ENFJ',
  ENFP = 'ENFP',
  ISTJ = 'ISTJ',
  ISFJ = 'ISFJ',
  ESTJ = 'ESTJ',
  ESFJ = 'ESFJ',
  ISTP = 'ISTP',
  ISFP = 'ISFP',
  ESTP = 'ESTP',
  ESFP = 'ESFP',
}

/**
 * 大五人格特质
 */
export interface BigFiveTraits {
  /** 开放性 (Openness) 0-100 */
  openness: number;
  /** 尽责性 (Conscientiousness) 0-100 */
  conscientiousness: number;
  /** 外向性 (Extraversion) 0-100 */
  extraversion: number;
  /** 宜人性 (Agreeableness) 0-100 */
  agreeableness: number;
  /** 神经质 (Neuroticism) 0-100 */
  neuroticism: number;
}

/**
 * 表情触发条件
 */
export enum ExpressionTrigger {
  /** 情绪相关 */
  EMOTION_HAPPY = 'emotion_happy',
  EMOTION_SAD = 'emotion_sad',
  EMOTION_ANGRY = 'emotion_angry',
  EMOTION_SURPRISED = 'emotion_surprised',
  EMOTION_FEARFUL = 'emotion_fearful',
  EMOTION_DISGUSTED = 'emotion_disgusted',
  EMOTION_NEUTRAL = 'emotion_neutral',
  
  /** 行为相关 */
  ACTION_GREETING = 'action_greeting',
  ACTION_GOODBYE = 'action_goodbye',
  ACTION_THINKING = 'action_thinking',
  ACTION_CONFUSED = 'action_confused',
  ACTION_EXCITED = 'action_excited',
  
  /** 状态相关 */
  STATE_IDLE = 'state_idle',
  STATE_LISTENING = 'state_listening',
  STATE_SPEAKING = 'state_speaking',
  STATE_WORKING = 'state_working',
}

/**
 * 语音性别
 */
export enum VoiceGender {
  MALE = 'male',
  FEMALE = 'female',
  NEUTRAL = 'neutral',
}

/**
 * TTS 引擎类型
 */
export enum TTSEngine {
  AZURE = 'azure',
  GOOGLE = 'google',
  AMAZON = 'amazon',
  OPENAI = 'openai',
  CUSTOM = 'custom',
}

/**
 * 模型类型
 */
export enum ModelType {
  LIVE2D = 'live2d',
  VRM = 'vrm',
  SPRITE = 'sprite',
  AVATAR = 'avatar',
}

/**
 * 角色状态
 */
export enum CharacterStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/**
 * 角色可见性
 */
export enum CharacterVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  UNLISTED = 'unlisted',
}

/**
 * 适配器引用接口
 */
export interface AdapterReference {
  /** 适配器ID */
  id: string;
  /** 适配器名称 */
  name: string;
  /** 适配器类型 */
  type: AdapterType;
  /** 适配器版本 */
  version: string;
  /** 能力等级 */
  capabilityLevel: CapabilityLevel;
  /** 是否启用 */
  enabled: boolean;
  /** 配置参数 */
  config?: Record<string, any>;
  /** 优先级（数字越小优先级越高） */
  priority: number;
}

/**
 * 行为设定接口
 */
export interface BehaviorSettings {
  /** 响应速度 (1-10, 1最慢 10最快) */
  responseSpeed: number;
  /** 主动性 (0-100) */
  proactivity: number;
  /** 正式程度 (0-100, 0非常随意 100非常正式) */
  formality: number;
  /** 幽默感 (0-100) */
  humor: number;
  /** 同理心 (0-100) */
  empathy: number;
  /** 创造性 (0-100) */
  creativity: number;
  /** 自定义行为规则 */
  customRules?: string[];
}

