/**
 * 人格编辑器组件导出
 */

export { PersonalityEditor } from './PersonalityEditor';
export { MBTISelector } from './MBTISelector';
export { BigFiveTraits } from './BigFiveTraits';
export { BehaviorSettings } from './BehaviorSettings';
export { PersonalityRadarChart } from './PersonalityRadarChart';

// 重新导出类型
export type {
  Personality,
  MBTIType,
  MBTIDimension,
  BigFiveTraits as BigFiveTraitsType,
  BehaviorSettings as BehaviorSettingsType,
} from '../../types/personality';

export {
  DEFAULT_PERSONALITY,
  DEFAULT_BIG_FIVE,
  DEFAULT_BEHAVIOR,
  MBTI_TYPE_DESCRIPTIONS,
  BIG_FIVE_TRAIT_DESCRIPTIONS,
  BEHAVIOR_TRAIT_DESCRIPTIONS,
} from '../../types/personality';

