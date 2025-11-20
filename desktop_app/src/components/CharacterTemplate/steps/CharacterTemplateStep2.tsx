/**
 * 角色模板创建 - 第二步：LLM配置
 */

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/tauri'
import type { LLMConfig, LocalLLMConfig, APILLMConfig } from '@/types/characterTemplate'
import { API_PROVIDERS } from '@/types/characterTemplate'
import { CommandResponse } from '@/services/types'

interface LocalLLMModel {
  id: string
  name: string
  model_path: string
  model_type: string
  size_bytes: number
}

interface CharacterTemplateStep2Props {
  onComplete: (llmConfig: LLMConfig) => void
  onBack: () => void
  isCreating: boolean
  initialLlmConfig?: LLMConfig | null
}

export const CharacterTemplateStep2: React.FC<CharacterTemplateStep2Props> = ({
  onComplete,
  onBack,
  isCreating,
  initialLlmConfig,
}) => {
  const [configType, setConfigType] = useState<'local' | 'api'>(
    initialLlmConfig?.type || 'local'
  )
  const [localModels, setLocalModels] = useState<LocalLLMModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>(
    initialLlmConfig?.type === 'local' ? (initialLlmConfig as LocalLLMConfig).modelId : ''
  )
  const [apiProvider, setApiProvider] = useState<string>(
    initialLlmConfig?.type === 'api' ? (initialLlmConfig as APILLMConfig).provider : 'openai'
  )
  const [apiEndpoint, setApiEndpoint] = useState<string>(
    initialLlmConfig?.type === 'api' ? (initialLlmConfig as APILLMConfig).apiEndpoint : ''
  )
  const [apiKey, setApiKey] = useState<string>(
    initialLlmConfig?.type === 'api' ? (initialLlmConfig as APILLMConfig).apiKey || '' : ''
  )
  const [apiModelName, setApiModelName] = useState<string>(
    initialLlmConfig?.type === 'api' ? (initialLlmConfig as APILLMConfig).modelName : ''
  )
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  // 加载本地LLM模型列表
  useEffect(() => {
    if (configType === 'local') {
      loadLocalModels()
    }
  }, [configType])

  const loadLocalModels = async () => {
    try {
      setIsLoadingModels(true)
      const response = await invoke<CommandResponse<LocalLLMModel[]>>('get_local_llm_models')
      if (response.success && response.data) {
        setLocalModels(response.data)
        if (response.data.length > 0 && !selectedModelId) {
          setSelectedModelId(response.data[0].id)
        }
      }
    } catch (error) {
      console.error('加载本地模型列表失败:', error)
    } finally {
      setIsLoadingModels(false)
    }
  }

  // 验证表单
  const isValid = () => {
    if (configType === 'local') {
      return !!selectedModelId
    } else {
      return !!apiProvider && !!apiEndpoint && !!apiModelName
    }
  }

  // 处理完成
  const handleComplete = () => {
    if (!isValid()) return

    let llmConfig: LLMConfig

    if (configType === 'local') {
      const selectedModel = localModels.find(m => m.id === selectedModelId)
      if (!selectedModel) return

      llmConfig = {
        type: 'local',
        modelId: selectedModel.id,
        modelName: selectedModel.name,
        modelPath: selectedModel.model_path,
      } as LocalLLMConfig
    } else {
      llmConfig = {
        type: 'api',
        provider: apiProvider,
        apiEndpoint: apiEndpoint.trim(),
        apiKey: apiKey.trim() || undefined,
        modelName: apiModelName.trim(),
      } as APILLMConfig
    }

    onComplete(llmConfig)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* LLM类型选择 */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            color: 'hsl(var(--color-foreground))',
            marginBottom: '12px',
          }}
        >
          LLM配置类型 <span style={{ color: 'hsl(var(--color-destructive))' }}>*</span>
        </label>
        <div
          style={{
            display: 'flex',
            gap: '12px',
          }}
        >
          <button
            onClick={() => setConfigType('local')}
            style={{
              flex: 1,
              padding: '16px',
              fontSize: '14px',
              border: `2px solid ${
                configType === 'local'
                  ? 'hsl(var(--color-primary))'
                  : 'hsl(var(--color-border))'
              }`,
              borderRadius: '8px',
              backgroundColor:
                configType === 'local'
                  ? 'hsl(var(--color-primary) / 0.1)'
                  : 'transparent',
              color: 'hsl(var(--color-foreground))',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '24px' }}>🖥️</span>
            <span style={{ fontWeight: 600 }}>本地LLM</span>
            <span style={{ fontSize: '12px', color: 'hsl(var(--color-muted-foreground))' }}>
              使用本地模型（智能硬适配器）
            </span>
          </button>
          <button
            onClick={() => setConfigType('api')}
            style={{
              flex: 1,
              padding: '16px',
              fontSize: '14px',
              border: `2px solid ${
                configType === 'api'
                  ? 'hsl(var(--color-primary))'
                  : 'hsl(var(--color-border))'
              }`,
              borderRadius: '8px',
              backgroundColor:
                configType === 'api'
                  ? 'hsl(var(--color-primary) / 0.1)'
                  : 'transparent',
              color: 'hsl(var(--color-foreground))',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '24px' }}>☁️</span>
            <span style={{ fontWeight: 600 }}>API调用</span>
            <span style={{ fontSize: '12px', color: 'hsl(var(--color-muted-foreground))' }}>
              调用第三方API（软适配器）
            </span>
          </button>
        </div>
      </div>

      {/* 本地LLM配置 */}
      {configType === 'local' && (
        <div
          style={{
            padding: '20px',
            border: '1px solid hsl(var(--color-border))',
            borderRadius: '8px',
            backgroundColor: 'hsl(var(--color-muted) / 0.3)',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'hsl(var(--color-foreground))',
              marginBottom: '12px',
            }}
          >
            选择本地模型
          </label>
          
          {isLoadingModels ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--color-muted-foreground))' }}>
              加载中...
            </div>
          ) : localModels.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: 'hsl(var(--color-muted-foreground))',
              }}
            >
              <p style={{ marginBottom: '12px' }}>还没有本地模型</p>
              <p style={{ fontSize: '13px' }}>
                请先在适配器管理中上传或注册本地LLM模型
              </p>
            </div>
          ) : (
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid hsl(var(--color-border))',
                borderRadius: '6px',
                backgroundColor: 'hsl(var(--color-background))',
                color: 'hsl(var(--color-foreground))',
                cursor: 'pointer',
              }}
            >
              {localModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({(model.size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB)
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* API配置 */}
      {configType === 'api' && (
        <div
          style={{
            padding: '20px',
            border: '1px solid hsl(var(--color-border))',
            borderRadius: '8px',
            backgroundColor: 'hsl(var(--color-muted) / 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* API提供商 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--color-foreground))',
                marginBottom: '8px',
              }}
            >
              API提供商
            </label>
            <select
              value={apiProvider}
              onChange={(e) => {
                setApiProvider(e.target.value)
                // 根据提供商设置默认端点
                switch (e.target.value) {
                  case 'openai':
                    setApiEndpoint('https://api.openai.com/v1')
                    setApiModelName('gpt-3.5-turbo')
                    break
                  case 'anthropic':
                    setApiEndpoint('https://api.anthropic.com/v1')
                    setApiModelName('claude-3-sonnet-20240229')
                    break
                  case 'google':
                    setApiEndpoint('https://generativelanguage.googleapis.com/v1')
                    setApiModelName('gemini-pro')
                    break
                  default:
                    setApiEndpoint('')
                    setApiModelName('')
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid hsl(var(--color-border))',
                borderRadius: '6px',
                backgroundColor: 'hsl(var(--color-background))',
                color: 'hsl(var(--color-foreground))',
                cursor: 'pointer',
              }}
            >
              {API_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>

          {/* API端点 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--color-foreground))',
                marginBottom: '8px',
              }}
            >
              API端点
            </label>
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid hsl(var(--color-border))',
                borderRadius: '6px',
                backgroundColor: 'hsl(var(--color-background))',
                color: 'hsl(var(--color-foreground))',
              }}
            />
          </div>

          {/* API密钥 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--color-foreground))',
                marginBottom: '8px',
              }}
            >
              API密钥（可选）
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid hsl(var(--color-border))',
                borderRadius: '6px',
                backgroundColor: 'hsl(var(--color-background))',
                color: 'hsl(var(--color-foreground))',
              }}
            />
            <p
              style={{
                fontSize: '12px',
                color: 'hsl(var(--color-muted-foreground))',
                marginTop: '6px',
              }}
            >
              API密钥将被安全加密存储
            </p>
          </div>

          {/* 模型名称 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--color-foreground))',
                marginBottom: '8px',
              }}
            >
              模型名称
            </label>
            <input
              type="text"
              value={apiModelName}
              onChange={(e) => setApiModelName(e.target.value)}
              placeholder="例如：gpt-3.5-turbo"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid hsl(var(--color-border))',
                borderRadius: '6px',
                backgroundColor: 'hsl(var(--color-background))',
                color: 'hsl(var(--color-foreground))',
              }}
            />
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '8px',
        }}
      >
        <button
          onClick={onBack}
          disabled={isCreating}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            border: '1px solid hsl(var(--color-border))',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: 'hsl(var(--color-foreground))',
            cursor: isCreating ? 'not-allowed' : 'pointer',
            opacity: isCreating ? 0.5 : 1,
          }}
        >
          上一步
        </button>
        <button
          onClick={handleComplete}
          disabled={!isValid() || isCreating}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: isValid() && !isCreating
              ? 'hsl(var(--color-primary))'
              : 'hsl(var(--color-muted))',
            color: isValid() && !isCreating
              ? 'hsl(var(--color-primary-foreground))'
              : 'hsl(var(--color-muted-foreground))',
            cursor: isValid() && !isCreating ? 'pointer' : 'not-allowed',
          }}
        >
          {isCreating ? (initialLlmConfig ? '更新中...' : '创建中...') : (initialLlmConfig ? '完成更新' : '完成创建')}
        </button>
      </div>
    </motion.div>
  )
}
