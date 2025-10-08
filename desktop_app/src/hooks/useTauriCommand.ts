/**
 * Tauri 命令 Hook
 * 
 * 提供类型安全的 Tauri 命令调用 React Hook
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { commandService } from '../services/tauri/commands'
import type {
    AppCommand,
    CommandState,
    ExtractCommandPayload,
    TauriResponse
} from '../types/tauri'

/**
 * Tauri 命令执行 Hook
 */
export function useTauriCommand<T extends AppCommand>(
    command: T,
    options: {
        immediate?: boolean
        onSuccess?: (data: any) => void
        onError?: (error: string) => void
        retryCount?: number
        retryDelay?: number
    } = {}
): CommandState<any> & {
    execute: (payload?: ExtractCommandPayload<T>) => Promise<any>
} {
    const [state, setState] = useState<CommandState<any>>({
        data: null,
        loading: false,
        error: null,
        isReady: true,
        execute: async () => null,
        reset: () => { }
    })

    const abortControllerRef = useRef<AbortController | null>(null)
    const retryCountRef = useRef(0)
    const { immediate = false, onSuccess, onError, retryCount = 0, retryDelay = 1000 } = options

    /**
     * 执行命令
     */
    const execute = useCallback(async (payload?: ExtractCommandPayload<T>) => {
        // 取消之前的请求
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        abortControllerRef.current = new AbortController()

        setState(prev => ({
            ...prev,
            loading: true,
            error: null
        }))

        const executeWithRetry = async (attempt: number): Promise<any> => {
            try {
                const response = await commandService.execute(command, payload)

                if (response.success) {
                    setState(prev => ({
                        ...prev,
                        data: response.data,
                        loading: false,
                        error: null
                    }))

                    onSuccess?.(response.data)
                    retryCountRef.current = 0
                    return response.data
                } else {
                    throw new Error(response.error || 'Command execution failed')
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)

                // 重试逻辑
                if (attempt < retryCount) {
                    console.warn(`Command '${command}' failed, retrying... (${attempt + 1}/${retryCount})`)
                    await new Promise(resolve => setTimeout(resolve, retryDelay))
                    return executeWithRetry(attempt + 1)
                }

                setState(prev => ({
                    ...prev,
                    data: null,
                    loading: false,
                    error: errorMessage
                }))

                onError?.(errorMessage)
                throw error
            }
        }

        return executeWithRetry(0)
    }, [command, onSuccess, onError, retryCount, retryDelay])

    /**
     * 重置状态
     */
    const reset = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        setState({
            data: null,
            loading: false,
            error: null,
            isReady: true,
            execute,
            reset: () => { }
        })

        retryCountRef.current = 0
    }, [execute])

    // 更新状态中的函数
    useEffect(() => {
        setState(prev => ({
            ...prev,
            execute,
            reset
        }))
    }, [execute, reset])

    // 立即执行
    useEffect(() => {
        if (immediate) {
            execute().catch(console.error)
        }
    }, [immediate, execute])

    // 清理
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [])

    return {
        ...state,
        execute
    }
}

/**
 * 批量命令执行 Hook
 */
export function useTauriCommandBatch(): {
    execute: (commands: Array<{
        command: AppCommand
        payload?: any
    }>) => Promise<TauriResponse<any>[]>
    loading: boolean
    error: string | null
    results: TauriResponse<any>[] | null
    reset: () => void
} {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [results, setResults] = useState<TauriResponse<any>[] | null>(null)

    const execute = useCallback(async (commands: Array<{
        command: AppCommand
        payload?: any
    }>) => {
        setLoading(true)
        setError(null)
        setResults(null)

        try {
            const responses = await commandService.executeBatch(commands)
            setResults(responses)
            return responses
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            setError(errorMessage)
            throw error
        } finally {
            setLoading(false)
        }
    }, [])

    const reset = useCallback(() => {
        setLoading(false)
        setError(null)
        setResults(null)
    }, [])

    return {
        execute,
        loading,
        error,
        results,
        reset
    }
}

/**
 * 特定命令的便捷 Hook
 */

/**
 * 窗口管理命令 Hook
 */
export function useWindowCommands() {
    const createWindow = useTauriCommand('create_window')
    const closeWindow = useTauriCommand('close_window')
    const showWindow = useTauriCommand('show_window')
    const hideWindow = useTauriCommand('hide_window')
    const focusWindow = useTauriCommand('focus_window')
    const minimizeWindow = useTauriCommand('minimize_window')
    const maximizeWindow = useTauriCommand('maximize_window')

    return {
        createWindow: createWindow.execute,
        closeWindow: closeWindow.execute,
        showWindow: showWindow.execute,
        hideWindow: hideWindow.execute,
        focusWindow: focusWindow.execute,
        minimizeWindow: minimizeWindow.execute,
        maximizeWindow: maximizeWindow.execute,
        loading: createWindow.loading || closeWindow.loading || showWindow.loading ||
            hideWindow.loading || focusWindow.loading || minimizeWindow.loading ||
            maximizeWindow.loading,
        error: createWindow.error || closeWindow.error || showWindow.error ||
            hideWindow.error || focusWindow.error || minimizeWindow.error ||
            maximizeWindow.error
    }
}

