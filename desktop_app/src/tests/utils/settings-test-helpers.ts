/**
 * Settings 测试辅助函数
 * 
 * 提供 Settings 组件测试专用的工具函数和测试场景
 * @module Tests/Utils/SettingsTestHelpers
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestProvider } from './test-utils'
import type { 
  AppConfig, 
  AppSettings, 
  WindowConfig, 
  CharacterConfig, 
  ThemeConfig, 
  SystemConfig 
} from '@/types/settings'
import type { MockVoiceSettings, MockAdapterSettings } from '@/tests/mocks/settings-mocks'

// ==================== 测试场景工厂 ====================

/**
 * 通用设置测试场景
 */
export interface SettingsTestScenario {
  name: string
  description: string
  config: AppConfig
  expectedBehavior: string[]
}

/**
 * 创建设置测试场景
 */
export function createSettingsTestScenarios(): SettingsTestScenario[] {
  return [
    {
      name: 'minimal',
      description: '最小化配置场景',
      config: {
        window: {
          width: 300,
          height: 400,
          always_on_top: false,
          transparent: false,
          decorations: true,
          resizable: true,
          position: null
        },
        character: {
          current_character: 'shizuku' as any,
          scale: 0.5 as any,
          auto_idle: false,
          interaction_enabled: false
        },
        theme: {
          current_theme: 'light',
          custom_css: null
        },
        system: {
          auto_start: false,
          minimize_to_tray: false,
          close_to_tray: false,
          show_notifications: false
        }
      },
      expectedBehavior: [
        '应该显示小尺寸窗口配置',
        '应该禁用所有可选功能',
        '应该使用默认角色和主题'
      ]
    },
    {
      name: 'power_user',
      description: '高级用户配置场景',
      config: {
        window: {
          width: 1200,
          height: 800,
          always_on_top: true,
          transparent: true,
          decorations: false,
          resizable: true,
          position: [100, 100] as any
        },
        character: {
          current_character: 'hiyori' as any,
          scale: 2.0 as any,
          auto_idle: true,
          interaction_enabled: true
        },
        theme: {
          current_theme: 'custom',
          custom_css: '/* Custom styles */'
        },
        system: {
          auto_start: true,
          minimize_to_tray: true,
          close_to_tray: true,
          show_notifications: true
        }
      },
      expectedBehavior: [
        '应该启用所有高级功能',
        '应该使用自定义主题和CSS',
        '应该配置最大角色尺寸'
      ]
    },
    {
      name: 'developer',
      description: '开发者配置场景',
      config: {
        window: {
          width: 800,
          height: 600,
          always_on_top: false,
          transparent: false,
          decorations: true,
          resizable: true,
          position: [0, 0] as any
        },
        character: {
          current_character: 'miku' as any,
          scale: 1.0 as any,
          auto_idle: true,
          interaction_enabled: true
        },
        theme: {
          current_theme: 'dark',
          custom_css: null
        },
        system: {
          auto_start: false,
          minimize_to_tray: true,
          close_to_tray: false,
          show_notifications: true
        }
      },
      expectedBehavior: [
        '应该使用开发友好的配置',
        '应该启用调试功能',
        '应该使用深色主题'
      ]
    }
  ]
}

// ==================== 测试断言辅助函数 ====================

/**
 * 断言配置值是否正确显示
 */
export function assertConfigDisplayed(config: AppConfig) {
  // 窗口配置断言
  const widthInput = screen.getByLabelText('窗口宽度') as HTMLInputElement
  expect(widthInput.value).toBe(config.window.width.toString())

  const heightInput = screen.getByLabelText('窗口高度') as HTMLInputElement
  expect(heightInput.value).toBe(config.window.height.toString())

  const alwaysOnTopSwitch = screen.getByLabelText('总是置顶') as HTMLInputElement
  expect(alwaysOnTopSwitch.checked).toBe(config.window.always_on_top)

  // 角色配置断言
  const scaleSlider = screen.getByLabelText('角色缩放') as HTMLInputElement
  expect(scaleSlider.value).toBe(config.character.scale.toString())

  const interactionSwitch = screen.getByLabelText('启用交互') as HTMLInputElement
  expect(interactionSwitch.checked).toBe(config.character.interaction_enabled)

  // 系统配置断言
  const autoStartSwitch = screen.getByLabelText('开机自启动') as HTMLInputElement
  expect(autoStartSwitch.checked).toBe(config.system.auto_start)
}

