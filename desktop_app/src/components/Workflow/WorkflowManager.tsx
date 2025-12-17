/**
 * 工作流管理主组件
 */

import React, { useState } from 'react'
import WorkflowList from './WorkflowList'
import WorkflowExecutionDetail from './WorkflowExecutionDetail'
import type { WorkflowResponse } from '../../types/workflow'
import styles from './WorkflowManager.module.css'

export const WorkflowManager: React.FC = () => {
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowResponse | null>(null)
    const [view, setView] = useState<'list' | 'executions'>('list')

    const handleSelectWorkflow = (workflow: WorkflowResponse) => {
        setSelectedWorkflow(workflow)
        setView('executions')
    }

    const handleBackToList = () => {
        setView('list')
        setSelectedWorkflow(null)
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>工作流管理</h1>
                <div className={styles.breadcrumb}>
                    <span 
                        className={view === 'list' ? styles.active : styles.link}
                        onClick={() => view !== 'list' && handleBackToList()}
                    >
                        工作流列表
                    </span>
                    {view === 'executions' && selectedWorkflow && (
                        <>
                            <span className={styles.separator}>/</span>
                            <span className={styles.active}>{selectedWorkflow.name} - 执行历史</span>
                        </>
                    )}
                </div>
            </div>

            <div className={styles.content}>
                {view === 'list' ? (
                    <WorkflowList onSelectWorkflow={handleSelectWorkflow} />
                ) : (
                    <WorkflowExecutionDetail workflowId={selectedWorkflow?.id || null} />
                )}
            </div>
        </div>
    )
}

export default WorkflowManager
