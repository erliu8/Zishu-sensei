/**
 * 角色模板创建器组件
 * 分为两步：1. 基本信息设置 2. LLM配置
 */

import React, { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CharacterTemplateService } from '@/services/characterTemplate'
import { CharacterTemplateStep1 } from './steps/CharacterTemplateStep1'
import { CharacterTemplateStep2 } from './steps/CharacterTemplateStep2'
import type {
  CreateCharacterTemplateStep1,
  LLMConfig,
} from '@/types/characterTemplate'

interface CharacterTemplateCreatorProps {
  onComplete: () => void
  onCancel: () => void
}

export const CharacterTemplateCreator: React.FC<CharacterTemplateCreatorProps> = ({
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)
  const [step1Data, setStep1Data] = useState<CreateCharacterTemplateStep1 | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 处理第一步完成
  const handleStep1Complete = (data: CreateCharacterTemplateStep1) => {
    setStep1Data(data)
    setCurrentStep(2)
    setError(null)
  }

  // 处理第二步完成
  const handleStep2Complete = async (llmConfig: LLMConfig) => {
    if (!step1Data) {
      setError('缺少第一步数据')
      return
    }

    try {
      setIsCreating(true)
      setError(null)
      
      await CharacterTemplateService.createTemplate(step1Data, llmConfig)
      onComplete()
    } catch (err) {
      console.error('创建模板失败:', err)
      setError('创建模板失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setIsCreating(false)
    }
  }

  // 返回上一步
  const handleBack = () => {
    setCurrentStep(1)
    setError(null)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* 步骤指示器 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px',
          backgroundColor: 'hsl(var(--color-muted) / 0.3)',
          borderRadius: '8px',
        }}
      >
        <StepIndicator
          number={1}
          title="基本信息"
          isActive={currentStep === 1}
          isCompleted={currentStep > 1}
        />
        <div
          style={{
            flex: 1,
            height: '2px',
            backgroundColor: currentStep > 1
              ? 'hsl(var(--color-primary))'
              : 'hsl(var(--color-border))',
          }}
        />
        <StepIndicator
          number={2}
          title="LLM配置"
          isActive={currentStep === 2}
          isCompleted={false}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          style={{
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

      {/* 步骤内容 */}
      <AnimatePresence mode="wait">
        {currentStep === 1 ? (
          <CharacterTemplateStep1
            onNext={handleStep1Complete}
            onCancel={onCancel}
            initialData={step1Data}
          />
        ) : (
          <CharacterTemplateStep2
            onComplete={handleStep2Complete}
            onBack={handleBack}
            isCreating={isCreating}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * 步骤指示器组件
 */
const StepIndicator: React.FC<{
  number: number
  title: string
  isActive: boolean
  isCompleted: boolean
}> = ({ number, title, isActive, isCompleted }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 600,
          backgroundColor: isCompleted || isActive
            ? 'hsl(var(--color-primary))'
            : 'hsl(var(--color-muted))',
          color: isCompleted || isActive
            ? 'hsl(var(--color-primary-foreground))'
            : 'hsl(var(--color-muted-foreground))',
        }}
      >
        {isCompleted ? '✓' : number}
      </div>
      <span
        style={{
          fontSize: '14px',
          fontWeight: isActive ? 600 : 400,
          color: isActive
            ? 'hsl(var(--color-foreground))'
            : 'hsl(var(--color-muted-foreground))',
        }}
      >
        {title}
      </span>
    </div>
  )
}
