/**
 * 通用工具类 Hooks
 * 
 * 包含常用的工具 Hooks：防抖、节流、窗口尺寸、媒体查询等
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ==================== 类型定义 ====================

interface WindowSize {
  width: number
  height: number
  orientation: 'portrait' | 'landscape'
}

interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

interface CounterOptions {
  min?: number
  max?: number
}

interface WindowSizeOptions {
  throttle?: number
}

interface ArrayOperations<T> {
  value: T[]
  push: (item: T) => void
  pop: () => T | undefined
  shift: () => T | undefined
  unshift: (item: T) => void
  remove: (index: number) => void
  clear: () => void
  update: (index: number, item: T) => void
  insert: (index: number, item: T) => void
}

// ==================== useDebounce Hook ====================

/**
 * 防抖 Hook
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    if (delay === 0) {
      setDebouncedValue(value)
      return
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

// ==================== useThrottle Hook ====================

/**
 * 节流 Hook
 * @param value 需要节流的值
 * @param delay 节流时间（毫秒）
 * @param options 节流选项
 * @returns 节流后的值
 */
export function useThrottle<T>(value: T, delay: number, options: ThrottleOptions = {}): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastExecuted = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const lastValue = useRef<T>(value)

  const { leading = true, trailing = false } = options

  useEffect(() => {
    lastValue.current = value
    const now = Date.now()
    const timeSinceLastExecution = now - lastExecuted.current

    // 如果是第一次执行或者已经超过了节流时间
    if (leading && (lastExecuted.current === 0 || timeSinceLastExecution >= delay)) {
      setThrottledValue(value)
      lastExecuted.current = now
    } else if (trailing) {
      // 清除之前的延时
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // 设置新的延时，在节流期结束时执行
      const remainingTime = delay - timeSinceLastExecution
      timeoutRef.current = setTimeout(() => {
        setThrottledValue(lastValue.current)
        lastExecuted.current = Date.now()
      }, Math.max(remainingTime, 0))
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delay, leading, trailing])

  return throttledValue
}

// ==================== useWindowSize Hook ====================

/**
 * 窗口尺寸 Hook
 * @param options 配置选项
 * @returns 窗口尺寸信息
 */
export function useWindowSize(options: WindowSizeOptions = {}): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
  }))

  const { throttle = 0 } = options

  const updateSize = useCallback(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    setWindowSize({
      width,
      height,
      orientation: width > height ? 'landscape' : 'portrait',
    })
  }, [])

  const throttledUpdateSize = useMemo(() => {
    if (throttle === 0) return updateSize
    
    let timeoutId: NodeJS.Timeout | undefined
    let lastExecution = 0
    let isThrottling = false
    
    return () => {
      const now = Date.now()
      
      // 如果不在节流期间，立即执行
      if (now - lastExecution >= throttle) {
        updateSize()
        lastExecution = now
      } else if (!isThrottling) {
        // 如果在节流期间但还没有设置延时器，设置延时器
        isThrottling = true
        const remainingTime = throttle - (now - lastExecution)
        
        timeoutId = setTimeout(() => {
          updateSize()
          lastExecution = Date.now()
          isThrottling = false
        }, remainingTime)
      }
      // 如果正在节流期间且已经设置了延时器，忽略这次调用
    }
  }, [updateSize, throttle])

  useEffect(() => {
    const handleResize = throttle > 0 ? throttledUpdateSize : updateSize
    
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [updateSize, throttledUpdateSize, throttle])

  return windowSize
}

// ==================== useMediaQuery Hook ====================

/**
 * 媒体查询 Hook
 * @param query 媒体查询字符串或查询对象
 * @returns 匹配结果
 */
