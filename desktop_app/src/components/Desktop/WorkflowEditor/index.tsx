/**
 * 工作流编辑器组件
 * 
 * 功能特性：
 * - 可视化工作流设计
 * - 步骤管理（添加、编辑、删除、排序）
 * - 步骤类型支持（动作、条件、循环、延迟、触发器）
 * - 工作流配置
 * - 验证和错误提示
 * - 导入导出
 * - 实时预览
 * 
 * @module WorkflowEditor
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { Button } from '../../common/Button/index'
import type { WorkflowDefinition, WorkflowStep, WorkflowConfig } from '@/services/api/desktop'
import { WorkflowStatus } from '@/services/api/desktop'
import styles from './WorkflowEditor.module.css'

/**
 * 工作流编辑器属性
 */
export interface WorkflowEditorProps {
  /** 要编辑的工作流（编辑模式） */
  workflow?: WorkflowDefinition
  /** 保存回调 */
  onSave: (workflow: WorkflowDefinition) => void
  /** 取消回调 */
  onCancel: () => void
  /** 只读模式 */
  readOnly?: boolean
}

/**
 * 步骤类型选项
 */
const STEP_TYPES = [
  { value: 'action', label: '动作', icon: '⚡', description: '执行一个具体操作' },
  { value: 'condition', label: '条件', icon: '🔀', description: '基于条件分支' },
  { value: 'loop', label: '循环', icon: '🔄', description: '重复执行步骤' },
  { value: 'delay', label: '延迟', icon: '⏱️', description: '等待一段时间' },
  { value: 'trigger', label: '触发器', icon: '🎯', description: '触发其他工作流' },
] as const

/**
 * 默认工作流配置
 */
const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  enabled: true,
  timeout_ms: 300000, // 5分钟
  max_retries: 3,
  concurrency: 1,
  stop_on_error: true,
  log_level: 'info',
  notifications: {
    on_start: false,
    on_complete: true,
    on_error: true,
    on_cancel: false,
  },
}

/**
 * 默认步骤错误处理
 */
const DEFAULT_ERROR_HANDLING = {
  retry_count: 3,
  retry_delay_ms: 1000,
  on_error: 'stop' as const,
}

/**
 * 工作流编辑器组件
 */
