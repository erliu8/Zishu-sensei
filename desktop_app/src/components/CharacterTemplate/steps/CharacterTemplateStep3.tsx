/**
 * 角色模板创建 - 第三步：技能选择
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { DEFAULT_ENABLED_SKILLS, SKILLS_BY_CATEGORY } from '@/constants/skills'
import type { CreateCharacterTemplateStep3 } from '@/types/characterTemplate'

interface CharacterTemplateStep3Props {
  onComplete: (step3Data: CreateCharacterTemplateStep3) => void
  onBack: () => void
  isCreating: boolean
  initialEnabledSkills?: string[] | null
}

export const CharacterTemplateStep3: React.FC<CharacterTemplateStep3Props> = ({
  onComplete,
  onBack,
  isCreating,
  initialEnabledSkills,
}) => {
  const [enabledSkills, setEnabledSkills] = useState<string[]>(
    initialEnabledSkills || DEFAULT_ENABLED_SKILLS
  )
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    official: true,
    community: false,
    custom: false,
  })

  // 处理技能选择变化
  const handleSkillToggle = (packageId: string) => {
    setEnabledSkills(prev => {
      if (prev.includes(packageId)) {
        return prev.filter(id => id !== packageId)
      } else {
        return [...prev, packageId]
      }
    })
  }

  // 处理分类展开/收起
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  // 验证表单（至少选择一个技能）
  const isValid = () => {
    return enabledSkills.length > 0
  }

  // 处理完成
  const handleComplete = () => {
    if (!isValid()) return

    onComplete({
      enabledSkills: [...enabledSkills]
    })
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
      {/* 标题和描述 */}
      <div>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'hsl(var(--color-foreground))',
            marginBottom: '8px',
          }}
        >
          选择技能
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'hsl(var(--color-muted-foreground))',
            lineHeight: '1.5',
          }}
        >
          为您的角色选择可用的技能。技能可以增强角色的功能，例如情绪记录和分析。
        </p>
      </div>

      {/* 技能分类列表 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {Object.entries(SKILLS_BY_CATEGORY).map(([category, skills]) => {
          if (skills.length === 0) return null

          const categoryLabels = {
            official: '官方技能',
            community: '社区技能',
            custom: '自定义技能',
          }

          const categoryIcons = {
            official: '✅',
            community: '🌍',
            custom: '⚙️',
          }

          return (
            <div
              key={category}
              style={{
                border: '1px solid hsl(var(--color-border))',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              {/* 分类标题 */}
              <button
                onClick={() => toggleCategory(category)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'hsl(var(--color-muted) / 0.5)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'hsl(var(--color-foreground))',
                }}
              >
                <span style={{ fontSize: '16px' }}>
                  {categoryIcons[category as keyof typeof categoryIcons]}
                </span>
                <span>{categoryLabels[category as keyof typeof categoryLabels]}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    transform: expandedCategories[category] ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s',
                  }}
                >
                  ▼
                </span>
              </button>

              {/* 技能列表 */}
              {expandedCategories[category] && (
                <div
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {skills.map(skill => (
                    <label
                      key={skill.package_id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '6px',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enabledSkills.includes(skill.package_id)}
                        onChange={() => handleSkillToggle(skill.package_id)}
                        style={{
                          marginTop: '2px',
                          cursor: 'pointer',
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: 'hsl(var(--color-foreground))',
                            marginBottom: '4px',
                          }}
                        >
                          {skill.name}
                          {skill.builtin && (
                            <span
                              style={{
                                marginLeft: '8px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                backgroundColor: 'hsl(var(--color-primary) / 0.1)',
                                color: 'hsl(var(--color-primary))',
                                borderRadius: '4px',
                              }}
                            >
                              内置
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            color: 'hsl(var(--color-muted-foreground))',
                            lineHeight: '1.4',
                          }}
                        >
                          {skill.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 选中的技能数量提示 */}
      <div
        style={{
          fontSize: '13px',
          color: 'hsl(var(--color-muted-foreground))',
          textAlign: 'center',
        }}
      >
        已选择 {enabledSkills.length} 个技能
      </div>

      {/* 操作按钮 */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '20px',
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            border: '1px solid hsl(var(--color-border))',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: 'hsl(var(--color-foreground))',
            cursor: 'pointer',
          }}
        >
          上一步
        </button>
        <button
          onClick={handleComplete}
          disabled={!isValid()}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
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
          {isCreating ? '创建模板' : '保存修改'}
        </button>
      </div>
    </motion.div>
  )
}
