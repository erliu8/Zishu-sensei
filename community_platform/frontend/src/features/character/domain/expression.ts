/**
 * 表情领域模型
 * @module features/character/domain/expression
 */

/**
 * 触发条件类型
 */
export enum TriggerType {
  EMOTION = 'emotion',           // 情绪触发（如：开心、悲伤）
  KEYWORD = 'keyword',           // 关键词触发
  CONTEXT = 'context',           // 上下文触发（如：对话开始、结束）
  RANDOM = 'random',             // 随机触发
  TIME = 'time',                 // 时间触发
  USER_ACTION = 'user_action',   // 用户行为触发
}

/**
 * 情绪类型枚举
 */
export enum EmotionType {
  HAPPY = 'happy',
  SAD = 'sad',
  ANGRY = 'angry',
  SURPRISED = 'surprised',
  FEARFUL = 'fearful',
  DISGUSTED = 'disgusted',
  NEUTRAL = 'neutral',
  EXCITED = 'excited',
  CONFUSED = 'confused',
  THINKING = 'thinking',
  SLEEPY = 'sleepy',
  EMBARRASSED = 'embarrassed',
}

/**
 * 触发条件配置
 */
export interface TriggerCondition {
  id: string;
  type: TriggerType;
  value: string | string[] | number;
  threshold?: number;           // 触发阈值（0-1）
  priority?: number;            // 优先级（数字越大优先级越高）
  metadata?: Record<string, any>;
}

/**
 * 表情配置
 */
export interface ExpressionConfig {
  duration?: number;             // 持续时间（毫秒）
  transitionDuration?: number;   // 过渡时间（毫秒）
  loop?: boolean;                // 是否循环
  autoReturn?: boolean;          // 是否自动返回默认表情
  blendMode?: 'replace' | 'blend'; // 混合模式
}

/**
 * 表情模型
 */
export interface Expression {
  id: string;
  characterId: string;           // 所属角色ID
  name: string;                  // 表情名称
  displayName: string;           // 显示名称
  description?: string;          // 描述
  emotionType: EmotionType;      // 情绪类型
  
  // Live2D 相关
  motionGroup?: string;          // 动作组名称
  motionIndex?: number;          // 动作索引
  expressionFile?: string;       // 表情文件路径
  
  // 触发配置
  triggers: TriggerCondition[];  // 触发条件列表
  config: ExpressionConfig;      // 表情配置
  
  // 预览
  thumbnailUrl?: string;         // 缩略图URL
  previewUrl?: string;           // 预览图/视频URL
  