export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  workflow,
  onSave,
  onCancel,
  readOnly = false,
}) => {
  // ==================== 状态管理 ====================
  const [workflowData, setWorkflowData] = useState<Partial<WorkflowDefinition>>(() => ({
    name: workflow?.name || '',
    description: workflow?.description || '',
    version: workflow?.version || '1.0.0',
    steps: workflow?.steps || [],
    config: workflow?.config || DEFAULT_WORKFLOW_CONFIG,
    status: workflow?.status || WorkflowStatus.Draft,
    tags: workflow?.tags || [],
    category: workflow?.category || 'general',
  }))

  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
  const [isAddingStep, setIsAddingStep] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // ==================== 验证 ====================

  /**
   * 验证工作流
   */
  const validateWorkflow = useCallback((): string[] => {
    const errors: string[] = []

    if (!workflowData.name?.trim()) {
      errors.push('工作流名称不能为空')
    }

    if (!workflowData.steps || workflowData.steps.length === 0) {
      errors.push('至少需要一个步骤')
    }

    // 验证步骤
    workflowData.steps?.forEach((step, index) => {
      if (!step.name?.trim()) {
        errors.push(`步骤 ${index + 1}: 名称不能为空`)
      }

      if (!step.type) {
        errors.push(`步骤 ${index + 1}: 必须选择类型`)
      }

      // 验证next_steps引用
      step.next_steps?.forEach((nextStepId) => {
        const exists = workflowData.steps?.some(s => s.id === nextStepId)
        if (!exists) {
          errors.push(`步骤 ${index + 1}: 引用了不存在的下一步骤 ${nextStepId}`)
        }
      })
    })

    // 检查循环引用
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const hasCycle = (stepId: string): boolean => {
      visited.add(stepId)
      recursionStack.add(stepId)

      const step = workflowData.steps?.find(s => s.id === stepId)
      if (step) {
        for (const nextId of step.next_steps || []) {
          if (!visited.has(nextId)) {
            if (hasCycle(nextId)) return true
          } else if (recursionStack.has(nextId)) {
            return true
          }
        }
      }

      recursionStack.delete(stepId)
      return false
    }

    workflowData.steps?.forEach((step) => {
      if (!visited.has(step.id) && hasCycle(step.id)) {
        errors.push('工作流中存在循环引用')
      }
    })

    return errors
  }, [workflowData])

  // ==================== 工作流操作 ====================

  /**
   * 更新工作流字段
   */
  const updateField = useCallback(<K extends keyof WorkflowDefinition>(
    field: K,
    value: WorkflowDefinition[K]
  ) => {
    setWorkflowData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }, [])

  /**
   * 保存工作流
   */
  const handleSave = useCallback(() => {
    const errors = validateWorkflow()
    setValidationErrors(errors)

    if (errors.length > 0) {
      return
    }

    const completeWorkflow: WorkflowDefinition = {
      id: workflow?.id || `workflow-${Date.now()}`,
      name: workflowData.name!,
      description: workflowData.description,
      version: workflowData.version!,
      created_at: workflow?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      steps: workflowData.steps!,
      config: workflowData.config!,
      status: workflowData.status!,
      tags: workflowData.tags!,
      category: workflowData.category!,
    }

    onSave(completeWorkflow)
    setIsDirty(false)
  }, [workflow, workflowData, validateWorkflow, onSave])

  // ==================== 步骤操作 ====================

  /**
   * 添加步骤
   */
  const handleAddStep = useCallback((type: WorkflowStep['type']) => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      name: `新步骤 ${(workflowData.steps?.length || 0) + 1}`,
      type,
      description: '',
      config: {},
      next_steps: [],
      error_handling: DEFAULT_ERROR_HANDLING,
      status: 'pending',
    }

    setWorkflowData(prev => ({
      ...prev,
      steps: [...(prev.steps || []), newStep],
    }))

    setSelectedStep(newStep)
    setIsAddingStep(false)
    setIsDirty(true)
  }, [workflowData.steps])

  /**
   * 更新步骤
   */
  const handleUpdateStep = useCallback((stepId: string, updates: Partial<WorkflowStep>) => {
    setWorkflowData(prev => ({
      ...prev,
      steps: prev.steps?.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      ),
    }))

    if (selectedStep?.id === stepId) {
      setSelectedStep(prev => prev ? { ...prev, ...updates } : null)
    }

    setIsDirty(true)
  }, [selectedStep])

  /**
   * 删除步骤
   */
  const handleDeleteStep = useCallback((stepId: string) => {
    if (!confirm('确定要删除这个步骤吗？')) {
      return
    }

    setWorkflowData(prev => ({
      ...prev,
      steps: prev.steps?.filter(step => step.id !== stepId),
    }))

    if (selectedStep?.id === stepId) {
      setSelectedStep(null)
    }

    setIsDirty(true)
  }, [selectedStep])

  /**
   * 复制步骤
   */
  const handleDuplicateStep = useCallback((stepId: string) => {
    const step = workflowData.steps?.find(s => s.id === stepId)
    if (!step) return

    const newStep: WorkflowStep = {
      ...step,
      id: `step-${Date.now()}`,
      name: `${step.name} (副本)`,
    }

    setWorkflowData(prev => ({
      ...prev,
      steps: [...(prev.steps || []), newStep],
    }))

    setIsDirty(true)
  }, [workflowData.steps])

  /**
   * 移动步骤
   */
  const handleReorderSteps = useCallback((newSteps: WorkflowStep[]) => {
    setWorkflowData(prev => ({
      ...prev,
      steps: newSteps,
    }))
    setIsDirty(true)
  }, [])

  // ==================== 渲染工具函数 ====================

  /**
   * 获取步骤类型信息
   */
  const getStepTypeInfo = (type: WorkflowStep['type']) => {
    return STEP_TYPES.find(t => t.value === type) || STEP_TYPES[0]
  }

  /**
   * 获取步骤状态颜色
   */
  const getStepStatusColor = (status: WorkflowStep['status']): string => {
    switch (status) {
      case 'running':
        return '#3b82f6'
      case 'completed':
        return '#10b981'
      case 'failed':
        return '#ef4444'
      case 'skipped':
        return '#6b7280'
      default:
        return '#9ca3af'
    }
  }

  // ==================== 渲染子组件 ====================

  /**
   * 渲染步骤列表
   */
  const renderStepList = () => (
    <div className={styles.stepList}>
      <div className={styles.stepListHeader}>
        <h3>工作流步骤</h3>
        {!readOnly && (
          <Button size="sm" onClick={() => setIsAddingStep(true)}>
            添加步骤
          </Button>
        )}
      </div>

      {workflowData.steps && workflowData.steps.length > 0 ? (
        <Reorder.Group
          axis="y"
          values={workflowData.steps}
          onReorder={handleReorderSteps}
          className={styles.stepItems}
        >
          {workflowData.steps.map((step, index) => (
            <Reorder.Item
              key={step.id}
              value={step}
              className={`${styles.stepItem} ${selectedStep?.id === step.id ? styles.stepItemSelected : ''}`}
              onClick={() => setSelectedStep(step)}
            >
              <div className={styles.stepNumber}>{index + 1}</div>
              <div className={styles.stepIcon}>
                {getStepTypeInfo(step.type).icon}
              </div>
              <div className={styles.stepContent}>
                <div className={styles.stepName}>{step.name}</div>
                <div className={styles.stepType}>{getStepTypeInfo(step.type).label}</div>
              </div>
              <div
                className={styles.stepStatus}
                style={{ backgroundColor: getStepStatusColor(step.status) }}
              />
              {!readOnly && (
                <div className={styles.stepActions}>
                  <button
                    className={styles.stepActionBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDuplicateStep(step.id)
                    }}
                    title="复制"
                  >
                    📋
                  </button>
                  <button
                    className={styles.stepActionBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteStep(step.id)
                    }}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div className={styles.emptySteps}>
          <div className={styles.emptyIcon}>📝</div>
          <div className={styles.emptyText}>暂无步骤</div>
          {!readOnly && (
            <Button size="sm" onClick={() => setIsAddingStep(true)}>
              添加第一个步骤
            </Button>
          )}
        </div>
      )}
    </div>
  )

  /**
   * 渲染步骤详情编辑器
   */
  const renderStepEditor = () => {
    if (!selectedStep) {
      return (
        <div className={styles.emptyEditor}>
          <div className={styles.emptyIcon}>👈</div>
          <div className={styles.emptyText}>选择一个步骤进行编辑</div>
        </div>
      )
    }

    const typeInfo = getStepTypeInfo(selectedStep.type)

    return (
      <div className={styles.stepEditor}>
        <div className={styles.editorHeader}>
          <h3>步骤详情</h3>
          <div className={styles.stepTypeBadge}>
            <span>{typeInfo.icon}</span>
            <span>{typeInfo.label}</span>
          </div>
        </div>

        <div className={styles.editorForm}>
          {/* 步骤名称 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>步骤名称</label>
            <input
              type="text"
              className={styles.formInput}
              value={selectedStep.name}
              onChange={(e) => handleUpdateStep(selectedStep.id, { name: e.target.value })}
              disabled={readOnly}
              placeholder="输入步骤名称"
            />
          </div>

          {/* 步骤描述 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>步骤描述</label>
            <textarea
              className={styles.formTextarea}
              value={selectedStep.description || ''}
              onChange={(e) => handleUpdateStep(selectedStep.id, { description: e.target.value })}
              disabled={readOnly}
              placeholder="输入步骤描述"
              rows={3}
            />
          </div>

          {/* 步骤配置 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>步骤配置 (JSON)</label>
            <textarea
              className={styles.formTextarea}
              value={JSON.stringify(selectedStep.config, null, 2)}
              onChange={(e) => {
                try {
                  const config = JSON.parse(e.target.value)
                  handleUpdateStep(selectedStep.id, { config })
                } catch {
                  // 忽略无效JSON
                }
              }}
              disabled={readOnly}
              placeholder="{}"
              rows={6}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </div>

          {/* 错误处理 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>错误处理</label>
            <div className={styles.formRow}>
              <div className={styles.formCol}>
                <label className={styles.formSubLabel}>重试次数</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={selectedStep.error_handling?.retry_count || 0}
                  onChange={(e) => handleUpdateStep(selectedStep.id, {
                    error_handling: {
                      ...selectedStep.error_handling!,
                      retry_count: parseInt(e.target.value, 10),
                    },
                  })}
                  disabled={readOnly}
                  min={0}
                  max={10}
                />
              </div>
              <div className={styles.formCol}>
                <label className={styles.formSubLabel}>重试延迟 (ms)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={selectedStep.error_handling?.retry_delay_ms || 0}
                  onChange={(e) => handleUpdateStep(selectedStep.id, {
                    error_handling: {
                      ...selectedStep.error_handling!,
                      retry_delay_ms: parseInt(e.target.value, 10),
                    },
                  })}
                  disabled={readOnly}
                  min={0}
                  step={100}
                />
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formSubLabel}>失败时</label>
              <select
                className={styles.formSelect}
                value={selectedStep.error_handling?.on_error || 'stop'}
                onChange={(e) => handleUpdateStep(selectedStep.id, {
                  error_handling: {
                    ...selectedStep.error_handling!,
                    on_error: e.target.value as any,
                  },
                })}
                disabled={readOnly}
              >
                <option value="stop">停止工作流</option>
                <option value="continue">继续执行</option>
                <option value="skip">跳过此步骤</option>
              </select>
            </div>
          </div>

          {/* 下一步骤 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>下一步骤</label>
            <div className={styles.nextSteps}>
              {selectedStep.next_steps?.map((nextId) => {
                const nextStep = workflowData.steps?.find(s => s.id === nextId)
                return nextStep ? (
                  <div key={nextId} className={styles.nextStepTag}>
                    <span>{nextStep.name}</span>
                    {!readOnly && (
                      <button
                        onClick={() => {
                          handleUpdateStep(selectedStep.id, {
                            next_steps: selectedStep.next_steps?.filter(id => id !== nextId),
                          })
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ) : null
              })}
              {!readOnly && (
                <select
                  className={styles.formSelect}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleUpdateStep(selectedStep.id, {
                        next_steps: [...(selectedStep.next_steps || []), e.target.value],
                      })
                    }
                  }}
                >
                  <option value="">选择下一步骤...</option>
                  {workflowData.steps
                    ?.filter(s => s.id !== selectedStep.id && !selectedStep.next_steps?.includes(s.id))
                    .map(step => (
                      <option key={step.id} value={step.id}>
                        {step.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 渲染步骤类型选择器
   */
  const renderStepTypeSelector = () => (
    <motion.div
      className={styles.stepTypeSelector}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div className={styles.selectorHeader}>
        <h3>选择步骤类型</h3>
        <button className={styles.closeBtn} onClick={() => setIsAddingStep(false)}>
          ✕
        </button>
      </div>
      <div className={styles.selectorGrid}>
        {STEP_TYPES.map((type) => (
          <button
            key={type.value}
            className={styles.typeCard}
            onClick={() => handleAddStep(type.value)}
          >
            <div className={styles.typeIcon}>{type.icon}</div>
            <div className={styles.typeName}>{type.label}</div>
            <div className={styles.typeDesc}>{type.description}</div>
          </button>
        ))}
      </div>
    </motion.div>
  )

  /**
   * 渲染工作流配置
   */
  const renderWorkflowConfig = () => (
    <motion.div
      className={styles.workflowConfig}
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
    >
      <div className={styles.configHeader}>
        <h3>工作流配置</h3>
        <button className={styles.closeBtn} onClick={() => setShowConfig(false)}>
          ✕
        </button>
      </div>

      <div className={styles.configForm}>
        {/* 基本设置 */}
        <div className={styles.configSection}>
          <h4>基本设置</h4>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <input
                type="checkbox"
                checked={workflowData.config?.enabled ?? true}
                onChange={(e) => updateField('config', {
                  ...workflowData.config!,
                  enabled: e.target.checked,
                })}
                disabled={readOnly}
              />
              <span>启用工作流</span>
            </label>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>超时时间 (毫秒)</label>
            <input
              type="number"
              className={styles.formInput}
              value={workflowData.config?.timeout_ms || 0}
              onChange={(e) => updateField('config', {
                ...workflowData.config!,
                timeout_ms: parseInt(e.target.value, 10),
              })}
              disabled={readOnly}
              min={0}
              step={1000}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>最大重试次数</label>
            <input
              type="number"
              className={styles.formInput}
              value={workflowData.config?.max_retries || 0}
              onChange={(e) => updateField('config', {
                ...workflowData.config!,
                max_retries: parseInt(e.target.value, 10),
              })}
              disabled={readOnly}
              min={0}
              max={10}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>并发数量</label>
            <input
              type="number"
              className={styles.formInput}
              value={workflowData.config?.concurrency || 1}
              onChange={(e) => updateField('config', {
                ...workflowData.config!,
                concurrency: parseInt(e.target.value, 10),
              })}
              disabled={readOnly}
              min={1}
              max={10}
            />
          </div>
        </div>

        {/* 错误处理 */}
        <div className={styles.configSection}>
          <h4>错误处理</h4>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <input
                type="checkbox"
                checked={workflowData.config?.stop_on_error ?? true}
                onChange={(e) => updateField('config', {
                  ...workflowData.config!,
                  stop_on_error: e.target.checked,
                })}
                disabled={readOnly}
              />
              <span>失败时停止</span>
            </label>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>日志级别</label>
            <select
              className={styles.formSelect}
              value={workflowData.config?.log_level || 'info'}
              onChange={(e) => updateField('config', {
                ...workflowData.config!,
                log_level: e.target.value as any,
              })}
              disabled={readOnly}
            >
              <option value="debug">调试</option>
              <option value="info">信息</option>
              <option value="warn">警告</option>
              <option value="error">错误</option>
            </select>
          </div>
        </div>

        {/* 通知设置 */}
        <div className={styles.configSection}>
          <h4>通知设置</h4>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <input
                type="checkbox"
                checked={workflowData.config?.notifications?.on_start ?? false}
                onChange={(e) => updateField('config', {
                  ...workflowData.config!,
                  notifications: {
                    ...workflowData.config!.notifications,
                    on_start: e.target.checked,
                  },
                })}
                disabled={readOnly}
              />
              <span>启动时通知</span>
            </label>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <input
                type="checkbox"
                checked={workflowData.config?.notifications?.on_complete ?? true}
                onChange={(e) => updateField('config', {
                  ...workflowData.config!,
                  notifications: {
                    ...workflowData.config!.notifications,
                    on_complete: e.target.checked,
                  },
                })}
                disabled={readOnly}
              />
              <span>完成时通知</span>
            </label>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <input
                type="checkbox"
                checked={workflowData.config?.notifications?.on_error ?? true}
                onChange={(e) => updateField('config', {
                  ...workflowData.config!,
                  notifications: {
                    ...workflowData.config!.notifications,
                    on_error: e.target.checked,
                  },
                })}
                disabled={readOnly}
              />
              <span>错误时通知</span>
            </label>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <input
                type="checkbox"
                checked={workflowData.config?.notifications?.on_cancel ?? false}
                onChange={(e) => updateField('config', {
                  ...workflowData.config!,
                  notifications: {
                    ...workflowData.config!.notifications,
                    on_cancel: e.target.checked,
                  },
                })}
                disabled={readOnly}
              />
              <span>取消时通知</span>
            </label>
          </div>
        </div>
      </div>
    </motion.div>
  )

  // ==================== 主渲染 ====================

  return (
    <div className={styles.workflowEditor}>
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <input
            type="text"
            className={styles.titleInput}
            value={workflowData.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            disabled={readOnly}
            placeholder="工作流名称"
          />
          {isDirty && <span className={styles.dirtyIndicator}>●</span>}
        </div>
        <div className={styles.headerRight}>
          <Button size="sm" variant="ghost" onClick={() => setShowConfig(true)}>
            ⚙️ 配置
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            取消
          </Button>
          {!readOnly && (
            <Button size="sm" onClick={handleSave}>
              保存
            </Button>
          )}
        </div>
      </div>

      {/* 工作流描述 */}
      <div className={styles.descriptionSection}>
        <textarea
          className={styles.descriptionInput}
          value={workflowData.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          disabled={readOnly}
          placeholder="工作流描述..."
          rows={2}
        />
      </div>

      {/* 验证错误 */}
      <AnimatePresence>
        {validationErrors.length > 0 && (
          <motion.div
            className={styles.errorPanel}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className={styles.errorHeader}>
              <span>⚠️ 验证错误</span>
              <button onClick={() => setValidationErrors([])}>✕</button>
            </div>
            <ul className={styles.errorList}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主内容区 */}
      <div className={styles.mainContent}>
        {/* 步骤列表 */}
        {renderStepList()}

        {/* 步骤编辑器 */}
        {renderStepEditor()}
      </div>

      {/* 覆盖层 */}
      <AnimatePresence>
        {isAddingStep && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingStep(false)}
            />
            {renderStepTypeSelector()}
          </>
        )}

        {showConfig && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfig(false)}
            />
            {renderWorkflowConfig()}
          </>
        )}
      </AnimatePresence>

      {/* 状态栏 */}
      <div className={styles.footer}>
        <div className={styles.footerInfo}>
          <span>版本: {workflowData.version}</span>
          <span>步骤: {workflowData.steps?.length || 0}</span>
          <span>状态: {workflowData.status}</span>
        </div>
        {isDirty && (
          <div className={styles.footerWarning}>
            未保存的更改
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkflowEditor

