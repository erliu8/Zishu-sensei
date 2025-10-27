/**
 * Live2D查看器使用示例
 * 
 * 演示如何使用Live2DViewer组件和相关功能
 */

import React, { useState, useCallback } from 'react'
import { Live2DViewer } from './index'
import {
  Live2DViewerConfig,
  Live2DModelConfig,
  Live2DAnimationPriority,
  Live2DAnimationConfig
} from '@/types/live2d'
import './Live2DViewerExample.css'

/**
 * Live2D查看器示例组件
 */
export const Live2DViewerExample: React.FC = () => {
  // ==================== State ====================
  const [selectedModel, setSelectedModel] = useState<string>('hiyori')
  const [debugMode, setDebugMode] = useState(false)

  // ==================== 模型配置 ====================
  
  /**
   * 示例模型配置
   */
  const sampleModels: Record<string, Live2DModelConfig> = {
    hiyori: {
      id: 'hiyori',
      name: 'Hiyori Momose',
      modelPath: '/models/hiyori/hiyori_pro_t03.model3.json',
      previewImage: '/models/hiyori/preview.png',
      description: '桃瀬ひより - 可爱的女孩子',
      author: 'Live2D Inc.',
      version: '1.0.0',
      tags: ['girl', 'cute', 'anime'],
      animations: {
        idle: [
          { name: 'idle_01', file: 'idle_01.motion3.json', priority: Live2DAnimationPriority.IDLE },
          { name: 'idle_02', file: 'idle_02.motion3.json', priority: Live2DAnimationPriority.IDLE }
        ],
        tap: [
          { name: 'tap_body', file: 'tap_body.motion3.json', priority: Live2DAnimationPriority.NORMAL },
          { name: 'tap_head', file: 'tap_head.motion3.json', priority: Live2DAnimationPriority.NORMAL }
        ],
        special: [
          { name: 'greeting', file: 'greeting.motion3.json', priority: Live2DAnimationPriority.URGENT }
        ]
      },
      expressions: [
        { name: 'default', file: 'default.exp3.json' },
        { name: 'happy', file: 'happy.exp3.json' },
        { name: 'sad', file: 'sad.exp3.json' },
        { name: 'surprised', file: 'surprised.exp3.json' }
      ],
      physics: '/models/hiyori/hiyori.physics3.json',
      metadata: {
        modelSize: { width: 1024, height: 1024 },
        canvasSize: { width: 800, height: 600 },
        pixelsPerUnit: 1.0,
        originX: 0.5,
        originY: 0.5
      }
    },
    
    koharu: {
      id: 'koharu',
      name: 'Koharu Natori',
      modelPath: '/models/koharu/koharu.model3.json',
      previewImage: '/models/koharu/preview.png',
      description: '名取こはる - 温柔的姐姐',
      author: 'Live2D Inc.',
      version: '1.0.0',
      tags: ['girl', 'gentle', 'sister'],
      animations: {
        idle: [
          { name: 'idle', file: 'idle.motion3.json', priority: Live2DAnimationPriority.IDLE }
        ],
        tap: [
          { name: 'tap', file: 'tap.motion3.json', priority: Live2DAnimationPriority.NORMAL }
        ]
      },
      expressions: [
        { name: 'default', file: 'default.exp3.json' },
        { name: 'smile', file: 'smile.exp3.json' }
      ],
      metadata: {
        modelSize: { width: 1024, height: 1024 },
        canvasSize: { width: 800, height: 600 },
        pixelsPerUnit: 1.0,
        originX: 0.5,
        originY: 0.5
      }
    }
  }

  // ==================== 查看器配置 ====================
  
  /**
   * Live2D查看器配置
   */
  const viewerConfig: Live2DViewerConfig = {
    canvasSize: { width: 800, height: 600 },
    modelConfig: sampleModels[selectedModel],
    renderConfig: {
      scale: 1.0,
      position: { x: 0, y: 0 },
      opacity: 1.0,
      enablePhysics: true,
      enableBreathing: true,
      enableEyeBlink: true,
      enableEyeTracking: false,
      enableLipSync: false,
      motionFadeDuration: 500,
      expressionFadeDuration: 500
    },
    enableInteraction: true,
    enableAutoIdleAnimation: true,
    idleAnimationInterval: 10000,
    debugMode,
    responsive: true,
    theme: {
      name: 'default',
      backgroundColor: '#1a1a1a',
      borderColor: '#333333',
      controls: {
        backgroundColor: '#2a2a2a',
        textColor: '#ffffff',
        hoverColor: '#4CAF50',
        activeColor: '#FFC107'
      },
      loading: {
        color: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.8)'
      }
    }
  }

  // ==================== 事件处理 ====================

  /**
   * 处理模型切换
   */
  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId)
  }, [])

  /**
   * 处理动画播放
   */
  const handleAnimationPlay = useCallback((config: Live2DAnimationConfig) => {
    console.log('Playing animation:', config.type, config.group)
  }, [])

  /**
   * 处理错误
   */
  const handleError = useCallback((error: Error) => {
    console.error('Live2D error:', error)
  }, [])

  // ==================== 渲染 ====================
  return (
    <div className="live2d-example">
      <div className="live2d-example__header">
        <h2>Live2D查看器示例</h2>
        
        <div className="live2d-example__controls">
          {/* 模型选择 */}
          <div className="live2d-example__control-group">
            <label htmlFor="model-select">选择模型:</label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {Object.entries(sampleModels).map(([id, model]) => (
                <option key={id} value={id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* 调试模式切换 */}
          <div className="live2d-example__control-group">
            <label>
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
              />
              调试模式
            </label>
          </div>
        </div>
      </div>

      <div className="live2d-example__viewer-container">
        <Live2DViewer
          config={viewerConfig}
          onAnimationPlay={handleAnimationPlay}
          onError={handleError}
          className="live2d-example__viewer"
        />
      </div>

      <div className="live2d-example__info">
        <h3>当前模型信息</h3>
        <div className="live2d-example__model-info">
          <p><strong>名称:</strong> {sampleModels[selectedModel].name}</p>
          <p><strong>描述:</strong> {sampleModels[selectedModel].description}</p>
          <p><strong>作者:</strong> {sampleModels[selectedModel].author}</p>
          <p><strong>版本:</strong> {sampleModels[selectedModel].version}</p>
          <p><strong>标签:</strong> {sampleModels[selectedModel].tags?.join(', ')}</p>
          <p><strong>动画数量:</strong> {
            Object.values(sampleModels[selectedModel].animations || {})
              .reduce((total, anims) => total + anims.length, 0)
          }</p>
          <p><strong>表情数量:</strong> {sampleModels[selectedModel].expressions?.length || 0}</p>
        </div>
      </div>

      <div className="live2d-example__usage">
        <h3>使用说明</h3>
        <ul>
          <li>点击模型可以播放点击动画</li>
          <li>使用控制面板可以手动播放动画和切换表情</li>
          <li>启用调试模式可以查看性能信息</li>
          <li>模型会自动播放空闲动画</li>
          <li>支持鼠标交互和触摸操作</li>
        </ul>
      </div>
    </div>
  )
}

export default Live2DViewerExample
