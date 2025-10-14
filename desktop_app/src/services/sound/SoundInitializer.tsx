/**
 * 音效系统初始化器
 * @module services/sound/SoundInitializer
 * @description React 组件形式的音效系统初始化器，用于在应用启动时初始化音效管理器
 */

import { useEffect, useState } from 'react'
import { createSoundManager } from './SoundManager'
import { SOUND_CONFIGS, SOUND_GROUPS } from '@/constants/sounds'
import type { SoundManagerConfig } from '@/types/sound'

/**
 * 初始化器配置
 */
export interface SoundInitializerProps {
  /** 音效管理器配置 */
  config?: Partial<SoundManagerConfig>
  /** 子组件 */
  children?: React.ReactNode
  /** 加载完成回调 */
  onReady?: () => void
  /** 加载进度回调 */
  onProgress?: (loaded: number, total: number) => void
  /** 显示加载界面 */
  renderLoading?: (loaded: number, total: number) => React.ReactNode
}

/**
 * 音效系统初始化器组件
 */
export function SoundInitializer({
  config,
  children,
  onReady,
  onProgress,
  renderLoading,
}: SoundInitializerProps) {
  const [isReady, setIsReady] = useState(false)
  const [loaded, setLoaded] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const initSoundSystem = async () => {
      try {
        console.log('🔊 开始初始化音效系统...')

        // 创建音效管理器
        const soundManager = createSoundManager(config)

        // 注册分组
        Object.values(SOUND_GROUPS).forEach((group) => {
          soundManager.registerGroup(group)
        })

        // 监听加载进度
        soundManager.on('load:progress', (progress) => {
          setLoaded(progress.loaded)
          setTotal(progress.total)
          onProgress?.(progress.loaded, progress.total)
        })

        // 初始化音效配置
        await soundManager.initialize(SOUND_CONFIGS)

        console.log('✅ 音效系统初始化完成')
        setIsReady(true)
        onReady?.()
      } catch (error) {
        console.error('❌ 音效系统初始化失败:', error)
        // 即使失败也继续渲染应用
        setIsReady(true)
      }
    }

    initSoundSystem()
  }, [config, onReady, onProgress])

  // 如果还未准备好且有自定义加载界面，显示加载界面
  if (!isReady && renderLoading) {
    return <>{renderLoading(loaded, total)}</>
  }

  // 返回子组件
  return <>{children}</>
}

/**
 * 默认加载界面组件
 */
export function DefaultSoundLoadingScreen({
  loaded,
  total,
}: {
  loaded: number
  total: number
}) {
  const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        fontFamily: 'sans-serif',
      }}
    >
      <h2 style={{ marginBottom: '20px' }}>🔊 加载音效资源</h2>
      <div
        style={{
          width: '300px',
          height: '20px',
          backgroundColor: '#333',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: '#4CAF50',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <p style={{ marginTop: '10px' }}>
        {loaded} / {total} ({percentage}%)
      </p>
    </div>
  )
}

