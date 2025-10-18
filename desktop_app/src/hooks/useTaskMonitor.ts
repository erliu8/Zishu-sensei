/**
 * 任务监控 Hook
 * 
 * 提供任务监控和管理的便捷功能
 * 
 * @author zishu-sensei
 * @version 1.0.0
 */

import { useState, useCallback, useRef } from 'react'
import type {
    TaskExecutionContext,
    TaskQueueConfig,
    TaskSchedulerState,
} from '@/types/desktop'

/**
 * 任务状态
 */
export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

/**
 * 任务优先级
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * 任务定义
 */
export interface Task<T = any, R = any> {
    id: string
    name: string
    description?: string
    priority: TaskPriority
    execute: (context: TaskExecutionContext) => Promise<R>
    data?: T
    dependencies?: string[]
    timeout?: number
    retries?: number
    onProgress?: (progress: number) => void
    onComplete?: (result: R) => void
    onError?: (error: Error) => void
}

/**
 * 任务执行信息
 */
export interface TaskExecution {
    id: string
    taskId: string
    status: TaskStatus
    progress: number
    startTime: number
    endTime?: number
    result?: any
    error?: Error
    retryCount: number
}

/**
 * Hook 返回值
 */
export interface UseTaskMonitorReturn {
    // 状态
    tasks: Map<string, Task>
    executions: Map<string, TaskExecution>
    schedulerState: TaskSchedulerState
    isRunning: boolean
    isPaused: boolean
    
    // 任务管理
    addTask: <T = any, R = any>(task: Task<T, R>) => void
    removeTask: (taskId: string) => void
    clearTasks: () => void
    getTask: (taskId: string) => Task | undefined
    
    // 任务执行
    executeTask: (taskId: string) => Promise<void>
    executeTasks: (taskIds: string[]) => Promise<void>
    executeAll: () => Promise<void>
    
    // 调度控制
    start: () => void
    pause: () => void
    resume: () => void
    stop: () => void
    
    // 任务查询
    getExecution: (taskId: string) => TaskExecution | undefined
    getTasksByStatus: (status: TaskStatus) => Task[]
    getTasksByPriority: (priority: TaskPriority) => Task[]
    
    // 统计信息
    getStats: () => {
        total: number
        idle: number
        running: number
        completed: number
        error: number
        avgExecutionTime: number
    }
}

/**
 * 任务监控 Hook
 */
