/**
 * 角色模板创建器组件
 * 分为三步：1. 基本信息设置 2. LLM配置 3. 技能选择
 * 支持创建和编辑两种模式
 */

import React, { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CharacterTemplateService } from '@/services/characterTemplate'
import { CharacterTemplateStep1 } from './steps/CharacterTemplateStep1'
import { CharacterTemplateStep2 } from './steps/CharacterTemplateStep2'
import { CharacterTemplateStep3 } from './steps/CharacterTemplateStep3'
import { DEFAULT_ENABLED_SKILLS } from '@/constants/skills'
import type {
  CharacterTemplate,
  CharacterPrompt,
  CreateCharacterTemplateStep1,
  CreateCharacterTemplateStep3,
  LLMConfig,
} from '@/types/characterTemplate'

interface CharacterTemplateCreatorProps {
  /** 编辑模式下的初始模板数据 */
  initialTemplate?: CharacterTemplate
  /** 完成回调 */
  onComplete: () => void
  /** 取消回调 */
  onCancel: () => void
}

export const CharacterTemplateCreator: React.FC<CharacterTemplateCreatorProps> = ({
  initialTemplate,
  onComplete,
  onCancel,
}) => {
  const isEditMode = !!initialTemplate
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [step1Data, setStep1Data] = useState<CreateCharacterTemplateStep1 | null>(null)
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null)
  const [enabledSkills, setEnabledSkills] = useState<string[]>(DEFAULT_ENABLED_SKILLS)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 编辑模式:初始化数据
  useEffect(() => {
    if (initialTemplate) {
      setStep1Data({
        name: initialTemplate.name,
        description: initialTemplate.description,
        live2dModelId: initialTemplate.live2dModelId,
        // Step1 期望的是 promptId 或 CreateCharacterPromptInput
        prompt: initialTemplate.prompt.id,
      })
      setLlmConfig(initialTemplate.llmConfig)
      setEnabledSkills(initialTemplate.enabledSkills || DEFAULT_ENABLED_SKILLS)
    }
  }, [initialTemplate])

  // 处理第一步完成
  const handleStep1Complete = (data: CreateCharacterTemplateStep1) => {
    setStep1Data(data)
    setCurrentStep(2)
    setError(null)
  }

  // 处理第二步完成
  const handleStep2Complete = (newLlmConfig: LLMConfig) => {
    setLlmConfig(newLlmConfig)
    setCurrentStep(3)
    setError(null)
  }

  // 处理第三步完成
  const handleStep3Complete = async (step3Data: CreateCharacterTemplateStep3) => {
    if (!step1Data || !llmConfig) {
      setError('缺少前面的步骤数据')
      return
    }

    try {
      setIsCreating(true)
      setError(null)

      if (isEditMode && initialTemplate) {
        const resolvePrompt = async (): Promise<CharacterPrompt> => {
          const promptValue: any = step1Data.prompt

          if (typeof promptValue === 'string') {
            const existing = await CharacterTemplateService.getPromptById(promptValue)
            return existing || initialTemplate.prompt
          }

          if (promptValue && typeof promptValue === 'object' && typeof promptValue.id === 'string') {
            return promptValue as CharacterPrompt
          }

          return await CharacterTemplateService.createPrompt(promptValue)
        }

        // 编辑模式:更新模板
        await CharacterTemplateService.updateTemplate(initialTemplate.id, {
          name: step1Data.name,
          description: step1Data.description,
          live2dModelId: step1Data.live2dModelId,
          prompt: await resolvePrompt(),
          llmConfig: llmConfig,
          enabledSkills: step3Data.enabledSkills,
        })
      } else {
        // 创建模式:创建新模板
        await CharacterTemplateService.createTemplate(
          step1Data,
          llmConfig,
          step3Data.enabledSkills
        )
      }
      onComplete()
    } catch (err) {
      console.error(`${isEditMode ? '更新' : '创建'}模板失败:`, err)
      setError(`${isEditMode ? '更新' : '创建'}模板失败: ` + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setIsCreating(false)
    }
  }

  // 返回上一步
  const handleBack = () => {
    if (currentStep === 3) {
      setCurrentStep(2)
    } else {
      setCurrentStep(1)
    }
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
          isCompleted={currentStep > 2}
        />
        <div
          style={{
            flex: 1,
            height: '2px',
            backgroundColor: currentStep > 2
              ? 'hsl(var(--color-primary))'
              : 'hsl(var(--color-border))',
          }}
        />
        <StepIndicator
          number={3}
          title="技能选择"
          isActive={currentStep === 3}
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
        ) : currentStep === 2 ? (
          <CharacterTemplateStep2
            onComplete={handleStep2Complete}
            onBack={handleBack}
            isCreating={isCreating}
            initialLlmConfig={llmConfig}
          />
        ) : (
          <CharacterTemplateStep3
            onComplete={handleStep3Complete}
            onBack={handleBack}
            isCreating={isCreating}
            initialEnabledSkills={enabledSkills}
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
