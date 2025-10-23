/**
 * 人格领域模型
 */

import type { MBTIType, BigFiveTraits, BehaviorSettings } from '../types';

/**
 * 人格模型接口
 */
export interface Personality {
  /** 人格ID */
  id: string;
  /** 所属角色ID */
  characterId: string;
  /** MBTI 人格类型 */
  mbtiType: MBTIType;
  /** 大五人格特质 */
  bigFive: BigFiveTraits;
  /** 行为设定 */
  behavior: BehaviorSettings;
  /** 核心特征描述（列表） */
  coreTraits: string[];
  /** 价值观 */
  values: string[];
  /** 兴趣爱好 */
  interests: string[];
  /** 专业领域 */
  expertise: string[];
  /** 沟通风格描述 */
  communicationStyle: string;
  /** 决策风格描述 */
  decisionMakingStyle: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 创建人格的输入数据
 */
export interface CreatePersonalityInput {
  characterId: string;
  mbtiType: MBTIType;
  bigFive: BigFiveTraits;
  behavior: BehaviorSettings;
  coreTraits: string[];
  values?: string[];
  interests?: string[];
  expertise?: string[];
  communicationStyle?: string;
  decisionMakingStyle?: string;
}

/**
 * 更新人格的输入数据
 */
export interface UpdatePersonalityInput {
  mbtiType?: MBTIType;
  bigFive?: Partial<BigFiveTraits>;
  behavior?: Partial<BehaviorSettings>;
  coreTraits?: string[];
  values?: string[];
  interests?: string[];
  expertise?: string[];
  communicationStyle?: string;
  decisionMakingStyle?: string;
}

/**
 * 人格领域模型类
 */
export class PersonalityModel implements Personality {
  id: string;
  characterId: string;
  mbtiType: MBTIType;
  bigFive: BigFiveTraits;
  behavior: BehaviorSettings;
  coreTraits: string[];
  values: string[];
  interests: string[];
  expertise: string[];
  communicationStyle: string;
  decisionMakingStyle: string;
  createdAt: string;
  updatedAt: string;

  constructor(data: Personality) {
    this.id = data.id;
    this.characterId = data.characterId;
    this.mbtiType = data.mbtiType;
    this.bigFive = data.bigFive;
    this.behavior = data.behavior;
    this.coreTraits = data.coreTraits;
    this.values = data.values;
    this.interests = data.interests;
    this.expertise = data.expertise;
    this.communicationStyle = data.communicationStyle;
    this.decisionMakingStyle = data.decisionMakingStyle;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * 获取人格摘要描述
   */
  getSummary(): string {
    return `${this.mbtiType} personality with ${this.coreTraits.slice(0, 3).join(', ')}`;
  }

  /**
   * 验证大五人格数值是否有效
   */
  validateBigFive(): boolean {
    const traits = Object.values(this.bigFive);
    return traits.every((value) => value >= 0 && value <= 100);
  }

  /**
   * 计算人格相似度（与另一个人格比较）
   */
  calculateSimilarity(other: PersonalityModel): number {
    // 基于大五人格特质计算相似度
    const bigFiveDiff = Object.keys(this.bigFive).reduce((sum, key) => {
      const k = key as keyof BigFiveTraits;
      return sum + Math.abs(this.bigFive[k] - other.bigFive[k]);
    }, 0);

    // 归一化到 0-100
    const maxDiff = 500; // 5个特质 * 100
    return 100 - (bigFiveDiff / maxDiff) * 100;
  }

  /**
   * 转换为普通对象
   */
  toJSON(): Personality {
    return {
      id: this.id,
      characterId: this.characterId,
      mbtiType: this.mbtiType,
      bigFive: this.bigFive,
      behavior: this.behavior,
      coreTraits: this.coreTraits,
      values: this.values,
      interests: this.interests,
      expertise: this.expertise,
      communicationStyle: this.communicationStyle,
      decisionMakingStyle: this.decisionMakingStyle,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

