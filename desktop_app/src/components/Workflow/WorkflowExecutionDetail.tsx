/**
 * 工作流执行详情组件
 */

import React, { useState, useEffect } from 'react'
import { getExecution, cancelExecution, listExecutions } from '../../api/workflowApi'
import type { WorkflowExecutionResponse } from '../../types/workflow'
import styles from './WorkflowExecutionDetail.module.css'

interface WorkflowExecutionDetailProps {
    workflowId: string | null
    executionId?: string | null
}

export const WorkflowExecutionDetail: React.FC<WorkflowExecutionDetailProps> = ({
    workflowId,
    executionId: initialExecutionId,
}) => {
    const [executions, setExecutions] = useState<WorkflowExecutionResponse[]>([])
    const [selectedExecution, setSelectedExecution] = useState<WorkflowExecutionResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // 加载执行列表
    const loadExecutions = async () => {
        if (!workflowId) {
            setExecutions([])
            setSelectedExecution(null)
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)
            const data = await listExecutions(workflowId, 0, 10)
            setExecutions(data)

            // 如果有指定的executionId，加载该执行详情
            if (initialExecutionId) {
                const execution = await getExecution(initialExecutionId)
                setSelectedExecution(execution)
            } else if (data.length > 0) {
                setSelectedExecution(data[0])
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载执行历史失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadExecutions()
    }, [workflowId, initialExecutionId])

    // 自动刷新正在运行的执行
    useEffect(() => {
        if (!selectedExecution || selectedExecution.execution_status === 'completed' || selectedExecution.execution_status === 'failed') {
            return
        }

        const interval = setInterval(async () => {
            try {
                const updated = await getExecution(selectedExecution.id)
                setSelectedExecution(updated)

                // 如果状态变为完成或失败，停止刷新
                if (updated.execution_status === 'completed' || updated.execution_status === 'failed') {
                    clearInterval(interval)
                }
            } catch (err) {
                console.error('刷新执行状态失败:', err)
            }
        }, 2000)

        return () => clearInterval(interval)
    }, [selectedExecution])

    const handleSelectExecution = (execution: WorkflowExecutionResponse) => {
        setSelectedExecution(execution)
    }

    const handleCancel = async () => {
        if (!selectedExecution) return

        if (!confirm('确定要取消这个执行吗？')) {
            return
        }

        try {
            await cancelExecution(selectedExecution.id)
            await loadExecutions()
        } catch (err) {
            alert('取消失败: ' + (err instanceof Error ? err.message : '未知错误'))
        }
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleString('zh-CN')
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return styles.statusCompleted
            case 'running':
                return styles.statusRunning
            case 'failed':
                return styles.statusFailed
            case 'cancelled':
                return styles.statusCancelled
            case 'pending':
                return styles.statusPending
            default:
                return ''
        }
    }

    if (!workflowId) {
        return (
            <div className={styles.container}>
                <div className={styles.empty}>
                    <p>请先选择一个工作流</p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>加载中...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>
                    <p>加载失败: {error}</p>
                    <button onClick={loadExecutions}>重试</button>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.layout}>
                {/* 执行列表 */}
                <div className={styles.sidebar}>
                    <h3>执行历史</h3>
                    <div className={styles.executionList}>
                        {executions.length === 0 ? (
                            <div className={styles.emptyList}>暂无执行记录</div>
                        ) : (
                            executions.map((execution) => (
                                <div
                                    key={execution.id}
                                    className={`${styles.executionItem} ${
                                        selectedExecution?.id === execution.id ? styles.active : ''
                                    }`}
                                    onClick={() => handleSelectExecution(execution)}
                                >
                                    <div className={styles.executionHeader}>
                                        <span className={`${styles.status} ${getStatusColor(execution.execution_status)}`}>
                                            {execution.execution_status}
                                        </span>
                                        <span className={styles.executionTime}>
                                            {formatDate(execution.created_at)}
                                        </span>
                                    </div>
                                    <div className={styles.executionMeta}>
                                        <span>模式: {execution.execution_mode}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 执行详情 */}
                <div className={styles.detail}>
                    {selectedExecution ? (
                        <>
                            <div className={styles.detailHeader}>
                                <h3>执行详情</h3>
                                {(selectedExecution.execution_status === 'running' || 
                                  selectedExecution.execution_status === 'pending') && (
                                    <button className={styles.cancelBtn} onClick={handleCancel}>
                                        取消执行
                                    </button>
                                )}
                            </div>

                            <div className={styles.detailContent}>
                                <div className={styles.section}>
                                    <h4>基本信息</h4>
                                    <div className={styles.infoGrid}>
                                        <div className={styles.infoItem}>
                                            <label>执行ID:</label>
                                            <span>{selectedExecution.id}</span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <label>状态:</label>
                                            <span className={`${styles.status} ${getStatusColor(selectedExecution.execution_status)}`}>
                                                {selectedExecution.execution_status}
                                            </span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <label>执行模式:</label>
                                            <span>{selectedExecution.execution_mode}</span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <label>开始时间:</label>
                                            <span>{formatDate(selectedExecution.started_at)}</span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <label>完成时间:</label>
                                            <span>{formatDate(selectedExecution.completed_at)}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedExecution.input_data && (
                                    <div className={styles.section}>
                                        <h4>输入数据</h4>
                                        <pre className={styles.jsonData}>
                                            {JSON.stringify(selectedExecution.input_data, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {selectedExecution.output_data && (
                                    <div className={styles.section}>
                                        <h4>输出数据</h4>
                                        <pre className={styles.jsonData}>
                                            {JSON.stringify(selectedExecution.output_data, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {selectedExecution.error_message && (
                                    <div className={`${styles.section} ${styles.errorSection}`}>
                                        <h4>错误信息</h4>
                                        <pre className={styles.errorMessage}>
                                            {selectedExecution.error_message}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className={styles.emptyDetail}>
                            <p>请选择一个执行记录查看详情</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default WorkflowExecutionDetail
