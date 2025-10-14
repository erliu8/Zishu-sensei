/**
 * Live2D查看器使用示例
 * 
 * 演示如何使用Live2DViewer组件和相关功能
 */

import React, { useState, useCallback } from 'react'
import {
  Live2DViewer,
  Live2DViewerConfig,
  Live2DModelConfig,
  Live2DAnimationType,
  Live2DAnimationPriority,
  Live2DLoadState
} from './index'
import './Live2DViewerExample.css'

/**
 * Live2D查看器示例组件
 */
export const Live2DViewerExample: React.FC = () => {
  // ==================== State ====================
  const [selectedModel, setSelectedModel] = useState<string>('hiyori')
  const [showControls, setShowControls] = useState(true)
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
          { name: 'greeting', file: 'greeting.motion3.json', priority: Live2DAnimationPriority.FORCE }
        ]
      },
      expressions: [
        { name: 'default', file: 'default.exp3.json' },
        { name: 'happy', file: 'happy.exp3.json' },
        { name: 'sad', file: 'sad.exp3.json' },
        { name: 'surprised', file: 'surprised.exp3.json' }
      ],
      physics: '/models/hiyori/hiyori.physics3.json',
      pose: '/models/hiyori/hiyori.pose3.json',
      userdata: '/models/hiyori/hiyori.userdata3.json',
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
    modelConfig: sampleModels[selectedModel],
    renderConfig: {
      scale: 1.0,
      position: { x: 0, y: 0 },
      alpha: 1.0,
      backgroundColor: 'transparent',
      enableCulling: true,
      enableDepthTest: true,
      enableBlend: true,
      clearColor: [0, 0, 0, 0]
    },
    enableInteraction: true,
    enableAutoIdleAnimation: true,
    idleAnimationInterval: 10000,
    debugMode,
    theme: {
      primary: '#4CAF50',
      secondary: '#FFC107',
      background: '#1a1a1a',
      text: '#ffffff',
      loading: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#ffffff'
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
   * 处理模型点击
   */
  const handleModelClick = useCallback((event: React.MouseEvent) => {
    console.log('Model clicked:', event)
  }, [])

  /**
   * 处理动画播放
   */
  const handleAnimationPlay = useCallback((animationType: Live2DAnimationType, animationName: string) => {
    console.log('Playing animation:', animationType, animationName)
  }, [])

  /**
   * 处理表情切换
   */
  const handleExpressionChange = useCallback((expressionIndex: number) => {
    console.log('Changing expression:', expressionIndex)
  }, [])

  /**
   * 处理加载状态变化
   */
  const handleLoadStateChange = useCallback((loadState: Live2DLoadState) => {
    console.log('Load state changed:', loadState)
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

          {/* 控制面板切换 */}
          <div className="live2d-example__control-group">
            <label>
              <input
                type="checkbox"
                checked={showControls}
                onChange={(e) => setShowControls(e.target.checked)}
              />
              显示控制面板
            </label>
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
          showControls={showControls}
          controlsPosition="bottom"
          width={800}
          height={600}
          onClick={handleModelClick}
          onAnimationPlay={handleAnimationPlay}
          onExpressionChange={handleExpressionChange}
          onLoadStateChange={handleLoadStateChange}
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
