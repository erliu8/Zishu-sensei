import React, { useCallback } from 'react'
import { Live2DViewer } from './Live2D/Live2DViewer'
import { Live2DModelConfig, Live2DViewerConfig, Live2DAnimationPriority } from '@/types/live2d'

interface Character {
    id: string
    name: string
    avatar: string
    description: string
}

interface CharacterProps {
    character: Character | null
    onInteraction: (type: string, data: any) => void
}

/**
 * 角色组件 - 使用Live2D渲染
 */
export const Character: React.FC<CharacterProps> = ({
    character,
    onInteraction,
}) => {
    if (!character) return null

    // Hiyori模型配置
    const hiyoriModelConfig: Live2DModelConfig = {
        id: 'hiyori',
        name: 'Hiyori Momose',
        modelPath: '/live2d_models/hiyori/hiyori.model3.json',
        previewImage: '/live2d_models/hiyori/icon.jpg',
        description: '桃瀬ひより - 可爱的女孩子',
        author: 'Live2D Inc.',
        version: '1.0.0',
        tags: ['girl', 'cute', 'anime'],
        animations: {
            idle: [
                { name: 'idle_01', file: 'animations/idle_01.motion3.json', priority: Live2DAnimationPriority.IDLE },
                { name: 'idle_02', file: 'animations/idle_02.motion3.json', priority: Live2DAnimationPriority.IDLE }
            ],
            tap: [
                { name: 'tap_body', file: 'animations/tap_body.motion3.json', priority: Live2DAnimationPriority.NORMAL }
            ]
        },
        expressions: [
            { name: 'default', file: 'expressions/default.exp3.json' },
            { name: 'happy', file: 'expressions/happy.exp3.json' },
            { name: 'sad', file: 'expressions/sad.exp3.json' }
        ],
        physics: '/live2d_models/hiyori/hiyori.physics3.json',
        metadata: {
            modelSize: { width: 1024, height: 1024 },
            canvasSize: { width: 400, height: 600 },
            pixelsPerUnit: 1.0,
            originX: 0.5,
            originY: 0.5
        }
    }

    // Live2D查看器配置
    const viewerConfig: Live2DViewerConfig = {
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
    }

    // 处理Live2D交互事件
    const handleLive2DInteraction = useCallback((event: any) => {
        onInteraction('live2d_interaction', { 
            character, 
            event,
            type: event.type,
            position: event.position 
        })
    }, [character, onInteraction])

    // 处理模型加载完成
    const handleModelLoad = useCallback((modelId: string) => {
        console.log('Live2D模型加载完成:', modelId)
        onInteraction('model_loaded', { character, modelId })
    }, [character, onInteraction])

    // 处理错误
    const handleError = useCallback((error: Error) => {
        console.error('Live2D模型加载错误:', error)
        onInteraction('model_error', { character, error })
    }, [character, onInteraction])

    return (
        <div className="absolute inset-0 pointer-events-auto">
            <Live2DViewer
                config={viewerConfig}
                modelConfig={hiyoriModelConfig}
                onInteraction={handleLive2DInteraction}
                onModelLoad={handleModelLoad}
                onError={handleError}
                className="w-full h-full"
                style={{
                    background: 'transparent'
                }}
            />
        </div>
    )
}
