/**
 * ModelLoader 组件
 * 负责从后端API加载角色列表并处理模型切换
 */

import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'

export interface CharacterInfo {
    id: string
    name: string
    description?: string
    preview_image?: string
    motions: string[]
    expressions: string[]
    is_active: boolean
}

export interface ApiResponse<T> {
    success: boolean
    data?: T
    message?: string
    error?: string
}

interface ModelLoaderProps {
    onCharacterLoaded?: (character: CharacterInfo) => void
    onCharacterChanged?: (oldId: string | null, newId: string) => void
    onError?: (error: string) => void
}

/**
 * ModelLoader - 管理角色加载和切换
 */
export const ModelLoader: React.FC<ModelLoaderProps> = ({
    onCharacterLoaded,
    onCharacterChanged,
    onError,
}) => {
    const [currentCharacter, setCurrentCharacter] = useState<CharacterInfo | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    /**
     * 从后端获取角色列表
     */
    const loadCharacters = useCallback(async () => {
        try {
            setIsLoading(true)
            const response = await invoke<ApiResponse<CharacterInfo[]>>('get_characters')
            
            if (!response.success || !response.data) {
                throw new Error(response.error || '获取角色列表失败')
            }

            // 找到当前激活的角色
            const activeCharacter = response.data.find(c => c.is_active)
            if (activeCharacter) {
                setCurrentCharacter(activeCharacter)
                onCharacterLoaded?.(activeCharacter)
            } else if (response.data.length > 0) {
                // 如果没有激活的角色，激活第一个
                await switchCharacter(response.data[0].id)
            }
        } catch (error) {
            console.error('❌ 加载角色失败:', error)
            const errorMsg = error instanceof Error ? error.message : '未知错误'
            onError?.(errorMsg)
        } finally {
            setIsLoading(false)
        }
    }, [onCharacterLoaded, onError])

    /**
     * 切换角色
     */
    const switchCharacter = useCallback(async (characterId: string) => {
        try {
            setIsLoading(true)
            const response = await invoke<ApiResponse<CharacterInfo>>('switch_character', {
                characterId,
            })

            if (!response.success || !response.data) {
                throw new Error(response.error || '切换角色失败')
            }

            const oldCharacter = currentCharacter
            setCurrentCharacter(response.data)
            onCharacterChanged?.(oldCharacter?.id || null, response.data.id)
            
            console.log('✅ 角色切换成功:', response.data.name)
        } catch (error) {
            console.error('❌ 切换角色失败:', error)
            const errorMsg = error instanceof Error ? error.message : '未知错误'
            onError?.(errorMsg)
        } finally {
            setIsLoading(false)
        }
    }, [currentCharacter, onCharacterChanged, onError])

    /**
     * 获取角色详细信息
     */
    const getCharacterInfo = useCallback(async (characterId: string) => {
        try {
            const response = await invoke<ApiResponse<CharacterInfo>>('get_character_info', {
                characterId,
            })

            if (!response.success || !response.data) {
                throw new Error(response.error || '获取角色信息失败')
            }

            return response.data
        } catch (error) {
            console.error('❌ 获取角色信息失败:', error)
            const errorMsg = error instanceof Error ? error.message : '未知错误'
            onError?.(errorMsg)
            return null
        }
    }, [onError])

    // 监听角色切换事件（从其他地方触发）
    useEffect(() => {
        const unlistenCharacterChanged = listen<{
            old_character: string | null
            new_character: string
            character_info: CharacterInfo
        }>('character-changed', (event) => {
            console.log('🔄 收到角色切换事件:', event.payload)
            setCurrentCharacter(event.payload.character_info)
            onCharacterChanged?.(
                event.payload.old_character,
                event.payload.new_character
            )
        })

        return () => {
            unlistenCharacterChanged.then(fn => fn())
        }
    }, [onCharacterChanged])

    // 初始加载
    useEffect(() => {
        loadCharacters()
    }, [])

    return null // 这是一个逻辑组件，不渲染任何 UI
}

/**
 * 导出辅助函数供其他组件使用
 */
export const useModelLoader = () => {
    const [currentCharacter, setCurrentCharacter] = useState<CharacterInfo | null>(null)

    const loadCharacters = useCallback(async (): Promise<CharacterInfo[]> => {
        const response = await invoke<ApiResponse<CharacterInfo[]>>('get_characters')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '获取角色列表失败')
        }

        // 更新当前角色
        const activeCharacter = response.data.find(c => c.is_active)
        if (activeCharacter) {
            setCurrentCharacter(activeCharacter)
        }

        return response.data
    }, [])

    const switchCharacter = useCallback(async (characterId: string): Promise<CharacterInfo> => {
        const response = await invoke<ApiResponse<CharacterInfo>>('switch_character', {
            characterId,
        })

        if (!response.success || !response.data) {
            throw new Error(response.error || '切换角色失败')
        }

        setCurrentCharacter(response.data)
        return response.data
    }, [])

    const getCharacterInfo = useCallback(async (characterId: string): Promise<CharacterInfo | null> => {
        const response = await invoke<ApiResponse<CharacterInfo>>('get_character_info', {
            characterId,
        })

        if (!response.success || !response.data) {
            throw new Error(response.error || '获取角色信息失败')
        }

        return response.data
    }, [])

    return {
        currentCharacter,
        loadCharacters,
        switchCharacter,
        getCharacterInfo,
    }
}

