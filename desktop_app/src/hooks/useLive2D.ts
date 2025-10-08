import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Live2D 模型信息
 */
interface Live2DModel {
    id: string
    name: string
    path: string
    preview?: string
    expressions?: string[]
    motions?: string[]
    poses?: string[]
}

/**
 * Live2D 动作类型
 */
type MotionType = 'idle' | 'talk' | 'greeting' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking'

/**
 * Live2D 表情类型
 */
type ExpressionType = 'default' | 'happy' | 'sad' | 'angry' | 'surprised' | 'wink' | 'sleepy'

/**
 * Live2D 配置
 */
interface Live2DConfig {
    model: Live2DModel
    scale: number
    position: { x: number; y: number }
    autoMotion: boolean
    motionInterval: number
    lipSync: boolean
    eyeBlink: boolean
    eyeTrack: boolean
    breathe: boolean
}

/**
 * Live2D 状态
 */
interface Live2DState {
    isLoaded: boolean
    isPlaying: boolean
    currentMotion?: string
    currentExpression?: string
    error?: string
}

/**
 * Live2D Hook 返回值
 */
interface UseLive2DReturn {
    state: Live2DState
    config: Live2DConfig
    canvasRef: React.RefObject<HTMLCanvasElement>
    loadModel: (model: Live2DModel) => Promise<void>
    playMotion: (motionType: MotionType, priority?: number) => Promise<void>
    setExpression: (expressionType: ExpressionType) => Promise<void>
    startAutoMotion: () => void
    stopAutoMotion: () => void
    setPosition: (x: number, y: number) => void
    setScale: (scale: number) => void
    startLipSync: (audioUrl: string) => Promise<void>
    stopLipSync: () => void
    dispose: () => void
    availableModels: Live2DModel[]
    loadAvailableModels: () => Promise<void>
}

/**
 * 默认Live2D配置
 */
const defaultConfig: Live2DConfig = {
    model: {
        id: 'default',
        name: '默认模型',
        path: '/models/default/default.model3.json',
    },
    scale: 1.0,
    position: { x: 0, y: 0 },
    autoMotion: true,
    motionInterval: 10000,
    lipSync: false,
    eyeBlink: true,
    eyeTrack: true,
    breathe: true,
}

/**
 * Live2D 管理 Hook
 */
