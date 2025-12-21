import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { Live2DViewer } from './Live2D/Live2DViewer'
import { ModelSelector } from './ModelSelector'
import { Live2DModelConfig, Live2DViewerConfig } from '@/types/live2d'
import { modelManager } from '@/utils/modelManager'
import { useModelLoader } from './ModelLoader'
import { CharacterTransitionWithLoading, TransitionType } from './Animations/CharacterTransition'

interface Character {
    id: string
    name: string
    avatar: string
    description: string
}

interface CharacterProps {
    character: Character | null
    onInteraction: (type: string, data: any) => void
    showModelSelector?: boolean
}

/**
 * 角色组件 - 使用Live2D渲染，支持动态模型切换
 */
export const Character: React.FC<CharacterProps> = ({
    character,
    onInteraction,
    showModelSelector = false,
}) => {
    // 状态管理
    const [currentModelId, setCurrentModelId] = useState<string | null>(null)
    const [modelConfig, setModelConfig] = useState<Live2DModelConfig | null>(null)
    const [isLoadingModel, setIsLoadingModel] = useState(true)
    const [transitionType, setTransitionType] = useState<TransitionType>('fade')

    // 使用模型加载器 Hook
    const { currentCharacter, characterList, loadCharacters, switchCharacter } = useModelLoader()

    // 初始化：加载当前激活的角色
    useEffect(() => {
        const initializeCharacter = async () => {
            try {
                console.log('🔄 初始化加载角色列表...')
                await loadCharacters()
            } catch (error) {
                console.error('❌ 初始化加载角色失败:', error)
            }
        }
        initializeCharacter()
    }, [loadCharacters])

    // 当后端角色改变时，更新前端模型
    useEffect(() => {
        console.log('[Character] 🔍 currentCharacter 变化:', currentCharacter)
        if (currentCharacter) {
            console.log('[Character] 🔄 后端角色切换到:', currentCharacter.id, '名称:', currentCharacter.name)
            setCurrentModelId(currentCharacter.id)
            // 根据角色特性选择不同的过渡动画
            const animations: TransitionType[] = ['fade', 'slide-left', 'zoom', 'dissolve']
            const randomAnimation = animations[Math.floor(Math.random() * animations.length)]
            setTransitionType(randomAnimation)
            console.log('[Character] ✅ 已设置新的 modelId:', currentCharacter.id)
        } else {
            console.log('[Character] ⚠️ currentCharacter 为 null')
        }
    }, [currentCharacter])

    // 加载模型配置
    useEffect(() => {
        // 只有当 currentModelId 已设置时才加载
        if (!currentModelId) {
            return
        }

        const loadModelConfig = async () => {
            try {
                setIsLoadingModel(true)
                const config = await modelManager.createModelConfig(currentModelId)
                setModelConfig(config)
                modelManager.setCurrentModelId(currentModelId)
                console.log('✅ 模型配置加载成功:', currentModelId)
            } catch (error) {
                console.error('❌ 加载模型配置失败:', error)
                // 回退到默认模型
                if (currentModelId !== 'hiyori') {
                    console.warn('⚠️ 回退到默认模型 hiyori')
                    setCurrentModelId('hiyori')
                }
            } finally {
                setIsLoadingModel(false)
            }
        }

        loadModelConfig()
    }, [currentModelId])

    // 处理模型切换
    const handleModelSelect = useCallback(async (modelId: string) => {
        console.log('🔄 切换模型:', modelId)
        try {
            // 调用后端 API 切换角色
            await switchCharacter(modelId)
            onInteraction?.('model_changed', { character, modelId })
        } catch (error) {
            console.error('❌ 切换模型失败:', error)
            onInteraction?.('model_error', { character, error })
        }
    }, [character, onInteraction, switchCharacter])

    // Live2D查看器配置 - 使用useMemo缓存以避免不必要的重新渲染
    const viewerConfig: Live2DViewerConfig = useMemo(() => ({
        canvasSize: { width: 400, height: 600 },
        renderConfig: {
            scale: 1.0, // 使用自动缩放
            position: { x: 0, y: 0 }, // 居中显示
            opacity: 1.0
        },
        enableInteraction: true,
        enableAutoIdleAnimation: true,
        idleAnimationInterval: 10000,
        controls: {
            showPlayPause: false,
            showAnimationSelector: false,
            showExpressionSelector: false,
            showZoomControls: false,
            showResetPosition: false,
            showFullscreen: false,
            showSettings: false,
            position: 'bottom',
            autoHide: true,
            autoHideDelay: 3000
        },
        performance: {
            targetFPS: 60,
            enableMonitoring: false,
            memoryLimit: 512,
            enableTextureCompression: true,
            renderQuality: 'high',
            antiAliasing: true
        },
        debugMode: false,
        responsive: true
    }), []) // 空依赖数组，配置永不改变

    // 处理Live2D交互事件
    const handleLive2DInteraction = useCallback((event: any) => {
        onInteraction?.('live2d_interaction', { 
            character, 
            event,
            type: event.type,
            position: event.position 
        })
    }, [character, onInteraction])

    // 处理模型加载完成
    const handleModelLoad = useCallback((modelId: string) => {
        console.log('Live2D模型加载完成:', modelId)
        onInteraction?.('model_loaded', { character, modelId })
    }, [character, onInteraction])

    // 处理错误
    const handleError = useCallback((error: Error) => {
        console.error('Live2D模型加载错误:', error)
        onInteraction?.('model_error', { character, error })
    }, [character, onInteraction])

    return (
        <div 
            style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {character && (
                <>
                    {/* 模型选择器 */}
                    {showModelSelector && currentModelId && (
                        <div style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            zIndex: 1000,
                            width: '280px',
                        }}>
                            <ModelSelector
                                currentModelId={currentModelId}
                                onModelSelect={handleModelSelect}
                                models={characterList}
                            />
                        </div>
                    )}

                    {/* 带过渡动画的 Live2D 查看器 */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {currentModelId ? (
                            <CharacterTransitionWithLoading
                                characterId={currentModelId}
                                transitionType={transitionType}
                                duration={600}
                                isLoading={isLoadingModel || !modelConfig}
                                loadingText={`加载 ${currentCharacter?.name || '角色'} 中...`}
                                onTransitionComplete={() => {
                                    console.log('✅ 角色过渡动画完成:', currentModelId)
                                }}
                            >
                                {modelConfig && (
                                    <Live2DViewer
                                        key={currentModelId} // 强制重新挂载以切换模型
                                        config={viewerConfig}
                                        modelConfig={modelConfig}
                                        onInteraction={handleLive2DInteraction}
                                        onModelLoad={handleModelLoad}
                                        onError={handleError}
                                        className=""
                                        style={{
                                            background: 'transparent'
                                        }}
                                    />
                            )}
                        </CharacterTransitionWithLoading>
                        ) : (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#666',
                            }}>
                                加载角色中...
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
