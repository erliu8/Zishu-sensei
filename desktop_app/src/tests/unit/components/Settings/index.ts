/**
 * Settings 组件测试套件入口文件
 * 
 * 导出所有 Settings 相关的测试模块和辅助函数
 * @module Tests/Components/Settings
 */

// 导出测试文件
export * from './SettingsPanel.test'
export * from './GeneralSettings.test'
export * from './CharacterSettings.test'
export * from './VoiceSettings.test'
export * from './AdapterSettings.test'

// 导出 Mock 数据
export * from '../../../mocks/settings-mocks'

// 导出测试辅助函数
export * from '../../../utils/settings-test-helpers'

// 导出类型定义（用于测试）
export type {
  SettingsTab,
  SettingsProps
} from '@/components/Settings'

export type {
  GeneralSettingsProps
} from '@/components/Settings/GeneralSettings'

export type {
  CharacterSettingsProps
} from '@/components/Settings/CharacterSettings'

export type {
  VoiceSettingsProps
} from '@/components/Settings/VoiceSettings'

export type {
  AdapterSettingsProps
} from '@/components/Settings/AdapterSettings'

// 常用测试预设
export { SETTINGS_TEST_PRESETS, SETTINGS_ERROR_PRESETS } from '../../../mocks/settings-mocks'
export { SettingsTestHelpers } from '../../../utils/settings-test-helpers'