export function useTaskMonitor(config?: Partial<TaskQueueConfig>): UseTaskMonitorReturn {
    const [tasks, setTasks] = useState<Map<string, Task>>(new Map())
    const [executions, setExecutions] = useState<Map<string, TaskExecution>>(new Map())
    const [schedulerState, setSchedulerState] = useState<TaskSchedulerState>({
        isRunning: false,
        queueSize: 0,
        activeTasksCount: 0,
        completedTasksCount: 0,
        failedTasksCount: 0,
        lastTaskExecutionTime: 0,
    })
    const [isPaused, setIsPaused] = useState(false)
    
    const queueRef = useRef<string[]>([])
    const configRef = useRef<TaskQueueConfig>({
        maxConcurrent: config?.maxConcurrent ?? 3,
        maxRetries: config?.maxRetries ?? 3,
        retryDelay: config?.retryDelay ?? 1000,
        timeout: config?.timeout ?? 30000,
        priority: config?.priority ?? 'normal',
    })
    
    // 优先级映射
    const priorityLevels: Record<TaskPriority, number> = {
        urgent: 4,
        high: 3,
        normal: 2,
        low: 1,
    }
    
    // 添加任务
    const addTask = useCallback(<T = any, R = any>(task: Task<T, R>) => {
        setTasks(prev => new Map(prev).set(task.id, task))
        setExecutions(prev => new Map(prev).set(task.id, {
            id: `exec-${task.id}-${Date.now()}`,
            taskId: task.id,
            status: 'idle',
            progress: 0,
            startTime: 0,
            retryCount: 0,
        }))
    }, [])
    
    // 移除任务
    const removeTask = useCallback((taskId: string) => {
        setTasks(prev => {
            const next = new Map(prev)
            next.delete(taskId)
            return next
        })
        setExecutions(prev => {
            const next = new Map(prev)
            next.delete(taskId)
            return next
        })
        queueRef.current = queueRef.current.filter(id => id !== taskId)
        setSchedulerState(prev => ({
            ...prev,
            queueSize: queueRef.current.length,
        }))
    }, [])
    
    // 清空任务
    const clearTasks = useCallback(() => {
        setTasks(new Map())
        setExecutions(new Map())
        queueRef.current = []
        setSchedulerState(prev => ({
            ...prev,
            queueSize: 0,
            completedTasksCount: 0,
            failedTasksCount: 0,
        }))
    }, [])
    
    // 获取任务
    const getTask = useCallback((taskId: string) => {
        return tasks.get(taskId)
    }, [tasks])
    
    // 执行单个任务
    const executeTask = useCallback(async (taskId: string) => {
        const task = tasks.get(taskId)
        if (!task) {
            console.warn(`Task ${taskId} not found`)
            return
        }
        
        const execution = executions.get(taskId)
        if (!execution) {
            console.warn(`Execution for task ${taskId} not found`)
            return
        }
        
        // 更新执行状态为运行中
        setExecutions(prev => new Map(prev).set(taskId, {
            ...execution,
            status: 'running',
            startTime: Date.now(),
        }))
        
        setSchedulerState(prev => ({
            ...prev,
            activeTasksCount: prev.activeTasksCount + 1,
        }))
        
        try {
            // 创建执行上下文
            const context: TaskExecutionContext = {
                taskId: task.id,
                metadata: {
                    data: task.data,
                    signal: new AbortController().signal,
                    onProgress: (progress: number) => {
                        setExecutions(prev => {
                            const exec = prev.get(taskId)
                            if (!exec) return prev
                            return new Map(prev).set(taskId, { ...exec, progress })
                        })
                        task.onProgress?.(progress)
                    },
                },
            }
            
            // 设置超时
            const timeout = task.timeout ?? configRef.current.timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Task timeout')), timeout)
            })
            
            // 执行任务
            const result = await Promise.race([
                task.execute(context),
                timeoutPromise,
            ])
            
            // 更新执行状态为完成
            setExecutions(prev => new Map(prev).set(taskId, {
                ...execution,
                status: 'completed',
                progress: 100,
                endTime: Date.now(),
                result,
            }))
            
            setSchedulerState(prev => ({
                ...prev,
                activeTasksCount: prev.activeTasksCount - 1,
                completedTasksCount: prev.completedTasksCount + 1,
                lastTaskExecutionTime: Date.now(),
            }))
            
            task.onComplete?.(result)
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            
            // 重试逻辑
            const maxRetries = task.retries ?? configRef.current.maxRetries
            if (execution.retryCount < maxRetries) {
                setExecutions(prev => new Map(prev).set(taskId, {
                    ...execution,
                    retryCount: execution.retryCount + 1,
                }))
                
                // 延迟后重试
                await new Promise(resolve => setTimeout(resolve, configRef.current.retryDelay))
                return executeTask(taskId)
            }
            
            // 更新执行状态为错误
            setExecutions(prev => new Map(prev).set(taskId, {
                ...execution,
                status: 'error',
                endTime: Date.now(),
                error: err,
            }))
            
            setSchedulerState(prev => ({
                ...prev,
                activeTasksCount: prev.activeTasksCount - 1,
                failedTasksCount: prev.failedTasksCount + 1,
                lastTaskExecutionTime: Date.now(),
            }))
            
            task.onError?.(err)
        }
    }, [tasks, executions])
    
    // 执行多个任务
    const executeTasks = useCallback(async (taskIds: string[]) => {
        // 按优先级排序
        const sortedIds = taskIds.sort((a, b) => {
            const taskA = tasks.get(a)
            const taskB = tasks.get(b)
            if (!taskA || !taskB) return 0
            
            const priorityA = priorityLevels[taskA.priority]
            const priorityB = priorityLevels[taskB.priority]
            return priorityB - priorityA
        })
        
        // 添加到队列
        queueRef.current.push(...sortedIds)
        setSchedulerState(prev => ({
            ...prev,
            queueSize: queueRef.current.length,
        }))
        
        // 并发执行
        const maxConcurrent = configRef.current.maxConcurrent
        const executing: Promise<void>[] = []
        
        for (const taskId of sortedIds) {
            const promise = executeTask(taskId).then(() => {
                queueRef.current = queueRef.current.filter(id => id !== taskId)
                setSchedulerState(prev => ({
                    ...prev,
                    queueSize: queueRef.current.length,
                }))
            })
            
            executing.push(promise)
            
            if (executing.length >= maxConcurrent) {
                await Promise.race(executing)
            }
        }
        
        await Promise.all(executing)
    }, [tasks, executeTask])
    
    // 执行所有任务
    const executeAll = useCallback(async () => {
        const taskIds = Array.from(tasks.keys())
        await executeTasks(taskIds)
    }, [tasks, executeTasks])
    
    // 启动调度器
    const start = useCallback(() => {
        setSchedulerState(prev => ({
            ...prev,
            isRunning: true,
        }))
        setIsPaused(false)
    }, [])
    
    // 暂停调度器
    const pause = useCallback(() => {
        setIsPaused(true)
    }, [])
    
    // 恢复调度器
    const resume = useCallback(() => {
        setIsPaused(false)
    }, [])
    
    // 停止调度器
    const stop = useCallback(() => {
        setSchedulerState(prev => ({
            ...prev,
            isRunning: false,
        }))
        setIsPaused(false)
        queueRef.current = []
    }, [])
    
    // 获取执行信息
    const getExecution = useCallback((taskId: string) => {
        return executions.get(taskId)
    }, [executions])
    
    // 按状态获取任务
    const getTasksByStatus = useCallback((status: TaskStatus) => {
        return Array.from(tasks.values()).filter(task => {
            const execution = executions.get(task.id)
            return execution?.status === status
        })
    }, [tasks, executions])
    
    // 按优先级获取任务
    const getTasksByPriority = useCallback((priority: TaskPriority) => {
        return Array.from(tasks.values()).filter(task => task.priority === priority)
    }, [tasks])
    
    // 获取统计信息
    const getStats = useCallback(() => {
        const total = tasks.size
        let idle = 0
        let running = 0
        let completed = 0
        let error = 0
        let totalExecutionTime = 0
        let completedCount = 0
        
        executions.forEach(execution => {
            switch (execution.status) {
                case 'idle':
                    idle++
                    break
                case 'running':
                    running++
                    break
                case 'completed':
                    completed++
                    if (execution.startTime && execution.endTime) {
                        totalExecutionTime += execution.endTime - execution.startTime
                        completedCount++
                    }
                    break
                case 'error':
                    error++
                    break
            }
        })
        
        return {
            total,
            idle,
            running,
            completed,
            error,
            avgExecutionTime: completedCount > 0 ? totalExecutionTime / completedCount : 0,
        }
    }, [tasks, executions])
    
    return {
        tasks,
        executions,
        schedulerState,
        isRunning: schedulerState.isRunning,
        isPaused,
        addTask,
        removeTask,
        clearTasks,
        getTask,
        executeTask,
        executeTasks,
        executeAll,
        start,
        pause,
        resume,
        stop,
        getExecution,
        getTasksByStatus,
        getTasksByPriority,
        getStats,
    }
}

/**
 * 使用示例：
 * 
 * ```tsx
 * function MyComponent() {
 *   const taskMonitor = useTaskMonitor({
 *     maxConcurrent: 5,
 *     timeout: 60000,
 *   })
 * 
 *   const handleAddTask = () => {
 *     taskMonitor.addTask({
 *       id: 'task-1',
 *       name: '下载文件',
 *       priority: 'high',
 *       execute: async ({ onProgress }) => {
 *         // 执行任务逻辑
 *         for (let i = 0; i <= 100; i += 10) {
 *           await new Promise(resolve => setTimeout(resolve, 100))
 *           onProgress(i)
 *         }
 *         return { success: true }
 *       },
 *       onComplete: (result) => {
 *         console.log('任务完成', result)
 *       },
 *     })
 *   }
 * 
 *   return (
 *     <div>
 *       <button onClick={handleAddTask}>添加任务</button>
 *       <button onClick={() => taskMonitor.executeAll()}>执行所有</button>
 *       <div>总任务数: {taskMonitor.tasks.size}</div>
 *       <div>运行中: {taskMonitor.getStats().running}</div>
 *     </div>
 *   )
 * }
 * ```
 */

