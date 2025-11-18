import React, { useState, useEffect, useRef } from 'react'
import { CharacterTemplate } from '@/types/characterTemplate'
import { CharacterTemplateService } from '@/services/characterTemplate'

interface CharacterSelectorProps {
  selectedCharacterId?: string
  onSelectCharacter: (characterId: string) => void
}

/**
 * 角色选择器组件
 * 类似Claude的模型选择器UI风格
 */
export const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  selectedCharacterId,
  onSelectCharacter,
}) => {
  const [templates, setTemplates] = useState<CharacterTemplate[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 加载角色模板列表
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true)
        const data = await CharacterTemplateService.getTemplates()
        setTemplates(data)
      } catch (error) {
        console.error('加载角色模板失败:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // 获取当前选中的角色
  const selectedCharacter = templates.find(t => t.id === selectedCharacterId)

  const handleSelectCharacter = (characterId: string) => {
    onSelectCharacter(characterId)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      {/* 选择器按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading || templates.length === 0}
        style={{
          width: '100%',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'hsl(var(--color-muted))',
          color: 'hsl(var(--color-foreground))',
          border: '1px solid hsl(var(--color-border))',
          borderRadius: '6px',
          cursor: loading || templates.length === 0 ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          opacity: loading || templates.length === 0 ? 0.6 : 1,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!loading && templates.length > 0) {
            e.currentTarget.style.backgroundColor = 'hsl(var(--color-accent))'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎭</span>
          <span>
            {loading
              ? '加载中...'
              : templates.length === 0
              ? '暂无角色'
              : selectedCharacter?.name || '选择角色'}
          </span>
        </div>
        <span style={{ fontSize: '12px', opacity: 0.7 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* 下拉菜单 */}
      {isOpen && templates.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: '4px',
            backgroundColor: 'hsl(var(--color-popover))',
            border: '1px solid hsl(var(--color-border))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelectCharacter(template.id)}
              style={{
                width: '100%',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '4px',
                backgroundColor:
                  template.id === selectedCharacterId
                    ? 'hsl(var(--color-accent))'
                    : 'transparent',
                border: 'none',
                borderBottom: '1px solid hsl(var(--color-border))',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (template.id !== selectedCharacterId) {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted))'
                }
              }}
              onMouseLeave={(e) => {
                if (template.id !== selectedCharacterId) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'hsl(var(--color-foreground))' }}>
                  {template.name}
                </span>
                {template.id === selectedCharacterId && (
                  <span style={{ fontSize: '12px', marginLeft: 'auto' }}>✓</span>
                )}
              </div>
              {template.description && (
                <span style={{ fontSize: '12px', color: 'hsl(var(--color-muted-foreground))', lineHeight: '1.4' }}>
                  {template.description}
                </span>
              )}
              <div style={{ fontSize: '11px', color: 'hsl(var(--color-muted-foreground))', display: 'flex', gap: '8px' }}>
                <span>💬 {template.prompt.name}</span>
                <span>•</span>
                <span>
                  {template.llmConfig.type === 'api'
                    ? `API: ${template.llmConfig.modelName}`
                    : `本地: ${template.llmConfig.modelName}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CharacterSelector