/**
 * 断言表单验证错误
 */
export function assertValidationErrors(expectedErrors: string[]) {
  expectedErrors.forEach(error => {
    expect(screen.getByText(error)).toBeInTheDocument()
  })
}

/**
 * 断言保存成功
 */
export async function assertSaveSuccess() {
  await waitFor(() => {
    expect(screen.getByText(/保存成功/i)).toBeInTheDocument()
  })
}

/**
 * 断言保存失败
 */
export async function assertSaveError(errorMessage: string) {
  await waitFor(() => {
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })
}

// ==================== 交互辅助函数 ====================

/**
 * 模拟窗口尺寸输入
 */
export async function inputWindowSize(user: ReturnType<typeof userEvent.setup>, width: number, height: number) {
  const widthInput = screen.getByLabelText('窗口宽度')
  const heightInput = screen.getByLabelText('窗口高度')

  await user.clear(widthInput)
  await user.type(widthInput, width.toString())

  await user.clear(heightInput)
  await user.type(heightInput, height.toString())
}

/**
 * 模拟角色缩放调整
 */
export async function adjustCharacterScale(user: ReturnType<typeof userEvent.setup>, scale: number) {
  const scaleSlider = screen.getByLabelText('角色缩放')
  fireEvent.change(scaleSlider, { target: { value: scale.toString() } })
}

/**
 * 模拟主题切换
 */
export async function switchTheme(user: ReturnType<typeof userEvent.setup>, theme: string) {
  const themeSelect = screen.getByLabelText('界面主题')
  await user.selectOptions(themeSelect, theme)
}

/**
 * 模拟开关切换
 */
export async function toggleSwitch(user: ReturnType<typeof userEvent.setup>, label: string) {
  const switchElement = screen.getByLabelText(label)
  await user.click(switchElement)
}

/**
 * 模拟保存操作
 */
export async function saveSettings(user: ReturnType<typeof userEvent.setup>) {
  const saveButton = screen.getByText('保存')
  await user.click(saveButton)
}

/**
 * 模拟重置操作
 */
export async function resetSettings(user: ReturnType<typeof userEvent.setup>, confirm = true) {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(confirm)
  
  const resetButton = screen.getByText('重置')
  await user.click(resetButton)

  confirmSpy.mockRestore()
}

// ==================== 表单验证辅助函数 ====================

/**
 * 测试窗口尺寸验证
 */
export async function testWindowSizeValidation(user: ReturnType<typeof userEvent.setup>) {
  // 测试过小的值
  await inputWindowSize(user, 100, 100)
  assertValidationErrors(['窗口宽度必须在 200-4000 之间', '窗口高度必须在 200-4000 之间'])

  // 测试过大的值
  await inputWindowSize(user, 5000, 5000)
  assertValidationErrors(['窗口宽度必须在 200-4000 之间', '窗口高度必须在 200-4000 之间'])

  // 测试有效值
  await inputWindowSize(user, 800, 600)
  expect(screen.queryByText(/窗口宽度必须在/)).not.toBeInTheDocument()
}

/**
 * 测试角色缩放验证
 */
export async function testCharacterScaleValidation(user: ReturnType<typeof userEvent.setup>) {
  // 测试过小的值
  await adjustCharacterScale(user, 0.05)
  assertValidationErrors(['缩放值必须在 0.1-5.0 之间'])

  // 测试过大的值
  await adjustCharacterScale(user, 10)
  assertValidationErrors(['缩放值必须在 0.1-5.0 之间'])

  // 测试有效值
  await adjustCharacterScale(user, 1.5)
  expect(screen.queryByText(/缩放值必须在/)).not.toBeInTheDocument()
}

