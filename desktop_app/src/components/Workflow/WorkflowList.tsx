/**
 * 工作流列表组件
 */

import React, { useState, useEffect } from 'react'
import { listWorkflows, deleteWorkflow, publishWorkflow, executeWorkflow } from '../../api/workflowApi'
import type { WorkflowResponse } from '../../types/workflow'
import styles from './WorkflowList.module.css'

interface WorkflowListProps {
    onSelectWorkflow?: (workflow: WorkflowResponse) => void
}

export const WorkflowList: React.FC<WorkflowListProps> = ({ onSelectWorkflow }) => {
    const [workflows, setWorkflows] = useState<WorkflowResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const loadWorkflows = async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await listWorkflows()
            setWorkflows(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载工作流失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadWorkflows()
    }, [])

    const handleSelect = (workflow: WorkflowResponse) => {
        setSelectedId(workflow.id)
        onSelectWorkflow?.(workflow)
    }

    const handleDelete = async (workflowId: string, event: React.MouseEvent) => {
        event.stopPropagation()
        
        if (!confirm('确定要删除这个工作流吗？')) {
            return
        }

        try {
            await deleteWorkflow(workflowId)
            await loadWorkflows()
        } catch (err) {
            alert('删除失败: ' + (err instanceof Error ? err.message : '未知错误'))
        }
    }

    const handlePublish = async (workflowId: string, event: React.MouseEvent) => {
        event.stopPropagation()
        
        try {
            await publishWorkflow(workflowId)
            await loadWorkflows()
        } catch (err) {
            alert('发布失败: ' + (err instanceof Error ? err.message : '未知错误'))
        }
    }

    const handleExecute = async (workflowId: string, event: React.MouseEvent) => {
        event.stopPropagation()
        
        try {
            await executeWorkflow(workflowId)
            alert('工作流已开始执行')
        } catch (err) {
            alert('执行失败: ' + (err instanceof Error ? err.message : '未知错误'))
        }
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
                    <button onClick={loadWorkflows}>重试</button>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>工作流列表</h2>
                <div className={styles.actions}>
                    <button className={styles.createBtn} onClick={() => alert('创建工作流功能开发中...')}>
                        + 创建工作流
                    </button>
                    <button className={styles.refreshBtn} onClick={loadWorkflows}>
                        刷新
                    </button>
                </div>
            </div>

            {workflows.length === 0 ? (
                <div className={styles.empty}>
                    <p>还没有工作流</p>
                    <p className={styles.hint}>点击创建按钮添加第一个工作流</p>
                </div>
            ) : (
                <div className={styles.list}>
                    {workflows.map((workflow) => (
                        <div
                            key={workflow.id}
                            className={`${styles.item} ${
                                workflow.id === selectedId ? styles.selected : ''
                            }`}
                            onClick={() => handleSelect(workflow)}
                        >
                            <div className={styles.itemHeader}>
                                <h3 className={styles.itemTitle}>{workflow.name}</h3>
                                <span className={`${styles.status} ${styles[workflow.workflow_status]}`}>
                                    {workflow.workflow_status}
                                </span>
                            </div>

                            {workflow.description && (
                                <p className={styles.itemDesc}>{workflow.description}</p>
                            )}

                            <div className={styles.itemMeta}>
                                <span className={styles.metaItem}>
                                    触发器: {workflow.trigger_type}
                                </span>
                                {workflow.category && (
                                    <span className={styles.metaItem}>
                                        分类: {workflow.category}
                                    </span>
                                )}
                            </div>

                            {workflow.tags && workflow.tags.length > 0 && (
                                <div className={styles.tags}>
                                    {workflow.tags.map((tag, index) => (
                                        <span key={index} className={styles.tag}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className={styles.actions}>
                                {workflow.workflow_status === 'draft' && (
                                    <button
                                        className={styles.actionBtn}
                                        onClick={(e) => handlePublish(workflow.id, e)}
                                    >
                                        发布
                                    </button>
                                )}
                                {workflow.workflow_status === 'published' && (
                                    <button
                                        className={`${styles.actionBtn} ${styles.primary}`}
                                        onClick={(e) => handleExecute(workflow.id, e)}
                                    >
                                        执行
                                    </button>
                                )}
                                <button
                                    className={`${styles.actionBtn} ${styles.danger}`}
                                    onClick={(e) => handleDelete(workflow.id, e)}
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default WorkflowList
