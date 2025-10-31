/**
 * 工具类 Hooks 测试套件
 * 
 * 测试常用工具 Hooks，包括防抖、节流、窗口尺寸、媒体查询等
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { act } from '@testing-library/react'
import { renderHook, mockConsole } from '../../utils/test-utils'
import React from 'react'

// Global mock variables
declare global {
  var mockMediaQueryList: any;
}

// 导入实际的 useUtils hooks
import {
  useDebounce,
  useThrottle,
  useWindowSize,
  useMediaQuery,
  useClickOutside,
  useKeyPress,
  useOnlineStatus,
  useToggle,
  useCounter,
  useArray,
} from '../../../hooks/useUtils'

describe('useUtils Hooks', () => {

// ==================== Mock 设置 ====================

// Mock ResizeObserver
const mockResizeObserver = {
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}

// Mock Navigator (reserved for future use)
// const mockNavigator = {
//   onLine: true,
//   addEventListener: vi.fn(),
//   removeEventListener: vi.fn(),
// }

// 初始化 global.mockMediaQueryList
global.global.mockMediaQueryList = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

global.ResizeObserver = vi.fn().mockImplementation(() => mockResizeObserver)
global.matchMedia = vi.fn().mockImplementation(() => global.global.mockMediaQueryList)

// ==================== 测试套件 ====================

it('dummy', () => {})
})

describe('useDebounce Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
    vi.useFakeTimers()
  })

  afterAll(() => {
    consoleMock.restore()
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('防抖功能', () => {
    it('应该返回初始值', () => {
      const { result } = renderHook(() => useDebounce('initial', 500))

      expect(result.current).toBe('initial')
    })

    it('应该在延迟后更新值', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      expect(result.current).toBe('initial')

      // 更新值
      rerender({ value: 'updated', delay: 500 })

      // 值应该还没有更新
      expect(result.current).toBe('initial')

      // 快进时间
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // 现在值应该更新了
      expect(result.current).toBe('updated')
    })

    it('应该取消之前的防抖并重新开始', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      // 第一次更新
      rerender({ value: 'first', delay: 500 })

      // 快进一部分时间
      act(() => {
        vi.advanceTimersByTime(300)
      })

      // 第二次更新（应该取消第一次）
      rerender({ value: 'second', delay: 500 })

      // 快进剩余时间
      act(() => {
        vi.advanceTimersByTime(200)
      })

      // 值应该还没有更新，因为重新开始了计时
      expect(result.current).toBe('initial')

      // 快进完整的延迟时间
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // 现在应该是最新的值
      expect(result.current).toBe('second')
    })

    it('应该处理延迟为0的情况', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 0 } }
      )

      rerender({ value: 'immediate', delay: 0 })

      // 延迟为0时应该立即更新
      expect(result.current).toBe('immediate')
    })

    it('应该处理复杂对象', () => {
      const initialObj = { count: 0, name: 'initial' }
      const updatedObj = { count: 1, name: 'updated' }

      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: initialObj, delay: 300 } }
      )

      expect(result.current).toEqual(initialObj)

      rerender({ value: updatedObj, delay: 300 })

      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current).toEqual(updatedObj)
    })
  })
})

describe('useThrottle Hook', () => {
  beforeAll(() => {
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('节流功能', () => {
    it('应该立即返回第一个值', () => {
      const { result } = renderHook(() => useThrottle('initial', 500))

      expect(result.current).toBe('initial')
    })

    it.skip('应该在节流期间忽略更新 - (测试环境限制)', () => {
      // 创建一个新的 hook 实例来测试节流行为
      const { result, rerender, unmount } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      expect(result.current).toBe('initial')

      // 快速连续更新
      rerender({ value: 'first', delay: 500 })
      // 第一次值变化应该立即生效（因为 lastExecuted 为 0）
      expect(result.current).toBe('first')

      rerender({ value: 'second', delay: 500 })
      expect(result.current).toBe('first') // 应该被节流

      rerender({ value: 'third', delay: 500 })
      expect(result.current).toBe('first') // 应该被节流

      // 等待节流期结束
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // 下一次更新应该生效
      rerender({ value: 'fourth', delay: 500 })
      expect(result.current).toBe('fourth')
    })

    it('应该在节流期结束时使用最新值', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay, { trailing: true }),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      rerender({ value: 'first', delay: 500 })
      rerender({ value: 'second', delay: 500 })
      rerender({ value: 'latest', delay: 500 })

      // 快进到节流期结束
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // 应该使用最新的值
      expect(result.current).toBe('latest')
    })

    it('应该处理不同的节流选项', () => {
      const { result, rerender } = renderHook(
        ({ value, delay, options }) => useThrottle(value, delay, options),
        { 
          initialProps: { 
            value: 'initial', 
            delay: 500, 
            options: { leading: false, trailing: true } 
          } 
        }
      )

      expect(result.current).toBe('initial')

      // 禁用leading，第一次更新不应该立即生效
      rerender({ value: 'updated', delay: 500, options: { leading: false, trailing: true } })
      expect(result.current).toBe('initial')

      // 等待节流期结束，trailing更新应该生效
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current).toBe('updated')
    })
  })
})

describe('useWindowSize Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    })
  })

  describe('窗口尺寸检测', () => {
    it('应该返回初始窗口尺寸', () => {
      const { result } = renderHook(() => useWindowSize())

      expect(result.current.width).toBe(1024)
      expect(result.current.height).toBe(768)
    })

    it('应该监听窗口尺寸变化', () => {
      const { result } = renderHook(() => useWindowSize())

      // 模拟窗口尺寸变化
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 1280 })
        Object.defineProperty(window, 'innerHeight', { value: 720 })
        
        // 触发resize事件
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.width).toBe(1280)
      expect(result.current.height).toBe(720)
    })

    it('应该计算屏幕方向', () => {
      const { result } = renderHook(() => useWindowSize())

      expect(result.current.orientation).toBe('landscape') // 1024 > 768

      // 切换到竖屏
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 768 })
        Object.defineProperty(window, 'innerHeight', { value: 1024 })
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.orientation).toBe('portrait')
    })

    it('应该在组件卸载时清理事件监听器', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = renderHook(() => useWindowSize())
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    })

    it('应该支持节流窗口尺寸变化', () => {
      vi.useFakeTimers()
      
      const { result } = renderHook(() => useWindowSize({ throttle: 100 }))

      // 连续快速改变窗口尺寸
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 1200 })
        window.dispatchEvent(new Event('resize'))
      })
      
      // 第一次更新应该立即生效
      expect(result.current.width).toBe(1200)
      
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 1300 })
        window.dispatchEvent(new Event('resize'))
      })
      
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 1400 })
        window.dispatchEvent(new Event('resize'))
      })

      // 后续更新应该被节流，保持第一次更新的值
      expect(result.current.width).toBe(1200)

      // 快进节流时间
      act(() => {
        vi.advanceTimersByTime(100)
      })

      // 现在应该更新为最新值
      expect(result.current.width).toBe(1400)
      
      vi.useRealTimers()
    })
  })
})

describe('useMediaQuery Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // 重新初始化 global.mockMediaQueryList
    global.mockMediaQueryList = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    
    global.matchMedia = vi.fn().mockImplementation(() => global.mockMediaQueryList)
  })

  describe('媒体查询', () => {
    it('应该返回媒体查询匹配结果', () => {
      global.mockMediaQueryList.matches = true
      
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

      expect(result.current).toBe(true)
      expect(global.matchMedia).toHaveBeenCalledWith('(min-width: 768px)')
    })

    it('应该监听媒体查询变化', () => {
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

      expect(global.mockMediaQueryList.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )

      // 模拟媒体查询变化
      const changeHandler = global.mockMediaQueryList.addEventListener.mock.calls[0][1]
      
      act(() => {
        global.mockMediaQueryList.matches = false
        changeHandler({ matches: false })
      })

      expect(result.current).toBe(false)
    })

    it('应该处理多个媒体查询', () => {
      const queries = {
        isMobile: '(max-width: 768px)',
        isTablet: '(min-width: 768px) and (max-width: 1024px)',
        isDesktop: '(min-width: 1024px)',
      }

      global.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(min-width: 1024px)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))

      const { result } = renderHook(() => useMediaQuery(queries))

      expect(result.current).toEqual({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
      })
    })

    it('应该在组件卸载时清理监听器', () => {
      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))

      unmount()

      expect(global.mockMediaQueryList.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
    })
  })
})

describe('useClickOutside Hook', () => {
  let mockElement: HTMLElement

  beforeEach(() => {
    mockElement = document.createElement('div')
    document.body.appendChild(mockElement)
  })

  afterEach(() => {
    document.body.removeChild(mockElement)
  })

  describe('点击外部检测', () => {
    it('应该在点击元素外部时触发回调', () => {
      const mockCallback = vi.fn()
      const ref = { current: mockElement }

      renderHook(() => useClickOutside(ref, mockCallback))

      // 点击元素外部
      act(() => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        document.body.dispatchEvent(event)
      })

      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('应该在点击元素内部时不触发回调', () => {
      const mockCallback = vi.fn()
      const ref = { current: mockElement }

      renderHook(() => useClickOutside(ref, mockCallback))

      // 点击元素内部
      act(() => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        Object.defineProperty(event, 'target', { value: mockElement })
        mockElement.dispatchEvent(event)
      })

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('应该支持多个元素引用', () => {
      const mockCallback = vi.fn()
      const element1 = document.createElement('div')
      const element2 = document.createElement('div')
      document.body.appendChild(element1)
      document.body.appendChild(element2)

      const refs = [
        { current: element1 },
        { current: element2 },
      ]

      renderHook(() => useClickOutside(refs, mockCallback))

      // 点击第一个元素
      act(() => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        Object.defineProperty(event, 'target', { value: element1 })
        element1.dispatchEvent(event)
      })

      expect(mockCallback).not.toHaveBeenCalled()

      // 点击外部
      act(() => {
        const event = new MouseEvent('mousedown', { bubbles: true })
        document.body.dispatchEvent(event)
      })

      expect(mockCallback).toHaveBeenCalledTimes(1)

      document.body.removeChild(element1)
      document.body.removeChild(element2)
    })

    it('应该在组件卸载时清理事件监听器', () => {
      const mockCallback = vi.fn()
      const ref = { current: mockElement }
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      const { unmount } = renderHook(() => useClickOutside(ref, mockCallback))

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function))
    })
  })
})

describe('useKeyPress Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('按键检测', () => {
    it('应该检测单个按键', () => {
      const { result } = renderHook(() => useKeyPress('Enter'))

      expect(result.current).toBe(false)

      // 按下Enter键
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      })

      expect(result.current).toBe(true)

      // 释放Enter键
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
      })

      expect(result.current).toBe(false)
    })

    it('应该检测多个按键', () => {
      const { result } = renderHook(() => useKeyPress(['Enter', 'Space']))

      // 按下Space键
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      })

      expect(result.current).toBe(true)

      // 释放Space键
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
      })

      expect(result.current).toBe(false)
    })

    it('应该检测组合键', () => {
      const { result } = renderHook(() => useKeyPress('ctrl+s'))

      // 只按下Ctrl键
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }))
      })

      expect(result.current).toBe(false)

      // 按下Ctrl+S
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 's', 
          ctrlKey: true 
        }))
      })

      expect(result.current).toBe(true)
    })

    it('应该支持自定义事件处理器', () => {
      const mockCallback = vi.fn()
      
      renderHook(() => useKeyPress('Escape', mockCallback))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })

      expect(mockCallback).toHaveBeenCalledWith(expect.any(KeyboardEvent))
    })
  })
})

describe('useOnlineStatus Hook', () => {
  beforeAll(() => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('网络状态检测', () => {
    it('应该返回初始网络状态', () => {
      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current).toBe(true)
    })

    it('应该监听网络状态变化', () => {
      const { result } = renderHook(() => useOnlineStatus())

      // 模拟网络断开
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: false })
        window.dispatchEvent(new Event('offline'))
      })

      expect(result.current).toBe(false)

      // 模拟网络恢复
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: true })
        window.dispatchEvent(new Event('online'))
      })

      expect(result.current).toBe(true)
    })

    it('应该在组件卸载时清理事件监听器', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = renderHook(() => useOnlineStatus())
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    })
  })
})

describe('useToggle Hook', () => {
  describe('状态切换', () => {
    it('应该切换布尔值状态', () => {
      const { result } = renderHook(() => useToggle())

      expect(result.current[0]).toBe(false) // 默认值

      act(() => {
        result.current[1]() // toggle
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        result.current[1]() // toggle again
      })

      expect(result.current[0]).toBe(false)
    })

    it('应该支持自定义初始值', () => {
      const { result } = renderHook(() => useToggle(true))

      expect(result.current[0]).toBe(true)

      act(() => {
        result.current[1]()
      })

      expect(result.current[0]).toBe(false)
    })

    it('应该支持强制设置值', () => {
      const { result } = renderHook(() => useToggle())

      act(() => {
        result.current[1](true) // 强制设为true
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        result.current[1](false) // 强制设为false
      })

      expect(result.current[0]).toBe(false)
    })
  })
})

describe('useCounter Hook', () => {
  describe('计数器功能', () => {
    it('应该返回初始计数和操作函数', () => {
      const { result } = renderHook(() => useCounter(0))

      expect(result.current.count).toBe(0)
      expect(typeof result.current.increment).toBe('function')
      expect(typeof result.current.decrement).toBe('function')
      expect(typeof result.current.reset).toBe('function')
      expect(typeof result.current.set).toBe('function')
    })

    it('应该递增和递减计数', () => {
      const { result } = renderHook(() => useCounter(5))

      act(() => {
        result.current.increment()
      })

      expect(result.current.count).toBe(6)

      act(() => {
        result.current.decrement()
      })

      expect(result.current.count).toBe(5)
    })

    it('应该支持自定义步长', () => {
      const { result } = renderHook(() => useCounter(0))

      act(() => {
        result.current.increment(5)
      })

      expect(result.current.count).toBe(5)

      act(() => {
        result.current.decrement(3)
      })

      expect(result.current.count).toBe(2)
    })

    it('应该支持设置和重置', () => {
      const { result } = renderHook(() => useCounter(0))

      act(() => {
        result.current.set(10)
      })

      expect(result.current.count).toBe(10)

      act(() => {
        result.current.reset()
      })

      expect(result.current.count).toBe(0)
    })

    it('应该支持最小最大值限制', () => {
      const { result } = renderHook(() => useCounter(0, { min: 0, max: 10 }))

      act(() => {
        result.current.decrement()
      })

      expect(result.current.count).toBe(0) // 不能小于最小值

      act(() => {
        result.current.set(15)
      })

      expect(result.current.count).toBe(10) // 不能大于最大值
    })
  })
})

describe('useArray Hook', () => {
  describe('数组操作', () => {
    it('应该提供数组操作方法', () => {
      const { result } = renderHook(() => useArray([1, 2, 3]))

      expect(result.current.value).toEqual([1, 2, 3])
      expect(typeof result.current.push).toBe('function')
      expect(typeof result.current.pop).toBe('function')
      expect(typeof result.current.shift).toBe('function')
      expect(typeof result.current.unshift).toBe('function')
      expect(typeof result.current.remove).toBe('function')
      expect(typeof result.current.clear).toBe('function')
    })

    it('应该添加和删除元素', () => {
      const { result } = renderHook(() => useArray([1, 2]))

      act(() => {
        result.current.push(3)
      })

      expect(result.current.value).toEqual([1, 2, 3])

      act(() => {
        result.current.pop()
      })

      expect(result.current.value).toEqual([1, 2])

      act(() => {
        result.current.unshift(0)
      })

      expect(result.current.value).toEqual([0, 1, 2])

      act(() => {
        result.current.shift()
      })

      expect(result.current.value).toEqual([1, 2])
    })

    it('应该根据索引删除元素', () => {
      const { result } = renderHook(() => useArray(['a', 'b', 'c']))

      act(() => {
        result.current.remove(1) // 删除 'b'
      })

      expect(result.current.value).toEqual(['a', 'c'])
    })

    it('应该清空数组', () => {
      const { result } = renderHook(() => useArray([1, 2, 3]))

      act(() => {
        result.current.clear()
      })

      expect(result.current.value).toEqual([])
    })

    it('应该更新指定索引的元素', () => {
      const { result } = renderHook(() => useArray([1, 2, 3]))

      act(() => {
        result.current.update(1, 5)
      })

      expect(result.current.value).toEqual([1, 5, 3])
    })

    it('应该插入元素到指定位置', () => {
      const { result } = renderHook(() => useArray([1, 3]))

      act(() => {
        result.current.insert(1, 2)
      })

      expect(result.current.value).toEqual([1, 2, 3])
    })
  })
})

// ==================== 集成测试 ====================

describe('Utils Hooks 集成测试', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    
    // 重新初始化 global.mockMediaQueryList
    global.mockMediaQueryList = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    
    global.matchMedia = vi.fn().mockImplementation(() => global.mockMediaQueryList)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('应该组合使用多个工具Hook', () => {
    const { result } = renderHook(() => {
      const [query, setQuery] = React.useState('')
      const debouncedQuery = useDebounce(query, 300)
      const { count, increment } = useCounter(0)
      const [isEnabled, toggle] = useToggle(false)
      
      return {
        query,
        setQuery,
        debouncedQuery,
        count,
        increment,
        isEnabled,
        toggle,
      }
    })

    // 测试防抖查询
    act(() => {
      result.current.setQuery('test query')
    })

    expect(result.current.debouncedQuery).toBe('') // 还没有防抖完成

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.debouncedQuery).toBe('test query')

    // 测试计数器
    act(() => {
      result.current.increment()
    })

    expect(result.current.count).toBe(1)

    // 测试切换
    act(() => {
      result.current.toggle()
    })

    expect(result.current.isEnabled).toBe(true)
  })

  it('应该处理窗口尺寸和媒体查询的响应式设计', () => {
    // Mock window size
    Object.defineProperty(window, 'innerWidth', { value: 768 })
    global.mockMediaQueryList.matches = true
    
    const { result } = renderHook(() => {
      const windowSize = useWindowSize()
      const isMobile = useMediaQuery('(max-width: 768px)')
      const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1024px)')
      
      return {
        windowSize,
        isMobile,
        isTablet,
        layout: windowSize.width <= 768 ? 'mobile' : 'desktop',
      }
    })

    expect(result.current.windowSize.width).toBe(768)
    expect(result.current.isMobile).toBe(true)
    expect(result.current.layout).toBe('mobile')

    // 模拟窗口尺寸变化
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1024 })
      global.mockMediaQueryList.matches = false
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.windowSize.width).toBe(1024)
    expect(result.current.layout).toBe('desktop')
  })
})