// ==================== 模拟用户交互场景 ====================

/**
 * 模拟初次设置向导
 */
export async function simulateFirstTimeSetup(user: ReturnType<typeof userEvent.setup>) {
  // 1. 设置语言
  const languageSelect = screen.getByLabelText('界面语言')
  await user.selectOptions(languageSelect, 'zh-CN')

  // 2. 选择主题
  await switchTheme(user, 'dark')

  // 3. 配置窗口
  await inputWindowSize(user, 800, 600)
  await toggleSwitch(user, '总是置顶')

  // 4. 选择角色
  const characterSelect = screen.getByLabelText('当前角色')
  await user.selectOptions(characterSelect, 'hiyori')

  // 5. 配置系统
  await toggleSwitch(user, '开机自启动')
  await toggleSwitch(user, '显示通知')

  // 6. 保存设置
  await saveSettings(user)
}

/**
 * 模拟高级用户配置流程
 */
export async function simulateAdvancedConfiguration(user: ReturnType<typeof userEvent.setup>) {
  // 1. 高级窗口设置
  await inputWindowSize(user, 1200, 800)
  await toggleSwitch(user, '窗口透明')
  await toggleSwitch(user, '显示边框')

  // 2. 高级角色设置
  await adjustCharacterScale(user, 2.0)
  await toggleSwitch(user, '自动待机')
  
  // 展开高级设置
  await user.click(screen.getByText('高级设置'))
  
  const gravitySlider = screen.getByLabelText('重力强度')
  fireEvent.change(gravitySlider, { target: { value: '0.8' } })

  // 3. 自定义主题
  await switchTheme(user, 'custom')
  
  const cssEditor = screen.getByLabelText('自定义CSS')
  await user.type(cssEditor, '.app { background: linear-gradient(45deg, #ff6b6b, #4ecdc4); }')

  // 4. 保存配置
  await saveSettings(user)
}

/**
 * 模拟错误恢复场景
 */
export async function simulateErrorRecovery(user: ReturnType<typeof userEvent.setup>) {
  // 1. 输入无效配置
  await inputWindowSize(user, 50, 50) // 无效尺寸
  await adjustCharacterScale(user, 20) // 无效缩放

  // 2. 尝试保存
  await saveSettings(user)

  // 3. 验证错误显示
  assertValidationErrors(['窗口宽度必须在 200-4000 之间'])

  // 4. 修正配置
  await inputWindowSize(user, 800, 600)
  await adjustCharacterScale(user, 1.0)

  // 5. 重新保存
  await saveSettings(user)
  await assertSaveSuccess()
}

// ==================== 性能测试辅助函数 ====================

/**
 * 测试大量配置更新的性能
 */
export async function testBulkConfigurationPerformance(user: ReturnType<typeof userEvent.setup>, iterations = 100) {
  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    await adjustCharacterScale(user, Math.random() * 4 + 0.5)
  }

  const endTime = performance.now()
  const duration = endTime - startTime

  console.log(`批量配置更新性能测试: ${iterations} 次操作耗时 ${duration.toFixed(2)}ms`)
  
  // 断言性能在可接受范围内 (每次操作 < 50ms)
  expect(duration / iterations).toBeLessThan(50)
}

/**
 * 测试组件重渲染性能
 */
export function testRenderPerformance() {
  const renderStart = performance.now()
  
  // 触发重渲染
  fireEvent.resize(window, { target: { innerWidth: 800 } })
  
  const renderEnd = performance.now()
  const renderTime = renderEnd - renderStart

  console.log(`组件重渲染耗时: ${renderTime.toFixed(2)}ms`)
  
  // 断言渲染时间 < 16ms (60fps)
  expect(renderTime).toBeLessThan(16)
}

// ==================== 数据验证辅助函数 ====================

/**
 * 验证配置数据完整性
 */