export const useLive2D = (initialConfig?: Partial<Live2DConfig>): UseLive2DReturn => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const appRef = useRef<any>(null)
    const modelRef = useRef<any>(null)
    const autoMotionTimerRef = useRef<NodeJS.Timeout | null>(null)
    const lipSyncRef = useRef<any>(null)

    const [state, setState] = useState<Live2DState>({
        isLoaded: false,
        isPlaying: false,
    })

    const [config, setConfig] = useState<Live2DConfig>({
        ...defaultConfig,
        ...initialConfig,
    })

    const [availableModels, setAvailableModels] = useState<Live2DModel[]>([])

    // 初始化Live2D应用
    const initializeLive2D = useCallback(async () => {
        if (!canvasRef.current) return

        try {
            // 动态导入Live2D SDK (这里假设使用Live2D Web SDK)
            const Live2D = await import('live2d')

            const app = new Live2D.Application({
                view: canvasRef.current,
                autoStart: true,
                width: canvasRef.current.width,
                height: canvasRef.current.height,
                backgroundColor: 0x000000,
                backgroundAlpha: 0,
            })

            appRef.current = app

            setState(prev => ({ ...prev, error: undefined }))
        } catch (error) {
            console.error('Failed to initialize Live2D:', error)
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Failed to initialize Live2D'
            }))
        }
    }, [])

    // 加载模型
    const loadModel = useCallback(async (model: Live2DModel) => {
        if (!appRef.current) {
            await initializeLive2D()
        }

        try {
            setState(prev => ({ ...prev, isLoaded: false, error: undefined }))

            // 如果已有模型，先卸载
            if (modelRef.current) {
                appRef.current.stage.removeChild(modelRef.current)
                modelRef.current.destroy()
            }

            // 加载新模型
            const Live2D = await import('live2d')
            const newModel = await Live2D.Live2DModel.from(model.path)

            // 设置模型属性
            newModel.scale.set(config.scale)
            newModel.position.set(config.position.x, config.position.y)

            // 启用各种功能
            if (config.eyeBlink && newModel.internalModel.eyeBlink) {
                newModel.internalModel.eyeBlink.setEnable(true)
            }

            if (config.breathe && newModel.internalModel.breath) {
                newModel.internalModel.breath.setEnable(true)
            }

            // 添加到舞台
            appRef.current.stage.addChild(newModel)
            modelRef.current = newModel

            setConfig(prev => ({ ...prev, model }))
            setState(prev => ({
                ...prev,
                isLoaded: true,
                currentMotion: undefined,
                currentExpression: undefined
            }))

            // 启动自动动作
            if (config.autoMotion) {
                startAutoMotion()
            }
        } catch (error) {
            console.error('Failed to load model:', error)
            setState(prev => ({
                ...prev,
                isLoaded: false,
                error: error instanceof Error ? error.message : 'Failed to load model'
            }))
        }
    }, [config.scale, config.position.x, config.position.y, config.eyeBlink, config.breathe, config.autoMotion, initializeLive2D])

    // 播放动作
    const playMotion = useCallback(async (motionType: MotionType, priority: number = 2) => {
        if (!modelRef.current) return

        try {
            setState(prev => ({ ...prev, isPlaying: true }))

            await modelRef.current.motion(motionType, 0, priority)

            setState(prev => ({
                ...prev,
                isPlaying: false,
                currentMotion: motionType
            }))
        } catch (error) {
            console.error('Failed to play motion:', error)
            setState(prev => ({ ...prev, isPlaying: false }))
        }
    }, [])

    // 设置表情
    const setExpression = useCallback(async (expressionType: ExpressionType) => {
        if (!modelRef.current) return

        try {
            await modelRef.current.expression(expressionType)
            setState(prev => ({ ...prev, currentExpression: expressionType }))
        } catch (error) {
            console.error('Failed to set expression:', error)
        }
    }, [])

    // 开始自动动作
    const startAutoMotion = useCallback(() => {
        if (autoMotionTimerRef.current) {
            clearInterval(autoMotionTimerRef.current)
        }

        const motions: MotionType[] = ['idle', 'happy', 'thinking']

        autoMotionTimerRef.current = setInterval(() => {
            const randomMotion = motions[Math.floor(Math.random() * motions.length)]
            playMotion(randomMotion, 1)
        }, config.motionInterval)
    }, [config.motionInterval, playMotion])

    // 停止自动动作
    const stopAutoMotion = useCallback(() => {
        if (autoMotionTimerRef.current) {
            clearInterval(autoMotionTimerRef.current)
            autoMotionTimerRef.current = null
        }
    }, [])

    // 设置位置
    const setPosition = useCallback((x: number, y: number) => {
        if (modelRef.current) {
            modelRef.current.position.set(x, y)
        }
        setConfig(prev => ({ ...prev, position: { x, y } }))
    }, [])

    // 设置缩放
    const setScale = useCallback((scale: number) => {
        if (modelRef.current) {
            modelRef.current.scale.set(scale)
        }
        setConfig(prev => ({ ...prev, scale }))
    }, [])

    // 开始唇形同步
    const startLipSync = useCallback(async (audioUrl: string) => {
        if (!modelRef.current || !config.lipSync) return

        try {
            // 创建音频上下文
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const response = await fetch(audioUrl)
            const arrayBuffer = await response.arrayBuffer()
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

            // 创建音频源
            const source = audioContext.createBufferSource()
            source.buffer = audioBuffer

            // 创建分析器
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 256

            source.connect(analyser)
            analyser.connect(audioContext.destination)

            // 开始播放
            source.start()

            // 唇形同步逻辑
            const dataArray = new Uint8Array(analyser.frequencyBinCount)

            const updateLipSync = () => {
                analyser.getByteFrequencyData(dataArray)
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length
                const lipValue = Math.min(average / 100, 1.0)

                if (modelRef.current && modelRef.current.internalModel.coreModel) {
                    // 设置嘴部参数
                    modelRef.current.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', lipValue)
                }

                if (lipSyncRef.current) {
                    requestAnimationFrame(updateLipSync)
                }
            }

            lipSyncRef.current = { source, analyser, updateLipSync }
            updateLipSync()

            // 音频结束时停止唇形同步
            source.onended = () => {
                stopLipSync()
            }
        } catch (error) {
            console.error('Failed to start lip sync:', error)
        }
    }, [config.lipSync])

    // 停止唇形同步
    const stopLipSync = useCallback(() => {
        if (lipSyncRef.current) {
            if (lipSyncRef.current.source) {
                lipSyncRef.current.source.stop()
            }
            lipSyncRef.current = null
        }

        // 重置嘴部参数
        if (modelRef.current && modelRef.current.internalModel.coreModel) {
            modelRef.current.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', 0)
        }
    }, [])

    // 加载可用模型列表
    const loadAvailableModels = useCallback(async () => {
        try {
            // 这里应该从服务器或本地文件系统获取可用模型列表
            const models: Live2DModel[] = [
                {
                    id: 'zishu',
                    name: '紫舒老师',
                    path: '/models/zishu/zishu.model3.json',
                    preview: '/models/zishu/preview.png',
                    expressions: ['default', 'happy', 'sad', 'angry', 'surprised'],
                    motions: ['idle', 'talk', 'greeting', 'happy', 'thinking'],
                },
                {
                    id: 'assistant',
                    name: '助手',
                    path: '/models/assistant/assistant.model3.json',
                    preview: '/models/assistant/preview.png',
                    expressions: ['default', 'happy', 'wink'],
                    motions: ['idle', 'talk', 'greeting'],
                },
            ]

            setAvailableModels(models)
        } catch (error) {
            console.error('Failed to load available models:', error)
        }
    }, [])

    // 清理资源
    const dispose = useCallback(() => {
        stopAutoMotion()
        stopLipSync()

        if (modelRef.current) {
            if (appRef.current) {
                appRef.current.stage.removeChild(modelRef.current)
            }
            modelRef.current.destroy()
            modelRef.current = null
        }

        if (appRef.current) {
            appRef.current.destroy()
            appRef.current = null
        }

        setState({
            isLoaded: false,
            isPlaying: false,
        })
    }, [stopAutoMotion, stopLipSync])

    // 初始化
    useEffect(() => {
        initializeLive2D()
        loadAvailableModels()

        return () => {
            dispose()
        }
    }, [initializeLive2D, loadAvailableModels, dispose])

    // 监听配置变化
    useEffect(() => {
        if (config.autoMotion) {
            startAutoMotion()
        } else {
            stopAutoMotion()
        }
    }, [config.autoMotion, startAutoMotion, stopAutoMotion])

    return {
        state,
        config,
        canvasRef,
        loadModel,
        playMotion,
        setExpression,
        startAutoMotion,
        stopAutoMotion,
        setPosition,
        setScale,
        startLipSync,
        stopLipSync,
        dispose,
        availableModels,
        loadAvailableModels,
    }
}
