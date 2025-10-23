/**
 * 人格相关类型定义
 */

// MBTI 维度类型
export type MBTIDimension = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

// MBTI 类型（16种人格）
export type MBTIType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

// 大五人格特质
export interface BigFiveTraits {
  openness: number;           // 开放性 (0-100)
  conscientiousness: number;  // 尽责性 (0-100)
  extraversion: number;       // 外向性 (0-100)
  agreeableness: number;      // 宜人性 (0-100)
  neuroticism: number;        // 神经质 (0-100)
}

// 行为设定
export interface BehaviorSettings {
  formality: number;          // 正式程度 (0-100)
  enthusiasm: number;         // 热情度 (0-100)
  creativity: number;         // 创造性 (0-100)
  empathy: number;           // 共情能力 (0-100)
  assertiveness: number;      // 自信程度 (0-100)
  humor: number;             // 幽默感 (0-100)
  patience: number;          // 耐心度 (0-100)
  directness: number;        // 直接性 (0-100)
}

// 人格数据结构
export interface Personality {
  id?: string;
  mbtiType: MBTIType | null;
  bigFive: BigFiveTraits;
  behavior: BehaviorSettings;
  description?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// MBTI 维度描述
export const MBTI_DIMENSIONS = {
  EI: {
    label: 'E/I',
    fullName: '外向/内向',
    E: { name: '外向 (Extraversion)', description: '从外部世界获得能量' },
    I: { name: '内向 (Introversion)', description: '从内部世界获得能量' },
  },
  SN: {
    label: 'S/N',
    fullName: '实感/直觉',
    S: { name: '实感 (Sensing)', description: '关注具体事实和细节' },
    N: { name: '直觉 (Intuition)', description: '关注整体模式和可能性' },
  },
  TF: {
    label: 'T/F',
    fullName: '思考/情感',
    T: { name: '思考 (Thinking)', description: '基于逻辑和客观分析决策' },
    F: { name: '情感 (Feeling)', description: '基于价值观和人际关系决策' },
  },
  JP: {
    label: 'J/P',
    fullName: '判断/感知',
    J: { name: '判断 (Judging)', description: '喜欢计划和组织' },
    P: { name: '感知 (Perceiving)', description: '喜欢灵活和自发' },
  },
} as const;

// MBTI 类型描述
export const MBTI_TYPE_DESCRIPTIONS: Record<MBTIType, { name: string; description: string; keywords: string[] }> = {
  INTJ: {
    name: '建筑师',
    description: '富有想象力和战略性的思考者，一切都在掌控之中。',
    keywords: ['战略性', '独立', '有远见', '理性'],
  },
  INTP: {
    name: '逻辑学家',
    description: '具有创新思维的发明家，对知识充满渴望。',
    keywords: ['分析性', '好奇', '客观', '创新'],
  },
  ENTJ: {
    name: '指挥官',
    description: '大胆、富有想象力且意志强大的领导者。',
    keywords: ['领导力', '果断', '高效', '自信'],
  },
  ENTP: {
    name: '辩论家',
    description: '聪明好奇的思考者，喜欢智力挑战。',
    keywords: ['机智', '多才', '辩证', '创新'],
  },
  INFJ: {
    name: '提倡者',
    description: '安静而神秘，鼓舞人心的理想主义者。',
    keywords: ['理想主义', '洞察力', '富有同情心', '有原则'],
  },
  INFP: {
    name: '调停者',
    description: '诗意而善良的利他主义者，总是热切地助人。',
    keywords: ['理想主义', '共情', '创造性', '真诚'],
  },
  ENFJ: {
    name: '主人公',
    description: '富有魅力和鼓舞人心的领导者，能够吸引听众。',
    keywords: ['有魅力', '利他', '鼓舞人心', '善于沟通'],
  },
  ENFP: {
    name: '竞选者',
    description: '热情、有创造力和社交能力的自由精神。',
    keywords: ['热情', '创造性', '社交', '乐观'],
  },
  ISTJ: {
    name: '物流师',
    description: '实际且注重事实的个人，可靠性不容置疑。',
    keywords: ['可靠', '务实', '有序', '负责'],
  },
  ISFJ: {
    name: '守卫者',
    description: '非常专注且温暖的守护者，随时准备保护亲人。',
    keywords: ['忠诚', '细心', '支持性', '尽责'],
  },
  ESTJ: {
    name: '总经理',
    description: '出色的管理者，在管理事务或人员方面无与伦比。',
    keywords: ['有组织', '果断', '传统', '实干'],
  },
  ESFJ: {
    name: '执政官',
    description: '极有同情心、受欢迎的人，总是渴望帮助。',
    keywords: ['社交', '支持性', '有责任心', '和谐'],
  },
  ISTP: {
    name: '鉴赏家',
    description: '大胆而实际的实验者，擅长使用各种工具。',
    keywords: ['务实', '灵活', '好奇', '冷静'],
  },
  ISFP: {
    name: '探险家',
    description: '灵活而富有魅力的艺术家，随时准备探索和体验新事物。',
    keywords: ['艺术性', '敏感', '随和', '体验'],
  },
  ESTP: {
    name: '企业家',
    description: '聪明、精力充沛且善于察觉的人，真正享受生活的边缘。',
    keywords: ['精力充沛', '大胆', '实际', '社交'],
  },
  ESFP: {
    name: '表演者',
    description: '自发的、精力充沛且热情的表演者。',
    keywords: ['热情', '友好', '自发', '享乐'],
  },
};

// 大五人格特质描述
export const BIG_FIVE_TRAIT_DESCRIPTIONS = {
  openness: {
    name: '开放性',
    description: '对新体验、想法和价值观的开放程度',
    low: '传统、务实、喜欢常规',
    high: '富有想象力、好奇、喜欢新奇',
  },
  conscientiousness: {
    name: '尽责性',
    description: '自我控制、组织和目标导向的程度',
    low: '灵活、自发、随性',
    high: '有组织、可靠、自律',
  },
  extraversion: {
    name: '外向性',
    description: '社交性、活跃性和寻求刺激的程度',
    low: '安静、内敛、独立',
    high: '外向、活跃、健谈',
  },
  agreeableness: {
    name: '宜人性',
    description: '合作、信任和同情的程度',
    low: '竞争、怀疑、直率',
    high: '友善、合作、信任',
  },
  neuroticism: {
    name: '神经质',
    description: '情绪不稳定性和负面情绪的倾向',
    low: '情绪稳定、冷静、自信',
    high: '敏感、焦虑、情绪化',
  },
} as const;

// 行为特质描述
export const BEHAVIOR_TRAIT_DESCRIPTIONS = {
  formality: {
    name: '正式程度',
    description: '语言和行为的正式程度',
    low: '随意、轻松、非正式',
    high: '正式、专业、严肃',
  },
  enthusiasm: {
    name: '热情度',
    description: '表达热情和兴奋的程度',
    low: '冷静、克制、平淡',
    high: '热情、兴奋、充满活力',
  },
  creativity: {
    name: '创造性',
    description: '思维和表达的创造性程度',
    low: '传统、常规、保守',
    high: '创新、独特、富有想象力',
  },
  empathy: {
    name: '共情能力',
    description: '理解和感受他人情感的能力',
    low: '客观、理性、分离',
    high: '同情、理解、情感丰富',
  },
  assertiveness: {
    name: '自信程度',
    description: '表达观点和主导的程度',
    low: '谦逊、顺从、柔和',
    high: '自信、坚定、主导',
  },
  humor: {
    name: '幽默感',
    description: '使用幽默和玩笑的倾向',
    low: '严肃、直接、少开玩笑',
    high: '诙谐、爱开玩笑、轻松',
  },
  patience: {
    name: '耐心度',
    description: '耐心和容忍的程度',
    low: '急躁、快节奏、追求效率',
    high: '耐心、从容、善于倾听',
  },
  directness: {
    name: '直接性',
    description: '表达的直接和坦率程度',
    low: '委婉、含蓄、圆滑',
    high: '直接、坦率、直言不讳',
  },
} as const;

// 默认值
export const DEFAULT_BIG_FIVE: BigFiveTraits = {
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  neuroticism: 50,
};

export const DEFAULT_BEHAVIOR: BehaviorSettings = {
  formality: 50,
  enthusiasm: 50,
  creativity: 50,
  empathy: 50,
  assertiveness: 50,
  humor: 50,
  patience: 50,
  directness: 50,
};

export const DEFAULT_PERSONALITY: Personality = {
  mbtiType: null,
  bigFive: DEFAULT_BIG_FIVE,
  behavior: DEFAULT_BEHAVIOR,
  description: '',
  tags: [],
};

