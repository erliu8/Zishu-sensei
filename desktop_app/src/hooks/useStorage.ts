import { useCallback, useEffect, useState } from 'react'
import { useTauri } from './useTauri'

/**
 * 存储类型
 */
type StorageType = 'local' | 'session' | 'tauri'

/**
 * 存储选项
 */
interface StorageOptions {
    type?: StorageType
    defaultValue?: any
    serialize?: (value: any) => string
    deserialize?: (value: string) => any
}

/**
 * 存储管理器 Hook 返回值
 */
interface UseStorageReturn<T> {
    value: T
    setValue: (value: T | ((prev: T) => T)) => Promise<void>
    removeValue: () => Promise<void>
    isLoading: boolean
    error: string | null
}

/**
 * 默认序列化/反序列化函数
 */
const defaultSerialize = (value: any): string => JSON.stringify(value)
const defaultDeserialize = (value: string): any => JSON.parse(value)

/**
 * 存储管理 Hook
 */
export const useStorage = <T = any>(
    key: string,
    options: StorageOptions = {}
): UseStorageReturn<T> => {
    const {
        type = 'local',
        defaultValue,
        serialize = defaultSerialize,
        deserialize = defaultDeserialize,
    } = options

    const { isAvailable, invoke } = useTauri()
    const [value, setValue] = useState<T>(defaultValue)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // 获取存储引擎
    const getStorage = useCallback(() => {
        switch (type) {
            case 'session':
                return sessionStorage
            case 'local':
                return localStorage
            case 'tauri':
                return null // 使用 Tauri 后端存储
            default:
                return localStorage
        }
    }, [type])

    // 从存储中读取值
    const loadValue = useCallback(async (): Promise<T> => {
        if (type === 'tauri' && isAvailable) {
            // 从 Tauri 后端读取
            try {
                const storedValue = await invoke<string>('storage_get', { key })
                return storedValue ? deserialize(storedValue) : defaultValue
            } catch (err) {
                console.warn(`Failed to load from Tauri storage: ${err}`)
                return defaultValue
            }
        } else {
            // 从浏览器存储读取
            const storage = getStorage()
            if (!storage) return defaultValue

            try {
                const storedValue = storage.getItem(key)
                return storedValue ? deserialize(storedValue) : defaultValue
            } catch (err) {
                console.warn(`Failed to deserialize stored value: ${err}`)
                return defaultValue
            }
        }
    }, [key, type, isAvailable, invoke, deserialize, defaultValue, getStorage])

    // 保存值到存储
    const saveValue = useCallback(async (newValue: T): Promise<void> => {
        if (type === 'tauri' && isAvailable) {
            // 保存到 Tauri 后端
            try {
                const serializedValue = serialize(newValue)
                await invoke('storage_set', { key, value: serializedValue })
            } catch (err) {
                throw new Error(`Failed to save to Tauri storage: ${err}`)
            }
        } else {
            // 保存到浏览器存储
            const storage = getStorage()
            if (!storage) {
                throw new Error('Storage not available')
            }

            try {
                const serializedValue = serialize(newValue)
                storage.setItem(key, serializedValue)
            } catch (err) {
                throw new Error(`Failed to serialize value: ${err}`)
            }
        }
    }, [key, type, isAvailable, invoke, serialize, getStorage])

    // 从存储中删除值
    const removeValue = useCallback(async (): Promise<void> => {
        setError(null)

        try {
            if (type === 'tauri' && isAvailable) {
                // 从 Tauri 后端删除
                await invoke('storage_remove', { key })
            } else {
                // 从浏览器存储删除
                const storage = getStorage()
                if (storage) {
                    storage.removeItem(key)
                }
            }

            setValue(defaultValue)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to remove value'
            setError(errorMessage)
            console.error('Failed to remove value from storage:', err)
        }
    }, [key, type, isAvailable, invoke, getStorage, defaultValue])

    // 更新值
    const updateValue = useCallback(async (newValue: T | ((prev: T) => T)): Promise<void> => {
        setError(null)

        try {
            const actualValue = typeof newValue === 'function'
                ? (newValue as (prev: T) => T)(value)
                : newValue

            await saveValue(actualValue)
            setValue(actualValue)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update value'
            setError(errorMessage)
            console.error('Failed to update storage value:', err)
        }
    }, [value, saveValue])

    // 初始化加载值
    useEffect(() => {
        const initializeValue = async () => {
            setIsLoading(true)
            setError(null)

            try {
                const loadedValue = await loadValue()
                setValue(loadedValue)
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load value'
                setError(errorMessage)
                console.error('Failed to load storage value:', err)
                setValue(defaultValue)
            } finally {
                setIsLoading(false)
            }
        }

        initializeValue()
    }, [loadValue, defaultValue])

    // 监听存储变化（仅浏览器存储）
    useEffect(() => {
        if (type === 'tauri' || typeof window === 'undefined') return

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === key && event.storageArea === getStorage()) {
                try {
                    const newValue = event.newValue ? deserialize(event.newValue) : defaultValue
                    setValue(newValue)
                } catch (err) {
                    console.warn('Failed to deserialize storage change:', err)
                }
            }
        }

        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [key, type, getStorage, deserialize, defaultValue])

    return {
        value,
        setValue: updateValue,
        removeValue,
        isLoading,
        error,
    }
}

/**
 * 本地存储 Hook
 */
export const useLocalStorage = <T = any>(
    key: string,
    defaultValue?: T
): UseStorageReturn<T> => {
    return useStorage<T>(key, { type: 'local', defaultValue })
}

/**
 * 会话存储 Hook
 */
export const useSessionStorage = <T = any>(
    key: string,
    defaultValue?: T
): UseStorageReturn<T> => {
    return useStorage<T>(key, { type: 'session', defaultValue })
}

/**
 * Tauri 存储 Hook
 */
export const useTauriStorage = <T = any>(
    key: string,
    defaultValue?: T
): UseStorageReturn<T> => {
    return useStorage<T>(key, { type: 'tauri', defaultValue })
}
