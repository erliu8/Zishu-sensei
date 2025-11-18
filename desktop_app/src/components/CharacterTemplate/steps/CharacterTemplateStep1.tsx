/**
 * 角色模板创建 - 第一步：基本信息设置
 */

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/tauri'
import { CharacterTemplateService } from '@/services/characterTemplate'
import type {
  CreateCharacterTemplateStep1,
  CharacterPrompt,
} from '@/types/characterTemplate'

interface CharacterInfo {
  id: string
  name: string
  avatar?: string
  description?: string
}

interface CharacterTemplateStep1Props {
  onNext: (data: CreateCharacterTemplateStep1) => void
  onCancel: () => void
  initialData: CreateCharacterTemplateStep1 | null
}

export const CharacterTemplateStep1: React.FC<CharacterTemplateStep1Props> = ({
  onNext,
  onCancel,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [live2dModelId, setLive2dModelId] = useState(initialData?.live2dModelId || 'hiyori')
  const [promptMode, setPromptMode] = useState<'select' | 'create'>('select')
  const [selectedPromptId, setSelectedPromptId] = useState<string>('')
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    systemPrompt: '',
    description: '',
  })
  const [availablePrompts, setAvailablePrompts] = useState<CharacterPrompt[]>([])
  const [availableModels, setAvailableModels] = useState<CharacterInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(true)

  // 加载可用的Prompt列表
  useEffect(() => {
    CharacterTemplateService.getPrompts().then(setAvailablePrompts)
  }, [])

  // 加载Live2D模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoadingModels(true)
        const response = await invoke<{ success: boolean; data?: CharacterInfo[] }>('get_characters')
        if (response.success && response.data) {
          setAvailableModels(response.data)
          // 如果没有选择模型，使用第一个
          if (!initialData?.live2dModelId && response.data.length > 0) {
            setLive2dModelId(response.data[0].id)
          }
        }
      } catch (error) {
        console.error('加载Live2D模型失败:', error)
      } finally {
        setLoadingModels(false)
      }
    }
    loadModels()
  }, [])

  // 验证表单
  const isValid = () => {
    if (!name.trim()) return false
    if (promptMode === 'select' && !selectedPromptId) return false
    if (promptMode === 'create' && (!newPrompt.name.trim() || !newPrompt.systemPrompt.trim())) {
      return false
    }
    return true
  }

  // 处理下一步
  const handleNext = () => {
    if (!isValid()) return

    const data: CreateCharacterTemplateStep1 = {
      name: name.trim(),
      description: description.trim() || undefined,
      live2dModelId,
      prompt: promptMode === 'select' ? selectedPromptId : newPrompt,
    }

    onNext(data)
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
      {/* 角色名称 */}
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
          角色名称 <span style={{ color: 'hsl(var(--color-destructive))' }}>*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="请输入角色名称"
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

      {/* 角色描述 */}
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
          角色描述
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述这个角色的特点和用途"
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid hsl(var(--color-border))',
            borderRadius: '6px',
            backgroundColor: 'hsl(var(--color-background))',
            color: 'hsl(var(--color-foreground))',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Live2D模型选择 */}
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
          Live2D模型
        </label>
        <select
          value={live2dModelId}
          onChange={(e) => setLive2dModelId(e.target.value)}
          disabled={loadingModels}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid hsl(var(--color-border))',
            borderRadius: '6px',
            backgroundColor: 'hsl(var(--color-background))',
            color: 'hsl(var(--color-foreground))',
            cursor: loadingModels ? 'wait' : 'pointer',
            opacity: loadingModels ? 0.6 : 1,
          }}
        >
          {loadingModels ? (
            <option value="">加载中...</option>
          ) : availableModels.length > 0 ? (
            availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))
          ) : (
            <option value="">暂无可用模型</option>
          )}
        </select>
        <p
          style={{
            fontSize: '12px',
            color: 'hsl(var(--color-muted-foreground))',
            marginTop: '6px',
          }}
        >
          默认使用当前模型，可以选择其他可用模型
        </p>
      </div>

      {/* Prompt配置 */}
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
          Prompt配置 <span style={{ color: 'hsl(var(--color-destructive))' }}>*</span>
        </label>

        {/* Prompt模式选择 */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <button
            onClick={() => setPromptMode('select')}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '14px',
              border: `2px solid ${
                promptMode === 'select'
                  ? 'hsl(var(--color-primary))'
                  : 'hsl(var(--color-border))'
              }`,
              borderRadius: '6px',
              backgroundColor:
                promptMode === 'select'
                  ? 'hsl(var(--color-primary) / 0.1)'
                  : 'transparent',
              color: 'hsl(var(--color-foreground))',
              cursor: 'pointer',
            }}
          >
            选择已有Prompt
          </button>
          <button
            onClick={() => setPromptMode('create')}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '14px',
              border: `2px solid ${
                promptMode === 'create'
                  ? 'hsl(var(--color-primary))'
                  : 'hsl(var(--color-border))'
              }`,
              borderRadius: '6px',
              backgroundColor:
                promptMode === 'create'
                  ? 'hsl(var(--color-primary) / 0.1)'
                  : 'transparent',
              color: 'hsl(var(--color-foreground))',
              cursor: 'pointer',
            }}
          >
            创建新Prompt
          </button>
        </div>

        {/* 选择已有Prompt */}
        {promptMode === 'select' && (
          <select
            value={selectedPromptId}
            onChange={(e) => setSelectedPromptId(e.target.value)}
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
            <option value="">请选择Prompt</option>
            {availablePrompts.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.name}
                {prompt.description ? ` - ${prompt.description}` : ''}
              </option>
            ))}
          </select>
        )}

        {/* 创建新Prompt */}
        {promptMode === 'create' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '16px',
              border: '1px solid hsl(var(--color-border))',
              borderRadius: '6px',
              backgroundColor: 'hsl(var(--color-muted) / 0.3)',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'hsl(var(--color-foreground))',
                  marginBottom: '6px',
                }}
              >
                Prompt名称
              </label>
              <input
                type="text"
                value={newPrompt.name}
                onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                placeholder="例如：通用助手"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  border: '1px solid hsl(var(--color-border))',
                  borderRadius: '4px',
                  backgroundColor: 'hsl(var(--color-background))',
                  color: 'hsl(var(--color-foreground))',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'hsl(var(--color-foreground))',
                  marginBottom: '6px',
                }}
              >
                系统提示词
              </label>
              <textarea
                value={newPrompt.systemPrompt}
                onChange={(e) => setNewPrompt({ ...newPrompt, systemPrompt: e.target.value })}
                placeholder="定义角色的行为和特性..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  border: '1px solid hsl(var(--color-border))',
                  borderRadius: '4px',
                  backgroundColor: 'hsl(var(--color-background))',
                  color: 'hsl(var(--color-foreground))',
                  resize: 'vertical',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'hsl(var(--color-foreground))',
                  marginBottom: '6px',
                }}
              >
                描述（可选）
              </label>
              <input
                type="text"
                value={newPrompt.description}
                onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                placeholder="简短描述这个Prompt的用途"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  border: '1px solid hsl(var(--color-border))',
                  borderRadius: '4px',
                  backgroundColor: 'hsl(var(--color-background))',
                  color: 'hsl(var(--color-foreground))',
                }}
              />
            </div>
          </div>
        )}
      </div>

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
          onClick={onCancel}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            border: '1px solid hsl(var(--color-border))',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: 'hsl(var(--color-foreground))',
            cursor: 'pointer',
          }}
        >
          取消
        </button>
        <button
          onClick={handleNext}
          disabled={!isValid()}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: isValid()
              ? 'hsl(var(--color-primary))'
              : 'hsl(var(--color-muted))',
            color: isValid()
              ? 'hsl(var(--color-primary-foreground))'
              : 'hsl(var(--color-muted-foreground))',
            cursor: isValid() ? 'pointer' : 'not-allowed',
          }}
        >
          下一步
        </button>
      </div>
    </motion.div>
  )
}