export function useMediaQuery(query: string): boolean
export function useMediaQuery(queries: Record<string, string>): Record<string, boolean>
export function useMediaQuery(query: string | Record<string, string>): boolean | Record<string, boolean> {
  const [matches, setMatches] = useState(() => {
    if (typeof query === 'string') {
      return window.matchMedia(query).matches
    } else {
      const result: Record<string, boolean> = {}
      Object.entries(query).forEach(([key, value]) => {
        result[key] = window.matchMedia(value).matches
      })
      return result
    }
  })

  useEffect(() => {
    if (typeof query === 'string') {
      const mediaQueryList = window.matchMedia(query)
      const handleChange = (e: MediaQueryListEvent) => {
        setMatches(e.matches)
      }

      mediaQueryList.addEventListener('change', handleChange)
      return () => mediaQueryList.removeEventListener('change', handleChange)
    } else {
      const mediaQueryLists: Array<{ key: string; mql: MediaQueryList }> = []
      
      Object.entries(query).forEach(([key, value]) => {
        const mql = window.matchMedia(value)
        mediaQueryLists.push({ key, mql })
      })

      const handleChange = () => {
        const result: Record<string, boolean> = {}
        mediaQueryLists.forEach(({ key, mql }) => {
          result[key] = mql.matches
        })
        setMatches(result)
      }

      mediaQueryLists.forEach(({ mql }) => {
        mql.addEventListener('change', handleChange)
      })

      return () => {
        mediaQueryLists.forEach(({ mql }) => {
          mql.removeEventListener('change', handleChange)
        })
      }
    }
  }, [query])

  return matches
}

// ==================== useClickOutside Hook ====================

/**
 * 点击外部检测 Hook
 * @param ref 元素引用或引用数组
 * @param callback 点击外部时的回调函数
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement> | React.RefObject<HTMLElement>[],
  callback: () => void
): void {
  useEffect(() => {
    const handleClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (!target) return
      
      const refs = Array.isArray(ref) ? ref : [ref]
      const isOutside = refs.every(r => 
        !r.current || !r.current.contains(target)
      )
      
      if (isOutside) {
        callback()
      }
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)

    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [ref, callback])
}

// ==================== useKeyPress Hook ====================

/**
 * 按键检测 Hook
 * @param targetKey 目标按键或按键数组
 * @param callback 可选的回调函数
 * @returns 按键是否被按下
 */
