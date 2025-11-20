/**
 * 角色模板管理器组件
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CharacterTemplateService } from '@/services/characterTemplate'
import { CharacterTemplateList } from './CharacterTemplateList'
import { CharacterTemplateCreator } from './CharacterTemplateCreator'
import type { CharacterTemplate } from '@/types/characterTemplate'

interface CharacterTemplateManagerProps {
  /** 关闭回调 */
  onClose: () => void
  /** 选择模板回调 */
  onSelect?: (template: CharacterTemplate) => void
}

/**
 * 角色模板管理器主组件
 */
export const CharacterTemplateManager: React.FC<CharacterTemplateManagerProps> = ({
  onClose,
  onSelect,
}) => {
  const [templates, setTemplates] = useState<CharacterTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CharacterTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 加载模板列表
  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await CharacterTemplateService.getTemplates()
      setTemplates(data)
    } catch (err) {
      console.error('加载模板失败:', err)
      setError('加载模板失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  // 处理模板选择
  const handleSelectTemplate = async (template: CharacterTemplate) => {
    try {
      await CharacterTemplateService.switchToTemplate(template.id)
      onSelect?.(template)
      onClose()
    } catch (err) {
      console.error('切换模板失败:', err)
      setError('切换模板失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
  }

  // 处理编辑模板
  const handleEditTemplate = (template: CharacterTemplate) => {
    setEditingTemplate(template)
    setIsCreating(true)
  }

  // 处理模板删除
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('确定要删除这个角色模板吗？')) {
      return
    }

    try {
      await CharacterTemplateService.deleteTemplate(templateId)
      await loadTemplates()
    } catch (err) {
      console.error('删除模板失败:', err)
      setError('删除模板失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
  }

  // 处理创建/编辑完成
  const handleCreateComplete = () => {
    setIsCreating(false)
    setEditingTemplate(null)
    loadTemplates()
  }

  // 处理取消
  const handleCancel = () => {
    setIsCreating(false)
    setEditingTemplate(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'hsl(var(--color-background))',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid hsl(var(--color-border))',
          }}
        >
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'hsl(var(--color-foreground))',
            }}
          >
            角色模板管理
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'hsl(var(--color-muted-foreground))',
              cursor: 'pointer',
              fontSize: '20px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(var(--color-accent))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            ✕
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div
            style={{
              margin: '16px 24px',
              padding: '12px 16px',
              backgroundColor: 'hsl(var(--color-destructive) / 0.1)',
              color: 'hsl(var(--color-destructive))',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {/* 内容区域 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
          }}
        >
          <AnimatePresence mode="wait">
            {isCreating ? (
              <CharacterTemplateCreator
                key={editingTemplate?.id || 'new'}
                initialTemplate={editingTemplate || undefined}
                onComplete={handleCreateComplete}
                onCancel={handleCancel}
              />
            ) : (
              <CharacterTemplateList
                templates={templates}
                isLoading={isLoading}
                onSelect={handleSelectTemplate}
                onEdit={handleEditTemplate}
                onDelete={handleDeleteTemplate}
                onCreateNew={() => setIsCreating(true)}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
