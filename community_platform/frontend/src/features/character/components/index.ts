/**
 * Character Feature Components
 * 导出所有角色相关组件
 */

// 核心组件
export { CharacterCard, CharacterCardSkeleton } from './CharacterCard';
export { CharacterList, CharacterGridList } from './CharacterList';
export { CharacterDetail, CharacterDetailSkeleton } from './CharacterDetail';
export { CharacterCreator } from './CharacterCreator';

// PersonalityEditor 组件
export { PersonalityEditor } from './PersonalityEditor';
export { MBTISelector } from './PersonalityEditor/MBTISelector';
export { BigFiveTraits } from './PersonalityEditor/BigFiveTraits';
export { BehaviorSettings } from './PersonalityEditor/BehaviorSettings';
export { PersonalityRadarChart } from './PersonalityEditor/PersonalityRadarChart';

// ExpressionManager 组件
export { ExpressionManager } from './ExpressionManager';
export { ExpressionList } from './ExpressionManager/ExpressionList';
export { ExpressionEditor } from './ExpressionManager/ExpressionEditor';
export { TriggerConfig } from './ExpressionManager/TriggerConfig';

// VoiceConfig 组件
export { VoiceConfig } from './VoiceConfig';
export { VoiceSelector } from './VoiceConfig/VoiceSelector';
export { TTSSettings } from './VoiceConfig/TTSSettings';

// ModelManager 组件
export { ModelManager } from './ModelManager';
export { Live2DUpload } from './ModelManager/Live2DUpload';
export { ModelPreview } from './ModelManager/ModelPreview';
export { PhysicsConfig } from './ModelManager/PhysicsConfig';

// 类型导出
export type { CharacterCardProps } from './CharacterCard';
export type { CharacterListProps } from './CharacterList';
export type { CharacterDetailProps } from './CharacterDetail';
export type { CharacterCreatorProps } from './CharacterCreator';
export type { VoiceConfigProps } from './VoiceConfig';
export type { ModelManagerProps } from './ModelManager';
