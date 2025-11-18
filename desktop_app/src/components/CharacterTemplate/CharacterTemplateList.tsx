/**
 * 角色模板列表组件
 */

import React from 'react'
import { motion } from 'framer-motion'
import type { CharacterTemplate } from '@/types/characterTemplate'

interface CharacterTemplateListProps {
  templates: CharacterTemplate[]
  isLoading: boolean
  onSelect: (template: CharacterTemplate) => void
  onDelete: (templateId: string) => void
  onCreateNew: () => void
}

export const CharacterTemplateList: React.FC<CharacterTemplateListProps> = ({
  templates,
  isLoading,
  onSelect,
  onDelete,
  onCreateNew,
}) => {
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
        }}
      >
        <div
          style={{
            color: 'hsl(var(--color-muted-foreground))',
            fontSize: '14px',
          }}
        >
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* 创建新模板按钮 */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onCreateNew}
        style={{
          padding: '16px',
          border: '2px dashed hsl(var(--color-border))',
          borderRadius: '8px',
          background: 'transparent',
          color: 'hsl(var(--color-muted-foreground))',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '20px' }}>+</span>
        创建新的角色模板
      </motion.button>

      {/* 模板列表 */}
      {templates.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: 'hsl(var(--color-muted-foreground))',
          }}
        >
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>还没有角色模板</p>
          <p style={{ fontSize: '14px' }}>点击上方按钮创建你的第一个角色模板</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}
        >
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => onSelect(template)}
              onDelete={() => onDelete(template.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 模板卡片组件
 */
const TemplateCard: React.FC<{
  template: CharacterTemplate
  onSelect: () => void
  onDelete: () => void
}> = ({ template, onSelect, onDelete }) => {
  const [showActions, setShowActions] = React.useState(false)

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      style={{
        position: 'relative',
        padding: '16px',
        border: '1px solid hsl(var(--color-border))',
        borderRadius: '8px',
        backgroundColor: 'hsl(var(--color-background))',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={onSelect}
    >
      {/* 模板信息 */}
      <div style={{ marginBottom: '12px' }}>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'hsl(var(--color-foreground))',
            marginBottom: '4px',
          }}
        >
          {template.name}
        </h3>
        {template.description && (
          <p
            style={{
              fontSize: '13px',
              color: 'hsl(var(--color-muted-foreground))',
              lineHeight: '1.5',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {template.description}
          </p>
        )}
      </div>

      {/* 配置信息 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '12px',
          color: 'hsl(var(--color-muted-foreground))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🤖</span>
          <span>
            {template.llmConfig.type === 'local'
              ? `本地模型: ${template.llmConfig.modelName}`
              : `API: ${template.llmConfig.provider}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>💬</span>
          <span>{template.prompt.name}</span>
        </div>
        {template.metadata?.isAdapterRegistered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✅</span>
            <span>适配器已注册</span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {showActions && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '6px',
            borderRadius: '4px',
            border: 'none',
            background: 'hsl(var(--color-destructive))',
            color: 'white',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.8'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          删除
        </motion.button>
      )}
    </motion.div>
  )
}
