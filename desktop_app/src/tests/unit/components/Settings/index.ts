/**
 * Settings 组件测试套件入口文件
 * 
 * 导出所有 Settings 相关的测试模块和辅助函数
 * @module Tests/Components/Settings
 */

// 注意：不要直接导出测试文件（*.test.tsx），因为它们包含 JSX 且可能导致编译问题
// 测试文件应该由测试运行器直接执行

// 导出 Mock 数据
export * from '../../../mocks/settings-mocks'

// 导出测试辅助函数
export * from '../../../utils/settings-test-helpers'

// 导出类型定义（用于测试）
// 注意：仅导出类型以避免在编译时导入实际组件
// 注意：由于 tsc 命令行编译时路径解析问题，这些类型导出已被注释
// 测试文件应该直接从各自的测试中导入所需的类型
// export type { SettingsTab, SettingsProps } from '@/components/Settings'
// export type { GeneralSettingsProps } from '@/components/Settings/GeneralSettings'
// export type { CharacterSettingsProps } from '@/components/Settings/CharacterSettings'
// export type { AdapterSettingsProps } from '@/components/Settings/AdapterSettings'

// 常用测试预设
export { SETTINGS_TEST_PRESETS, SETTINGS_ERROR_PRESETS } from '../../../mocks/settings-mocks'
export { SettingsTestHelpers } from '../../../utils/settings-test-helpers'