  // 元数据
  isDefault?: boolean;           // 是否为默认表情
  isActive?: boolean;            // 是否启用
  tags?: string[];               // 标签
  weight?: number;               // 权重（用于随机选择）
  
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建表情的DTO
 */
export interface CreateExpressionDto {
  characterId: string;
  name: string;
  displayName: string;
  description?: string;
  emotionType: EmotionType;
  motionGroup?: string;
  motionIndex?: number;
  expressionFile?: string;
  triggers?: TriggerCondition[];
  config?: Partial<ExpressionConfig>;
  thumbnailUrl?: string;
  previewUrl?: string;
  isDefault?: boolean;
  isActive?: boolean;
  tags?: string[];
  weight?: number;
}

/**
 * 更新表情的DTO
 */
export interface UpdateExpressionDto {
  displayName?: string;
  description?: string;
  emotionType?: EmotionType;
  motionGroup?: string;
  motionIndex?: number;
  expressionFile?: string;
  triggers?: TriggerCondition[];
  config?: Partial<ExpressionConfig>;
  thumbnailUrl?: string;
  previewUrl?: string;
  isDefault?: boolean;
  isActive?: boolean;
  tags?: string[];
  weight?: number;
}

/**
 * 表情列表查询参数
 */
export interface ExpressionQueryParams {
  characterId: string;
  emotionType?: EmotionType;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'createdAt' | 'weight' | 'emotionType';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 表情列表响应
 */
export interface ExpressionListResponse {
  data: Expression[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 触发条件验证结果
 */
export interface TriggerValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * 表情默认配置
 */
export const DEFAULT_EXPRESSION_CONFIG: ExpressionConfig = {
  duration: 2000,
  transitionDuration: 300,
  loop: false,
  autoReturn: true,
  blendMode: 'replace',
};

/**
 * 表情工具类
 */
export class ExpressionUtils {
  /**
   * 验证触发条件
   */
  static validateTrigger(trigger: TriggerCondition): TriggerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!trigger.type) {
      errors.push('触发类型不能为空');
    }

    if (!trigger.value) {
      errors.push('触发值不能为空');
    }

    if (trigger.threshold !== undefined) {
      if (trigger.threshold < 0 || trigger.threshold > 1) {
        errors.push('触发阈值必须在0-1之间');
      }
    }

    if (trigger.priority !== undefined && trigger.priority < 0) {
      warnings.push('优先级应该为非负数');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 验证表情数据
   */
  static validateExpression(expression: CreateExpressionDto | UpdateExpressionDto): TriggerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if ('name' in expression && !expression.name?.trim()) {
      errors.push('表情名称不能为空');
    }

    if ('displayName' in expression && !expression.displayName?.trim()) {
      errors.push('显示名称不能为空');
    }

    if (expression.triggers) {
      expression.triggers.forEach((trigger, index) => {
        const result = this.validateTrigger(trigger);
        if (!result.isValid) {
          errors.push(`触发条件${index + 1}: ${result.errors?.join(', ')}`);
        }
        if (result.warnings) {
          warnings.push(`触发条件${index + 1}: ${result.warnings.join(', ')}`);
        }
      });
    }

    if (expression.weight !== undefined && expression.weight < 0) {
      warnings.push('权重应该为非负数');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 生成唯一的触发条件ID
   */
  static generateTriggerId(): string {
    return `trigger_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 创建默认触发条件
   */
  static createDefaultTrigger(type: TriggerType): TriggerCondition {
    return {
      id: this.generateTriggerId(),
      type,
      value: '',
      threshold: 0.5,
      priority: 1,
    };
  }

  /**
   * 根据情绪类型获取默认表情配置
   */
  static getEmotionDefaults(emotionType: EmotionType): Partial<ExpressionConfig> {
    const defaults: Record<EmotionType, Partial<ExpressionConfig>> = {
      [EmotionType.HAPPY]: { duration: 2000, autoReturn: true },
      [EmotionType.SAD]: { duration: 3000, autoReturn: true },
      [EmotionType.ANGRY]: { duration: 2500, autoReturn: true },
      [EmotionType.SURPRISED]: { duration: 1500, autoReturn: true },
      [EmotionType.FEARFUL]: { duration: 2000, autoReturn: true },
      [EmotionType.DISGUSTED]: { duration: 2000, autoReturn: true },
      [EmotionType.NEUTRAL]: { duration: 0, autoReturn: false, loop: true },
      [EmotionType.EXCITED]: { duration: 2500, autoReturn: true },
      [EmotionType.CONFUSED]: { duration: 2000, autoReturn: true },
      [EmotionType.THINKING]: { duration: 3000, autoReturn: true, loop: true },
      [EmotionType.SLEEPY]: { duration: 4000, autoReturn: false },
      [EmotionType.EMBARRASSED]: { duration: 2500, autoReturn: true },
    };

    return defaults[emotionType] || {};
  }

  /**
   * 格式化情绪类型显示名称
   */
  static getEmotionDisplayName(emotionType: EmotionType): string {
    const names: Record<EmotionType, string> = {
      [EmotionType.HAPPY]: '开心',
      [EmotionType.SAD]: '悲伤',
      [EmotionType.ANGRY]: '生气',
      [EmotionType.SURPRISED]: '惊讶',
      [EmotionType.FEARFUL]: '害怕',
      [EmotionType.DISGUSTED]: '厌恶',
      [EmotionType.NEUTRAL]: '平静',
      [EmotionType.EXCITED]: '兴奋',
      [EmotionType.CONFUSED]: '困惑',
      [EmotionType.THINKING]: '思考',
      [EmotionType.SLEEPY]: '困倦',
      [EmotionType.EMBARRASSED]: '害羞',
    };

    return names[emotionType] || emotionType;
  }

  /**
   * 格式化触发类型显示名称
   */
  static getTriggerTypeDisplayName(triggerType: TriggerType): string {
    const names: Record<TriggerType, string> = {
      [TriggerType.EMOTION]: '情绪触发',
      [TriggerType.KEYWORD]: '关键词触发',
      [TriggerType.CONTEXT]: '上下文触发',
      [TriggerType.RANDOM]: '随机触发',
      [TriggerType.TIME]: '时间触发',
      [TriggerType.USER_ACTION]: '用户行为触发',
    };

    return names[triggerType] || triggerType;
  }
}