export function validateConfigIntegrity(config: AppConfig) {
  // 窗口配置验证
  expect(config.window.width).toBeGreaterThanOrEqual(200)
  expect(config.window.width).toBeLessThanOrEqual(4000)
  expect(config.window.height).toBeGreaterThanOrEqual(200)
  expect(config.window.height).toBeLessThanOrEqual(4000)

  // 角色配置验证
  expect(config.character.scale).toBeGreaterThanOrEqual(0.1)
  expect(config.character.scale).toBeLessThanOrEqual(5.0)
  expect(config.character.current_character).toBeTruthy()

  // 主题配置验证
  expect(['anime', 'modern', 'classic', 'dark', 'light', 'custom']).toContain(config.theme.current_theme)
}

/**
 * 验证设置同步状态
 */
export function validateSyncStatus(syncStatus: string, expectedStatus: string) {
  expect(syncStatus).toBe(expectedStatus)
}

/**
 * 验证错误状态
 */
export function validateErrorState(error: Error | null, expectedError?: string) {
  if (expectedError) {
    expect(error).toBeTruthy()
    expect(error?.message).toContain(expectedError)
  } else {
    expect(error).toBeNull()
  }
}

// ==================== 可访问性测试辅助函数 ====================

/**
 * 测试键盘导航
 */
export async function testKeyboardNavigation(user: ReturnType<typeof userEvent.setup>) {
  // 获取所有可聚焦元素
  const focusableElements = screen.getAllByRole('button').concat(
    screen.getAllByRole('textbox'),
    screen.getAllByRole('slider'),
    screen.getAllByRole('switch')
  )

  // 测试 Tab 键导航
  for (let i = 0; i < focusableElements.length; i++) {
    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(focusableElements[i])
  }
}

/**
 * 测试屏幕阅读器支持
 */
export function testScreenReaderSupport() {
  // 验证 ARIA 标签
  expect(screen.getByRole('main')).toHaveAttribute('aria-label', '设置面板')
  
  // 验证表单标签
  const formElements = screen.getAllByRole('textbox')
  formElements.forEach(element => {
    expect(element).toHaveAccessibleName()
  })

  // 验证开关状态
  const switches = screen.getAllByRole('switch')
  switches.forEach(switchElement => {
    expect(switchElement).toHaveAttribute('aria-checked')
  })
}

/**
 * 测试高对比度支持
 */
export function testHighContrastSupport() {
  // 模拟高对比度模式
  document.body.classList.add('high-contrast')
  
  // 验证关键元素仍然可见
  const criticalElements = [
    screen.getByText('保存'),
    screen.getByText('重置'),
    screen.getByLabelText('窗口宽度')
  ]

  criticalElements.forEach(element => {
    const styles = window.getComputedStyle(element)
    expect(styles.visibility).not.toBe('hidden')
    expect(styles.opacity).not.toBe('0')
  })

  // 清理
  document.body.classList.remove('high-contrast')
}

// ==================== 导出所有辅助函数 ====================

export const SettingsTestHelpers = {
  // 场景工厂
  createSettingsTestScenarios,
  
  // 断言函数
  assertConfigDisplayed,
  assertValidationErrors,
  assertSaveSuccess,
  assertSaveError,
  
  // 交互函数
  inputWindowSize,
  adjustCharacterScale,
  switchTheme,
  toggleSwitch,
  saveSettings,
  resetSettings,
  
  // 验证函数
  testWindowSizeValidation,
  testCharacterScaleValidation,
  
  // 场景函数
  simulateFirstTimeSetup,
  simulateAdvancedConfiguration,
  simulateErrorRecovery,
  
  // 性能测试
  testBulkConfigurationPerformance,
  testRenderPerformance,
  
  // 数据验证
  validateConfigIntegrity,
  validateSyncStatus,
  validateErrorState,
  
  // 可访问性测试
  testKeyboardNavigation,
  testScreenReaderSupport,
  testHighContrastSupport
}