export function useKeyPress(
  targetKey: string | string[],
  callback?: (event: KeyboardEvent) => void
): boolean {
  const [keyPressed, setKeyPressed] = useState(false)

  useEffect(() => {
    const isTargetKey = (key: string) => {
      const keys = Array.isArray(targetKey) ? targetKey : [targetKey]
      
      // 处理组合键
      if (key.includes('+')) {
        // 这里简化处理，实际项目中可能需要更复杂的组合键逻辑
        return keys.includes(key)
      }
      
      // 处理空格键
      if (key === ' ') {
        return keys.includes('Space') || keys.includes(' ')
      }
      
      return keys.includes(key)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      let keyToCheck = event.key
      
      // 处理组合键
      if (event.ctrlKey && event.key !== 'Control') {
        keyToCheck = `ctrl+${event.key.toLowerCase()}`
      }
      
      if (isTargetKey(keyToCheck)) {
        setKeyPressed(true)
        callback?.(event)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      let keyToCheck = event.key
      
      if (event.key !== 'Control' && !event.ctrlKey) {
        // 组合键释放时的处理
        if (isTargetKey(keyToCheck) || isTargetKey(`ctrl+${keyToCheck.toLowerCase()}`)) {
          setKeyPressed(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [targetKey, callback])

  return keyPressed
}

// ==================== useOnlineStatus Hook ====================

/**
 * 网络状态 Hook
 * @returns 是否在线
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// ==================== useLocalTime Hook ====================

/**
 * 本地时间 Hook
 * @param interval 更新间隔（毫秒）
 * @returns 当前时间
 */
export function useLocalTime(interval: number = 1000): Date {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, interval)

    return () => clearInterval(timer)
  }, [interval])

  return time
}

// ==================== useInterval Hook ====================

/**
 * 定时器 Hook
 * @param callback 回调函数
 * @param delay 延迟时间（毫秒），为null时停止
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef<() => void>()

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return

    const tick = () => {
      savedCallback.current?.()
    }

    const timer = setInterval(tick, delay)
    return () => clearInterval(timer)
  }, [delay])
}

// ==================== useTimeout Hook ====================

/**
 * 延时器 Hook
 * @param callback 回调函数
 * @param delay 延迟时间（毫秒）
 */
export function useTimeout(callback: () => void, delay: number): void {
  const savedCallback = useRef<() => void>()

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    const timer = setTimeout(() => {
      savedCallback.current?.()
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])
}

// ==================== usePrevious Hook ====================

/**
 * 获取前一个值的 Hook
 * @param value 当前值
 * @returns 前一个值
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()
  
  useEffect(() => {
    ref.current = value
  }, [value])
  
  return ref.current
}

// ==================== useToggle Hook ====================

/**
 * 切换状态 Hook
 * @param initialValue 初始值
 * @returns [当前值, 切换函数]
 */
export function useToggle(initialValue: boolean = false): [boolean, (value?: boolean) => void] {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback((newValue?: boolean) => {
    setValue(prev => newValue !== undefined ? newValue : !prev)
  }, [])

  return [value, toggle]
}

// ==================== useCounter Hook ====================

/**
 * 计数器 Hook
 * @param initialValue 初始值
 * @param options 选项
 * @returns 计数器对象
 */
export function useCounter(initialValue: number = 0, options: CounterOptions = {}) {
  const [count, setCount] = useState(initialValue)
  const { min, max } = options

  const clampValue = useCallback((value: number) => {
    if (min !== undefined && value < min) return min
    if (max !== undefined && value > max) return max
    return value
  }, [min, max])

  const increment = useCallback((step: number = 1) => {
    setCount(prev => clampValue(prev + step))
  }, [clampValue])

  const decrement = useCallback((step: number = 1) => {
    setCount(prev => clampValue(prev - step))
  }, [clampValue])

  const set = useCallback((value: number) => {
    setCount(clampValue(value))
  }, [clampValue])

  const reset = useCallback(() => {
    setCount(initialValue)
  }, [initialValue])

  return {
    count,
    increment,
    decrement,
    set,
    reset,
  }
}

// ==================== useArray Hook ====================

/**
 * 数组操作 Hook
 * @param initialValue 初始数组
 * @returns 数组操作对象
 */
export function useArray<T>(initialValue: T[] = []): ArrayOperations<T> {
  const [array, setArray] = useState<T[]>(initialValue)

  const push = useCallback((item: T) => {
    setArray(prev => [...prev, item])
  }, [])

  const pop = useCallback(() => {
    let poppedItem: T | undefined
    setArray(prev => {
      poppedItem = prev[prev.length - 1]
      return prev.slice(0, -1)
    })
    return poppedItem
  }, [])

  const shift = useCallback(() => {
    let shiftedItem: T | undefined
    setArray(prev => {
      shiftedItem = prev[0]
      return prev.slice(1)
    })
    return shiftedItem
  }, [])

  const unshift = useCallback((item: T) => {
    setArray(prev => [item, ...prev])
  }, [])

  const remove = useCallback((index: number) => {
    setArray(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clear = useCallback(() => {
    setArray([])
  }, [])

  const update = useCallback((index: number, item: T) => {
    setArray(prev => prev.map((prevItem, i) => i === index ? item : prevItem))
  }, [])

  const insert = useCallback((index: number, item: T) => {
    setArray(prev => [
      ...prev.slice(0, index),
      item,
      ...prev.slice(index)
    ])
  }, [])

  return {
    value: array,
    push,
    pop,
    shift,
    unshift,
    remove,
    clear,
    update,
    insert,
  }
}
