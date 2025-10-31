/**
 * useAutoSave Hook
 * 提供自动保存功能，带防抖处理
 */

import { useEffect, useRef, useCallback } from 'react'

export interface UseAutoSaveOptions<T> {
  data: T
  onSave: (data: T) => Promise<void> | void
  delay?: number // 防抖延迟时间（毫秒）
  enabled?: boolean // 是否启用自动保存
  onSaveSuccess?: () => void
  onSaveError?: (error: Error) => void
}

export interface UseAutoSaveReturn {
  isSaving: boolean
  lastSavedAt: Date | null
  saveNow: () => Promise<void>
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 2000,
  enabled = true,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const isSavingRef = useRef(false)
  const lastSavedAtRef = useRef<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousDataRef = useRef<T>(data)

  const saveNow = useCallback(async () => {
    if (isSavingRef.current) return

    try {
      isSavingRef.current = true
      await onSave(data)
      lastSavedAtRef.current = new Date()
      previousDataRef.current = data
      onSaveSuccess?.()
    } catch (error) {
      onSaveError?.(error as Error)
    } finally {
      isSavingRef.current = false
    }
  }, [data, onSave, onSaveSuccess, onSaveError])

  useEffect(() => {
    if (!enabled) return

    // 检查数据是否变化
    if (JSON.stringify(data) === JSON.stringify(previousDataRef.current)) {
      return
    }

    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // 设置新的定时器
    timeoutRef.current = setTimeout(() => {
      saveNow()
    }, delay)

    // 清理函数
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, delay, enabled, saveNow])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    isSaving: isSavingRef.current,
    lastSavedAt: lastSavedAtRef.current,
    saveNow,
  }
}

