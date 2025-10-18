/**
 * Live2D 模型演示页面
 * 用于测试和展示 Live2D 模型切换功能
 */

import React, { useState, useCallback } from 'react'
import { Character } from '@/components/Character'
import { motion } from 'framer-motion'

export const Live2DDemo: React.FC = () => {
  const [showSelector, setShowSelector] = useState(true)
  const [interactionLog, setInteractionLog] = useState<any[]>([])

  // 模拟角色数据
  const character = {
    id: 'zishu-sensei',
    name: '字書老师',
    avatar: '/placeholder-avatar.png',
    description: '一个可爱的 AI 助手'
  }

  // 处理交互事件
  const handleInteraction = useCallback((type: string, data: any) => {
    console.log('Interaction:', type, data)
    setInteractionLog(prev => [
      { type, data, timestamp: new Date().toLocaleTimeString() },
      ...prev.slice(0, 9) // 保留最近10条
    ])
  }, [])

  return (
    <div className="live2d-demo-page">
      {/* 页面头部 */}
      <div className="demo-header">
        <h1>Live2D 模型演示</h1>
        <p>测试多个 Live2D 模型的切换和交互</p>
        <div className="demo-controls">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showSelector}
              onChange={(e) => setShowSelector(e.target.checked)}
            />
            <span>显示模型选择器</span>
          </label>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="demo-content">
        {/* 左侧：Live2D 视图 */}
        <div className="live2d-container">
          <Character
            character={character}
            onInteraction={handleInteraction}
            showModelSelector={showSelector}
          />
        </div>

        {/* 右侧：交互日志 */}
        <div className="interaction-log">
          <h3>交互日志</h3>
          <div className="log-entries">
            {interactionLog.length === 0 ? (
              <div className="log-empty">暂无交互事件</div>
            ) : (
              interactionLog.map((entry, index) => (
                <motion.div
                  key={index}
                  className="log-entry"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="log-time">{entry.timestamp}</span>
                  <span className="log-type">{entry.type}</span>
                  <pre className="log-data">
                    {JSON.stringify(entry.data, null, 2)}
                  </pre>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 样式 */}
      <style>{`
        .live2d-demo-page {
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          overflow: hidden;
        }

        .demo-header {
          padding: 2rem;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .demo-header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .demo-header p {
          margin: 0 0 1rem 0;
          color: var(--text-secondary);
          font-size: 1rem;
        }

        .demo-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          user-select: none;
        }

        .toggle-label input[type="checkbox"] {
          cursor: pointer;
        }

        .toggle-label span {
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .demo-content {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 1rem;
          padding: 1rem;
          overflow: hidden;
        }

        .live2d-container {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          position: relative;
        }

        .interaction-log {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .interaction-log h3 {
          margin: 0 0 1rem 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .log-entries {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .log-entries::-webkit-scrollbar {
          width: 6px;
        }

        .log-entries::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 3px;
        }

        .log-empty {
          text-align: center;
          color: var(--text-tertiary);
          padding: 2rem;
          font-size: 0.875rem;
        }

        .log-entry {
          background: var(--background-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 0.75rem;
          font-size: 0.75rem;
        }

        .log-time {
          display: inline-block;
          color: var(--text-tertiary);
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .log-type {
          display: inline-block;
          background: var(--primary-color);
          color: white;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-weight: 600;
          margin-left: 0.5rem;
        }

        .log-data {
          margin: 0.5rem 0 0 0;
          padding: 0.5rem;
          background: var(--background-tertiary);
          border-radius: 4px;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 0.7rem;
          color: var(--text-secondary);
          max-height: 200px;
          overflow-y: auto;
        }

        @media (max-width: 1024px) {
          .demo-content {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr auto;
          }

          .interaction-log {
            max-height: 300px;
          }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default Live2DDemo
