/**
 * Live2D 模型选择器组件
 * 允许用户在多个 Live2D 模型之间切换
 */

import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { modelManager, ModelInfo } from '@/utils/modelManager'

interface ModelSelectorProps {
  currentModelId: string
  onModelSelect: (modelId: string) => void
  className?: string
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModelId,
  onModelSelect,
  className = ''
}) => {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const availableModels = await modelManager.getAvailableModels()
        setModels(availableModels)
      } catch (err) {
        console.error('Failed to load models:', err)
        setError('无法加载模型列表')
      } finally {
        setIsLoading(false)
      }
    }

    loadModels()
  }, [])

  // 处理模型选择
  const handleModelSelect = useCallback((modelId: string) => {
    if (modelId !== currentModelId) {
      onModelSelect(modelId)
      setIsOpen(false)
    }
  }, [currentModelId, onModelSelect])

  // 获取当前模型信息
  const currentModel = models.find(m => m.id === currentModelId)

  if (isLoading) {
    return (
      <div className={`model-selector loading ${className}`}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span>加载模型列表...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`model-selector error ${className}`}>
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`model-selector ${className}`}>
      {/* 当前模型显示按钮 */}
      <motion.button
        className={`current-model-button ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="model-info">
          <div className="model-avatar">
            {currentModel ? (
              <img 
                src={currentModel.previewImage} 
                alt={currentModel.displayName}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-avatar.png'
                }}
              />
            ) : (
              <div className="avatar-placeholder">?</div>
            )}
          </div>
          <div className="model-text">
            <span className="model-name">
              {currentModel?.displayName || '未知模型'}
            </span>
            <span className="model-subtitle">
              点击切换模型
            </span>
          </div>
        </div>
        <motion.div
          className="expand-icon"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.div>
      </motion.button>

      {/* 模型列表弹出框 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="model-list-container"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="model-list">
              {models.map((model) => (
                <motion.button
                  key={model.id}
                  className={`model-item ${model.id === currentModelId ? 'active' : ''}`}
                  onClick={() => handleModelSelect(model.id)}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="model-item-avatar">
                    <img 
                      src={model.previewImage} 
                      alt={model.displayName}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-avatar.png'
                      }}
                    />
                    {model.id === currentModelId && (
                      <div className="active-badge">✓</div>
                    )}
                  </div>
                  <div className="model-item-info">
                    <div className="model-item-header">
                      <span className="model-item-name">{model.displayName}</span>
                      <span className="model-item-size">{model.size}</span>
                    </div>
                    <p className="model-item-description">{model.description}</p>
                    <div className="model-item-features">
                      {model.features.slice(0, 3).map((feature) => (
                        <span key={feature} className="feature-tag">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 样式 */}
      <style>{`
        .model-selector {
          position: relative;
          z-index: 1000;
        }

        .model-selector.loading,
        .model-selector.error {
          padding: 1rem;
        }

        .loading-spinner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
        }

        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid var(--border-color);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--error-color);
        }

        .current-model-button {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--background-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }

        .current-model-button:hover {
          border-color: var(--primary-color);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .current-model-button.open {
          border-color: var(--primary-color);
        }

        .model-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .model-avatar {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          overflow: hidden;
          background: var(--background-tertiary);
        }

        .model-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-tertiary);
          font-size: 1.25rem;
        }

        .model-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.125rem;
        }

        .model-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 0.875rem;
        }

        .model-subtitle {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .expand-icon {
          color: var(--text-secondary);
          font-size: 0.75rem;
        }

        .model-list-container {
          position: absolute;
          top: calc(100% + 0.5rem);
          left: 0;
          right: 0;
          background: var(--background-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          overflow: hidden;
        }

        .model-list {
          max-height: 400px;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .model-list::-webkit-scrollbar {
          width: 6px;
        }

        .model-list::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 3px;
        }

        .model-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.75rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          text-align: left;
          margin-bottom: 0.5rem;
        }

        .model-item:last-child {
          margin-bottom: 0;
        }

        .model-item:hover {
          background: var(--background-secondary);
          border-color: var(--border-color);
        }

        .model-item.active {
          background: var(--primary-color-alpha);
          border-color: var(--primary-color);
        }

        .model-item-avatar {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 8px;
          overflow: hidden;
          flex-shrink: 0;
          background: var(--background-tertiary);
        }

        .model-item-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .active-badge {
          position: absolute;
          top: 0;
          right: 0;
          width: 18px;
          height: 18px;
          background: var(--success-color);
          color: white;
          border-radius: 0 8px 0 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.625rem;
        }

        .model-item-info {
          flex: 1;
          min-width: 0;
        }

        .model-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .model-item-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 0.875rem;
        }

        .model-item-size {
          font-size: 0.7rem;
          color: var(--text-tertiary);
          font-weight: 500;
        }

        .model-item-description {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0 0 0.5rem 0;
          line-height: 1.4;
        }

        .model-item-features {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .feature-tag {
          font-size: 0.65rem;
          padding: 0.125rem 0.375rem;
          background: var(--background-tertiary);
          color: var(--text-secondary);
          border-radius: 4px;
        }

        .model-item.active .feature-tag {
          background: var(--primary-color);
          color: white;
        }
      `}</style>
    </div>
  )
}