/**
 * 文件操作命令 Hook
 */
export function useFileCommands() {
    const readFile = useTauriCommand('read_file')
    const writeFile = useTauriCommand('write_file')
    const readDir = useTauriCommand('read_dir')
    const createDir = useTauriCommand('create_dir')
    const removeFile = useTauriCommand('remove_file')
    const removeDir = useTauriCommand('remove_dir')
    const copyFile = useTauriCommand('copy_file')
    const moveFile = useTauriCommand('move_file')
    const fileExists = useTauriCommand('file_exists')

    return {
        readFile: readFile.execute,
        writeFile: writeFile.execute,
        readDir: readDir.execute,
        createDir: createDir.execute,
        removeFile: removeFile.execute,
        removeDir: removeDir.execute,
        copyFile: copyFile.execute,
        moveFile: moveFile.execute,
        fileExists: fileExists.execute,
        loading: readFile.loading || writeFile.loading || readDir.loading ||
            createDir.loading || removeFile.loading || removeDir.loading ||
            copyFile.loading || moveFile.loading || fileExists.loading,
        error: readFile.error || writeFile.error || readDir.error ||
            createDir.error || removeFile.error || removeDir.error ||
            copyFile.error || moveFile.error || fileExists.error
    }
}

/**
 * 对话框命令 Hook
 */
export function useDialogCommands() {
    const showMessage = useTauriCommand('show_message')
    const showConfirm = useTauriCommand('show_confirm')
    const showOpenDialog = useTauriCommand('show_open_dialog')
    const showSaveDialog = useTauriCommand('show_save_dialog')

    return {
        showMessage: showMessage.execute,
        showConfirm: showConfirm.execute,
        showOpenDialog: showOpenDialog.execute,
        showSaveDialog: showSaveDialog.execute,
        loading: showMessage.loading || showConfirm.loading ||
            showOpenDialog.loading || showSaveDialog.loading,
        error: showMessage.error || showConfirm.error ||
            showOpenDialog.error || showSaveDialog.error
    }
}

/**
 * 系统命令 Hook
 */
export function useSystemCommands() {
    const getSystemInfo = useTauriCommand('get_system_info')
    const getAppVersion = useTauriCommand('get_app_version')
    const restartApp = useTauriCommand('restart_app')
    const exitApp = useTauriCommand('exit_app')
    const openUrl = useTauriCommand('open_url')
    const showInFolder = useTauriCommand('show_in_folder')

    return {
        getSystemInfo: getSystemInfo.execute,
        getAppVersion: getAppVersion.execute,
        restartApp: restartApp.execute,
        exitApp: exitApp.execute,
        openUrl: openUrl.execute,
        showInFolder: showInFolder.execute,
        loading: getSystemInfo.loading || getAppVersion.loading || restartApp.loading ||
            exitApp.loading || openUrl.loading || showInFolder.loading,
        error: getSystemInfo.error || getAppVersion.error || restartApp.error ||
            exitApp.error || openUrl.error || showInFolder.error
    }
}

/**
 * 应用特定命令 Hook
 */
export function useAppCommands() {
    const getCharacterList = useTauriCommand('get_character_list')
    const loadCharacter = useTauriCommand('load_character')
    const saveSettings = useTauriCommand('save_settings')
    const loadSettings = useTauriCommand('load_settings')
    const getAdapterList = useTauriCommand('get_adapter_list')
    const installAdapter = useTauriCommand('install_adapter')
    const uninstallAdapter = useTauriCommand('uninstall_adapter')
    const executeAdapter = useTauriCommand('execute_adapter')

    return {
        getCharacterList: getCharacterList.execute,
        loadCharacter: loadCharacter.execute,
        saveSettings: saveSettings.execute,
        loadSettings: loadSettings.execute,
        getAdapterList: getAdapterList.execute,
        installAdapter: installAdapter.execute,
        uninstallAdapter: uninstallAdapter.execute,
        executeAdapter: executeAdapter.execute,
        loading: getCharacterList.loading || loadCharacter.loading || saveSettings.loading ||
            loadSettings.loading || getAdapterList.loading || installAdapter.loading ||
            uninstallAdapter.loading || executeAdapter.loading,
        error: getCharacterList.error || loadCharacter.error || saveSettings.error ||
            loadSettings.error || getAdapterList.error || installAdapter.error ||
            uninstallAdapter.error || executeAdapter.error
    }
}
