/**
 * 工作流 API 调用模块
 * 通过 Tauri 命令与后端 Python 服务通信
 */

import { invoke } from '@tauri-apps/api/tauri'
import * as React from 'react'
import type {
    CreateWorkflowRequest,
    UpdateWorkflowRequest,
    ExecuteWorkflowRequest,
    WorkflowResponse,
    WorkflowExecutionResponse,
} from '../types/workflow'

// ================================
// 工作流 CRUD 操作
// ================================

/**
 * 创建工作流
 */
export async function createWorkflow(request: CreateWorkflowRequest): Promise<WorkflowResponse> {
    return invoke('api_create_workflow', {
        name: request.name,
        slug: request.slug,
        description: request.description,
        category: request.category,
        tags: request.tags,
        definition: request.definition,
        triggerType: request.trigger_type,
        triggerConfig: request.trigger_config,
    })
}

/**
 * 获取工作流列表
 */
export async function listWorkflows(
    skip?: number,
    limit?: number
): Promise<WorkflowResponse[]> {
    return invoke('api_list_workflows', { skip, limit })
}

/**
 * 获取工作流详情
 */
export async function getWorkflow(workflowId: string): Promise<WorkflowResponse> {
    return invoke('api_get_workflow', { workflowId })
}

/**
 * 更新工作流
 */
export async function updateWorkflow(
    workflowId: string,
    request: UpdateWorkflowRequest
): Promise<WorkflowResponse> {
    return invoke('api_update_workflow', {
        workflowId,
        name: request.name,
        description: request.description,
        category: request.category,
        tags: request.tags,
        definition: request.definition,
        triggerType: request.trigger_type,
        triggerConfig: request.trigger_config,
    })
}

/**
 * 删除工作流
 */
export async function deleteWorkflow(workflowId: string): Promise<void> {
    return invoke('api_delete_workflow', { workflowId })
}

// ================================
// 工作流执行
// ================================

/**
 * 执行工作流
 */
export async function executeWorkflow(
    workflowId: string,
    request?: ExecuteWorkflowRequest
): Promise<WorkflowExecutionResponse> {
    return invoke('api_execute_workflow', {
        workflowId,
        inputData: request?.input_data,
        executionMode: request?.execution_mode,
    })
}

/**
 * 获取工作流执行历史
 */
export async function listExecutions(
    workflowId: string,
    skip?: number,
    limit?: number
): Promise<WorkflowExecutionResponse[]> {
    return invoke('api_list_executions', { workflowId, skip, limit })
}

/**
 * 获取执行详情
 */
export async function getExecution(executionId: string): Promise<WorkflowExecutionResponse> {
    return invoke('api_get_execution', { executionId })
}

/**
 * 取消执行
 */
export async function cancelExecution(executionId: string): Promise<WorkflowExecutionResponse> {
    return invoke('api_cancel_execution', { executionId })
}

// ================================
// 工作流状态管理
// ================================

/**
 * 发布工作流
 */
export async function publishWorkflow(workflowId: string): Promise<WorkflowResponse> {
    return invoke('api_publish_workflow', { workflowId })
}

/**
 * 归档工作流
 */
export async function archiveWorkflow(workflowId: string): Promise<WorkflowResponse> {
    return invoke('api_archive_workflow', { workflowId })
}

/**
 * 克隆工作流
 */
export async function cloneWorkflow(
    workflowId: string,
    newName: string
): Promise<WorkflowResponse> {
    return invoke('api_clone_workflow', { workflowId, newName })
}

// ================================
// 工作流搜索
// ================================

/**
 * 搜索工作流
 */
export async function searchWorkflows(params: {
    keyword?: string
    status?: string
    category?: string
    tags?: string[]
}): Promise<WorkflowResponse[]> {
    return invoke('api_search_workflows', params)
}

// ================================
// 工作流模板
// ================================

/**
 * 获取模板列表
 */
export async function listTemplates(limit?: number): Promise<WorkflowResponse[]> {
    return invoke('api_list_templates', { limit })
}

/**
 * 从模板创建工作流
 */
export async function createFromTemplate(
    templateId: string,
    name: string,
    parameters?: Record<string, any>
): Promise<WorkflowResponse> {
    return invoke('api_create_from_template', { templateId, name, parameters })
}

// ================================
// 健康检查
// ================================

/**
 * 检查 API 服务健康状态
 */
export async function healthCheck(): Promise<boolean> {
    return invoke('api_health_check')
}

// ================================
// React Hook 封装
// ================================

/**
 * 使用工作流列表
 */
export function useWorkflows(skip = 0, limit = 20) {
    const [workflows, setWorkflows] = React.useState<WorkflowResponse[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const refresh = React.useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await listWorkflows(skip, limit)
            setWorkflows(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载工作流失败')
        } finally {
            setLoading(false)
        }
    }, [skip, limit])

    React.useEffect(() => {
        refresh()
    }, [refresh])

    return { workflows, loading, error, refresh }
}

/**
 * 使用单个工作流
 */
export function useWorkflow(workflowId: string | null) {
    const [workflow, setWorkflow] = React.useState<WorkflowResponse | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const refresh = React.useCallback(async () => {
        if (!workflowId) {
            setWorkflow(null)
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)
            const data = await getWorkflow(workflowId)
            setWorkflow(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载工作流失败')
        } finally {
            setLoading(false)
        }
    }, [workflowId])

    React.useEffect(() => {
        refresh()
    }, [refresh])

    return { workflow, loading, error, refresh }
}

/**
 * 使用工作流执行
 */
export function useWorkflowExecutions(workflowId: string | null, skip = 0, limit = 20) {
    const [executions, setExecutions] = React.useState<WorkflowExecutionResponse[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const refresh = React.useCallback(async () => {
        if (!workflowId) {
            setExecutions([])
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)
            const data = await listExecutions(workflowId, skip, limit)
            setExecutions(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载执行历史失败')
        } finally {
            setLoading(false)
        }
    }, [workflowId, skip, limit])

    React.useEffect(() => {
        refresh()
    }, [refresh])

    return { executions, loading, error, refresh }
}
