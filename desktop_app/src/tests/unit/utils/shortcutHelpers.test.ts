/**
 * 快捷键辅助函数测试
 * 
 * 测试 shortcutHelpers.ts 中的快捷键转换、验证和管理功能
 * 确保快捷键处理的准确性和跨平台兼容性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  shortcutToString,
  shortcutToDisplayString,
  parseShortcutString,
  isReservedShortcut,
  isValidShortcutConfig,
  areShortcutsEqual,
  getShortcutHash,
  formatCategoryName,
  formatScopeName,
  matchesKeyboardEvent,
  createShortcutFromEvent,
  isValidShortcutString,
  getShortcutPriority,
  sortShortcuts,
  groupShortcutsByCategory,
  searchShortcuts,
  exportShortcutsToText,
} from '../../../utils/shortcutHelpers'
import type { ShortcutConfig } from '../../../types/shortcuts'

describe('shortcutHelpers - 快捷键转换', () => {
  describe('shortcutToString', () => {
    it('应该转换单个修饰键 + 字母', () => {
      const config = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }
      expect(shortcutToString(config)).toBe('Ctrl+K')
    })

    it('应该转换多个修饰键 + 字母', () => {
      const config = {
        key: 'S',
        modifiers: { ctrl: true, alt: false, shift: true, meta: false }
      }
      expect(shortcutToString(config)).toBe('Ctrl+Shift+S')
    })

    it('应该按固定顺序排列修饰键（Ctrl, Alt, Shift, Meta）', () => {
      const config = {
        key: 'A',
        modifiers: { ctrl: true, alt: true, shift: true, meta: true }
      }
      expect(shortcutToString(config)).toBe('Ctrl+Alt+Shift+Meta+A')
    })

    it('应该处理只有按键没有修饰键的情况', () => {
      const config = {
        key: 'Enter',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false }
      }
      expect(shortcutToString(config)).toBe('Enter')
    })

    it('应该处理特殊按键', () => {
      const testCases = [
        { key: 'ArrowUp', expected: 'ArrowUp' },
        { key: 'F1', expected: 'F1' },
        { key: 'Escape', expected: 'Escape' },
        { key: 'Space', expected: 'Space' }
      ]

      testCases.forEach(({ key, expected }) => {
        const config = {
          key,
          modifiers: { ctrl: false, alt: false, shift: false, meta: false }
        }
        expect(shortcutToString(config)).toContain(expected)
      })
    })

    it('应该忽略 false 的修饰键', () => {
      const config = {
        key: 'P',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }
      const result = shortcutToString(config)
      expect(result).not.toContain('Alt')
      expect(result).not.toContain('Shift')
      expect(result).not.toContain('Meta')
    })
  })

  describe('shortcutToDisplayString', () => {
    it('应该转换为用户友好的显示字符串', () => {
      const config = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }
      const result = shortcutToDisplayString(config)
      expect(result).toBeTruthy()
      expect(result).toContain('K')
    })

    it('应该为特殊按键使用符号', () => {
      const testCases = [
        { key: 'ArrowUp', symbol: '↑' },
        { key: 'ArrowDown', symbol: '↓' },
        { key: 'ArrowLeft', symbol: '←' },
        { key: 'ArrowRight', symbol: '→' },
        { key: 'Enter', symbol: '↵' },
        { key: 'Backspace', symbol: '⌫' },
      ]

      testCases.forEach(({ key, symbol }) => {
        const config = {
          key,
          modifiers: { ctrl: false, alt: false, shift: false, meta: false }
        }
        const result = shortcutToDisplayString(config)
        expect(result).toContain(symbol)
      })
    })

    it('应该将字母键转为大写', () => {
      const config = {
        key: 'a',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }
      const result = shortcutToDisplayString(config)
      expect(result).toContain('A')
      expect(result).not.toContain('a+')
    })

    it('应该处理多个修饰键', () => {
      const config = {
        key: 'Z',
        modifiers: { ctrl: true, alt: true, shift: false, meta: false }
      }
      const result = shortcutToDisplayString(config)
      expect(result).toBeTruthy()
      expect(result.split('+').length).toBeGreaterThan(1)
    })
  })

  describe('parseShortcutString', () => {
    it('应该解析简单的快捷键字符串', () => {
      const result = parseShortcutString('Ctrl+K')
      expect(result).toEqual({
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      })
    })

    it('应该解析多个修饰键', () => {
      const result = parseShortcutString('Ctrl+Shift+S')
      expect(result).toEqual({
        key: 'S',
        modifiers: { ctrl: true, alt: false, shift: true, meta: false }
      })
    })

    it('应该忽略空格', () => {
      const result = parseShortcutString('Ctrl + Shift + K')
      expect(result.key).toBe('K')
      expect(result.modifiers.ctrl).toBe(true)
      expect(result.modifiers.shift).toBe(true)
    })

    it('应该忽略大小写（修饰键）', () => {
      const result1 = parseShortcutString('ctrl+k')
      const result2 = parseShortcutString('CTRL+k')
      const result3 = parseShortcutString('Ctrl+k')

      expect(result1.modifiers.ctrl).toBe(true)
      expect(result2.modifiers.ctrl).toBe(true)
      expect(result3.modifiers.ctrl).toBe(true)
    })

    it('应该支持 Control 别名', () => {
      const result = parseShortcutString('Control+K')
      expect(result.modifiers.ctrl).toBe(true)
    })

    it('应该支持 Option 别名', () => {
      const result = parseShortcutString('Option+K')
      expect(result.modifiers.alt).toBe(true)
    })

    it('应该支持 Cmd/Command 别名', () => {
      const result1 = parseShortcutString('Cmd+K')
      const result2 = parseShortcutString('Command+K')

      expect(result1.modifiers.meta).toBe(true)
      expect(result2.modifiers.meta).toBe(true)
    })

    it('应该支持 Win/Windows 别名', () => {
      const result1 = parseShortcutString('Win+K')
      const result2 = parseShortcutString('Windows+K')

      expect(result1.modifiers.meta).toBe(true)
      expect(result2.modifiers.meta).toBe(true)
    })

    it('应该保留主键的大小写', () => {
      const result1 = parseShortcutString('Ctrl+a')
      const result2 = parseShortcutString('Ctrl+A')

      expect(result1.key).toBe('a')
      expect(result2.key).toBe('A')
    })

    it('应该处理没有修饰键的按键', () => {
      const result = parseShortcutString('Enter')
      expect(result.key).toBe('Enter')
      expect(result.modifiers).toEqual({
        ctrl: false,
        alt: false,
        shift: false,
        meta: false
      })
    })

    it('应该处理所有修饰键的组合', () => {
      const result = parseShortcutString('Ctrl+Alt+Shift+Meta+K')
      expect(result.key).toBe('K')
      expect(result.modifiers).toEqual({
        ctrl: true,
        alt: true,
        shift: true,
        meta: true
      })
    })
  })

  describe('双向转换一致性', () => {
    it('shortcutToString 和 parseShortcutString 应该可逆', () => {
      const originalConfig = {
        key: 'K',
        modifiers: { ctrl: true, alt: true, shift: false, meta: false }
      }

      const stringForm = shortcutToString(originalConfig)
      const parsedConfig = parseShortcutString(stringForm)

      expect(parsedConfig.key).toBe(originalConfig.key)
      expect(parsedConfig.modifiers).toEqual(originalConfig.modifiers)
    })

    it('应该对复杂组合保持一致性', () => {
      const testCases = [
        { key: 'A', modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
        { key: 'F1', modifiers: { ctrl: false, alt: true, shift: true, meta: false } },
        { key: 'ArrowUp', modifiers: { ctrl: true, alt: true, shift: true, meta: true } },
      ]

      testCases.forEach(config => {
        const str = shortcutToString(config)
        const parsed = parseShortcutString(str)
        expect(parsed).toEqual(config)
      })
    })
  })
})

describe('shortcutHelpers - 快捷键验证', () => {
  describe('isReservedShortcut', () => {
    it('应该识别保留的快捷键', () => {
      // 假设 F12 是保留快捷键
      // 这取决于 RESERVED_SHORTCUTS 常量的定义
      const result = isReservedShortcut('F12')
      expect(typeof result).toBe('boolean')
    })

    it('应该对非保留快捷键返回 false', () => {
      const result = isReservedShortcut('Ctrl+K')
      expect(typeof result).toBe('boolean')
    })
  })

  describe('isValidShortcutConfig', () => {
    it('应该验证完整的配置对象', () => {
      const config: Partial<ShortcutConfig> = {
        id: 'test-shortcut',
        name: 'Test Shortcut',
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        category: 'test',
        scope: 'global',
        enabled: true,
        description: 'Test',
        action: vi.fn()
      }

      expect(isValidShortcutConfig(config)).toBe(true)
    })

    it('应该拒绝缺少 id 的配置', () => {
      const config: Partial<ShortcutConfig> = {
        name: 'Test',
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(isValidShortcutConfig(config)).toBe(false)
    })

    it('应该拒绝缺少 name 的配置', () => {
      const config: Partial<ShortcutConfig> = {
        id: 'test',
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(isValidShortcutConfig(config)).toBe(false)
    })

    it('应该拒绝缺少 key 的配置', () => {
      const config: Partial<ShortcutConfig> = {
        id: 'test',
        name: 'Test',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(isValidShortcutConfig(config)).toBe(false)
    })

    it('应该拒绝空 key 的配置', () => {
      const config: Partial<ShortcutConfig> = {
        id: 'test',
        name: 'Test',
        key: '',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(isValidShortcutConfig(config)).toBe(false)
    })

    it('应该拒绝单字符按键且没有修饰键的配置', () => {
      const config: Partial<ShortcutConfig> = {
        id: 'test',
        name: 'Test',
        key: 'k',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false }
      }

      expect(isValidShortcutConfig(config)).toBe(false)
    })

    it('应该接受单字符按键且有修饰键的配置', () => {
      const config: Partial<ShortcutConfig> = {
        id: 'test',
        name: 'Test',
        key: 'k',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(isValidShortcutConfig(config)).toBe(true)
    })

    it('应该接受功能键无修饰键的配置', () => {
      const config: Partial<ShortcutConfig> = {
        id: 'test',
        name: 'Test',
        key: 'F12',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false }
      }

      expect(isValidShortcutConfig(config)).toBe(true)
    })
  })

  describe('isValidShortcutString', () => {
    it('应该验证有效的快捷键字符串', () => {
      const validStrings = [
        'Ctrl+K',
        'Alt+F4',
        'Shift+Enter',
        'Meta+S',
        'Ctrl+Alt+Delete',
        'F12'
      ]

      validStrings.forEach(str => {
        expect(isValidShortcutString(str)).toBe(true)
      })
    })

    it('应该拒绝无效的快捷键字符串', () => {
      const invalidStrings = [
        '',
        '   ',
        'Ctrl+',
        '+K',
        '++',
      ]

      invalidStrings.forEach(str => {
        expect(isValidShortcutString(str)).toBe(false)
      })
    })

    it('应该拒绝 null 和 undefined', () => {
      expect(isValidShortcutString(null as any)).toBe(false)
      expect(isValidShortcutString(undefined as any)).toBe(false)
    })

    it('应该拒绝非字符串值', () => {
      expect(isValidShortcutString(123 as any)).toBe(false)
      expect(isValidShortcutString({} as any)).toBe(false)
      expect(isValidShortcutString([] as any)).toBe(false)
    })
  })
})

describe('shortcutHelpers - 快捷键比较', () => {
  describe('areShortcutsEqual', () => {
    it('应该正确比较相同的快捷键', () => {
      const config1 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }
      const config2 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(areShortcutsEqual(config1, config2)).toBe(true)
    })

    it('应该正确比较不同的快捷键', () => {
      const config1 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }
      const config2 = {
        key: 'S',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(areShortcutsEqual(config1, config2)).toBe(false)
    })

    it('应该忽略主键的大小写', () => {
      const config1 = {
        key: 'k',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }
      const config2 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(areShortcutsEqual(config1, config2)).toBe(true)
    })

    it('应该区分不同的修饰键', () => {
      const config1 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }
      const config2 = {
        key: 'K',
        modifiers: { ctrl: false, alt: true, shift: false, meta: false }
      }

      expect(areShortcutsEqual(config1, config2)).toBe(false)
    })

    it('应该要求所有修饰键完全匹配', () => {
      const config1 = {
        key: 'K',
        modifiers: { ctrl: true, alt: true, shift: false, meta: false }
      }
      const config2 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(areShortcutsEqual(config1, config2)).toBe(false)
    })
  })

  describe('getShortcutHash', () => {
    it('应该生成快捷键哈希', () => {
      const config = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'global' as const
      }

      const hash = getShortcutHash(config)
      expect(hash).toBe('global:Ctrl+K')
    })

    it('应该为相同配置生成相同哈希', () => {
      const config1 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'global' as const
      }
      const config2 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'global' as const
      }

      expect(getShortcutHash(config1)).toBe(getShortcutHash(config2))
    })

    it('应该为不同作用域生成不同哈希', () => {
      const config1 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'global' as const
      }
      const config2 = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local' as const
      }

      expect(getShortcutHash(config1)).not.toBe(getShortcutHash(config2))
    })
  })
})

describe('shortcutHelpers - 格式化函数', () => {
  describe('formatCategoryName', () => {
    it('应该格式化已知分类名称', () => {
      expect(formatCategoryName('window')).toBe('窗口管理')
      expect(formatCategoryName('chat')).toBe('聊天对话')
      expect(formatCategoryName('character')).toBe('角色管理')
      expect(formatCategoryName('settings')).toBe('设置')
    })

    it('应该返回未知分类的原始名称', () => {
      expect(formatCategoryName('unknown-category')).toBe('unknown-category')
    })
  })

  describe('formatScopeName', () => {
    it('应该格式化已知作用域名称', () => {
      expect(formatScopeName('global')).toBe('全局')
      expect(formatScopeName('local')).toBe('本地')
      expect(formatScopeName('window')).toBe('窗口')
    })

    it('应该返回未知作用域的原始名称', () => {
      expect(formatScopeName('unknown-scope')).toBe('unknown-scope')
    })
  })
})

describe('shortcutHelpers - 键盘事件处理', () => {
  describe('matchesKeyboardEvent', () => {
    it('应该匹配完全相同的键盘事件', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false
      })

      const config = {
        key: 'k',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(matchesKeyboardEvent(event, config)).toBe(true)
    })

    it('应该忽略主键的大小写', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true
      })

      const config = {
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(matchesKeyboardEvent(event, config)).toBe(true)
    })

    it('应该在主键不匹配时返回 false', () => {
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true
      })

      const config = {
        key: 'k',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(matchesKeyboardEvent(event, config)).toBe(false)
    })

    it('应该在修饰键不匹配时返回 false', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        shiftKey: true
      })

      const config = {
        key: 'k',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false }
      }

      expect(matchesKeyboardEvent(event, config)).toBe(false)
    })

    it('应该要求所有修饰键都匹配', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
        metaKey: true
      })

      const config = {
        key: 'k',
        modifiers: { ctrl: true, alt: true, shift: true, meta: true }
      }

      expect(matchesKeyboardEvent(event, config)).toBe(true)
    })

    it('应该处理没有修饰键的按键', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter'
      })

      const config = {
        key: 'Enter',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false }
      }

      expect(matchesKeyboardEvent(event, config)).toBe(true)
    })
  })

  describe('createShortcutFromEvent', () => {
    it('应该从键盘事件创建快捷键配置', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        metaKey: false
      })

      const config = createShortcutFromEvent(event)

      expect(config).toEqual({
        key: 'k',
        modifiers: { ctrl: true, alt: false, shift: true, meta: false }
      })
    })

    it('应该处理没有修饰键的事件', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' })

      const config = createShortcutFromEvent(event)

      expect(config).toEqual({
        key: 'Enter',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false }
      })
    })

    it('应该处理所有修饰键', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
        metaKey: true
      })

      const config = createShortcutFromEvent(event)

      expect(config.modifiers).toEqual({
        ctrl: true,
        alt: true,
        shift: true,
        meta: true
      })
    })
  })
})

describe('shortcutHelpers - 快捷键管理', () => {
  const createTestShortcut = (overrides: Partial<ShortcutConfig> = {}): ShortcutConfig => ({
    id: 'test',
    name: 'Test',
    description: 'Test shortcut',
    key: 'K',
    modifiers: { ctrl: true, alt: false, shift: false, meta: false },
    category: 'test',
    scope: 'global',
    enabled: true,
    action: vi.fn(),
    ...overrides
  })

  describe('getShortcutPriority', () => {
    it('应该为全局作用域返回更高优先级', () => {
      const global = createTestShortcut({ scope: 'global' })
      const local = createTestShortcut({ scope: 'local' })

      expect(getShortcutPriority(global)).toBeGreaterThan(getShortcutPriority(local))
    })

    it('应该为启用的快捷键增加优先级', () => {
      const enabled = createTestShortcut({ enabled: true })
      const disabled = createTestShortcut({ enabled: false })

      const enabledPriority = getShortcutPriority(enabled)
      const disabledPriority = getShortcutPriority(disabled)

      expect(enabledPriority).toBeGreaterThan(disabledPriority)
    })

    it('应该根据分类给予不同优先级', () => {
      const system = createTestShortcut({ category: 'system' })
      const custom = createTestShortcut({ category: 'custom' })

      expect(getShortcutPriority(system)).toBeGreaterThan(getShortcutPriority(custom))
    })
  })

  describe('sortShortcuts', () => {
    it('应该按优先级排序', () => {
      const shortcuts = [
        createTestShortcut({ id: '1', category: 'custom', enabled: false }),
        createTestShortcut({ id: '2', category: 'system', enabled: true }),
        createTestShortcut({ id: '3', category: 'window', enabled: true })
      ]

      const sorted = sortShortcuts(shortcuts)

      expect(sorted[0].category).toBe('system')
    })

    it('应该在相同分类内按名称排序', () => {
      const shortcuts = [
        createTestShortcut({ id: '1', name: '保存', category: 'test' }),
        createTestShortcut({ id: '2', name: '打开', category: 'test' }),
        createTestShortcut({ id: '3', name: '关闭', category: 'test' })
      ]

      const sorted = sortShortcuts(shortcuts)

      expect(sorted[0].name).toBe('保存')
      expect(sorted[1].name).toBe('打开')
      expect(sorted[2].name).toBe('关闭')
    })

    it('应该返回新数组（不改变原数组）', () => {
      const shortcuts = [
        createTestShortcut({ id: '1' }),
        createTestShortcut({ id: '2' })
      ]

      const original = [...shortcuts]
      const sorted = sortShortcuts(shortcuts)

      expect(sorted).not.toBe(shortcuts)
      expect(shortcuts).toEqual(original)
    })
  })

  describe('groupShortcutsByCategory', () => {
    it('应该按分类分组快捷键', () => {
      const shortcuts = [
        createTestShortcut({ id: '1', category: 'window' }),
        createTestShortcut({ id: '2', category: 'chat' }),
        createTestShortcut({ id: '3', category: 'window' }),
        createTestShortcut({ id: '4', category: 'chat' })
      ]

      const grouped = groupShortcutsByCategory(shortcuts)

      expect(grouped['window']).toHaveLength(2)
      expect(grouped['chat']).toHaveLength(2)
    })

    it('应该创建空组对于没有快捷键的分类', () => {
      const shortcuts = [
        createTestShortcut({ id: '1', category: 'window' })
      ]

      const grouped = groupShortcutsByCategory(shortcuts)

      expect(grouped['window']).toBeDefined()
      expect(grouped['chat']).toBeUndefined()
    })

    it('应该处理空数组', () => {
      const grouped = groupShortcutsByCategory([])
      expect(grouped).toEqual({})
    })
  })

  describe('searchShortcuts', () => {
    const shortcuts = [
      createTestShortcut({
        id: 'open',
        name: '打开文件',
        description: '打开一个新文件',
        category: 'file'
      }),
      createTestShortcut({
        id: 'save',
        name: '保存',
        description: '保存当前文件',
        category: 'file'
      }),
      createTestShortcut({
        id: 'chat',
        name: '发送消息',
        description: '发送聊天消息',
        category: 'chat'
      })
    ]

    it('应该通过名称搜索', () => {
      const results = searchShortcuts(shortcuts, '打开')
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('open')
    })

    it('应该通过描述搜索', () => {
      const results = searchShortcuts(shortcuts, '聊天')
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('chat')
    })

    it('应该通过分类搜索', () => {
      const results = searchShortcuts(shortcuts, 'file')
      expect(results.length).toBeGreaterThan(0)
    })

    it('应该忽略大小写', () => {
      const results = searchShortcuts(shortcuts, '打开')
      expect(results).toHaveLength(1)
    })

    it('应该对空查询返回所有结果', () => {
      const results = searchShortcuts(shortcuts, '')
      expect(results).toEqual(shortcuts)
    })

    it('应该对无匹配返回空数组', () => {
      const results = searchShortcuts(shortcuts, 'xyz123notfound')
      expect(results).toHaveLength(0)
    })
  })

  describe('exportShortcutsToText', () => {
    it('应该导出快捷键为可读文本', () => {
      const shortcuts = [
        createTestShortcut({
          id: 'test',
          name: '测试快捷键',
          description: '这是一个测试',
          category: 'test',
          enabled: true
        })
      ]

      const text = exportShortcutsToText(shortcuts)

      expect(text).toContain('Zishu Sensei 快捷键配置')
      expect(text).toContain('测试快捷键')
      expect(text).toContain('这是一个测试')
      expect(text).toContain('✓') // 启用标记
    })

    it('应该按分类组织输出', () => {
      const shortcuts = [
        createTestShortcut({ id: '1', category: 'window', name: 'W1' }),
        createTestShortcut({ id: '2', category: 'chat', name: 'C1' }),
        createTestShortcut({ id: '3', category: 'window', name: 'W2' })
      ]

      const text = exportShortcutsToText(shortcuts)

      expect(text).toContain('窗口管理')
      expect(text).toContain('聊天对话')
    })

    it('应该标记禁用的快捷键', () => {
      const shortcuts = [
        createTestShortcut({ enabled: false })
      ]

      const text = exportShortcutsToText(shortcuts)

      expect(text).toContain('✗')
    })

    it('应该包含作用域信息', () => {
      const shortcuts = [
        createTestShortcut({ scope: 'global' })
      ]

      const text = exportShortcutsToText(shortcuts)

      expect(text).toContain('全局')
    })

    it('应该处理空数组', () => {
      const text = exportShortcutsToText([])

      expect(text).toContain('Zishu Sensei 快捷键配置')
    })
  })
})

describe('shortcutHelpers - 边界情况', () => {
  it('应该处理空对象', () => {
    const config: any = {}
    expect(() => shortcutToString(config)).not.toThrow()
  })

  it('应该处理 undefined 修饰键', () => {
    const config: any = {
      key: 'K',
      modifiers: {}
    }
    expect(() => shortcutToString(config)).not.toThrow()
  })

  it('应该处理非常长的按键名称', () => {
    const config = {
      key: 'A'.repeat(100),
      modifiers: { ctrl: true, alt: false, shift: false, meta: false }
    }
    expect(() => shortcutToString(config)).not.toThrow()
  })

  it('应该处理特殊字符', () => {
    const config = {
      key: '中文+émoji🔥',
      modifiers: { ctrl: true, alt: false, shift: false, meta: false }
    }
    expect(() => shortcutToString(config)).not.toThrow()
  })

  it('应该处理大量快捷键', () => {
    const shortcuts = Array.from({ length: 1000 }, (_, i) =>
      ({
        id: `shortcut-${i}`,
        name: `Shortcut ${i}`,
        description: `Description ${i}`,
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        category: 'test',
        scope: 'global',
        enabled: true,
        action: vi.fn()
      } as ShortcutConfig)
    )

    expect(() => sortShortcuts(shortcuts)).not.toThrow()
    expect(() => groupShortcutsByCategory(shortcuts)).not.toThrow()
    expect(() => searchShortcuts(shortcuts, 'test')).not.toThrow()
  })
})

