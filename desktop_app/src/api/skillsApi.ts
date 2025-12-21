/**
 * Skills API 调用模块
 * 通过 Tauri 命令与后端 Python 服务通信
 */

import { invoke } from '@tauri-apps/api/tauri'
import type { ApiResponse } from '../types'

// ================================
// Core Skills API Functions
// ================================

/**
 * 执行技能包
 * @param packageId 技能包ID
 * @param payload 执行参数
 * @returns 完整的后端 ApiResponse
 */
export async function executeSkill(packageId: string, payload: any): Promise<ApiResponse> {
    return invoke('api_execute_skill', {
        packageId,
        payload
    })
}

/**
 * 从 ApiResponse 中提取结果数据
 * @param apiResponse 后端返回的 ApiResponse
 * @returns 提取的 result 数据
 */
export function extractResult(apiResponse: ApiResponse): any {
    return apiResponse.data?.result
}

// ================================
// Mood Skills Convenience Functions
// ================================

/**
 * 记录心情日记
 * @param params 心情日记参数
 * @param params.turn 对话轮次数据
 * @param params.turn.user_text 用户文本
 * @param params.turn.assistant_text 助手文本
 * @param params.turn.ts 时间戳
 * @param params.context 可选的上下文信息
 * @param params.context.conversation_id 对话ID
 * @param params.context.character_id 角色ID
 * @param params.context.source 来源标识
 * @returns 执行结果
 */
export async function recordMoodDiary(params: {
    turn: {
        user_text: string
        assistant_text: string
        ts: string
    }
    context?: {
        conversation_id?: string
        character_id?: string
        source?: string
    }
}): Promise<ApiResponse> {
    return executeSkill('skill.builtin.mood.record', params)
}

/**
 * 回顾心情日记
 * @param params 回顾参数
 * @param params.limit 限制数量
 * @param params.date_range 日期范围
 * @param params.date_range.start 开始日期
 * @param params.date_range.end 结束日期
 * @param params.tags 标签列表
 * @returns 回顾结果
 */
export async function reviewMoodDiary(params: {
    limit?: number
    date_range?: {
        start: string
        end: string
    }
    tags?: string[]
    range?: {
        from: string
        to: string
    }
    keyword?: string
    mood?: string[]
    topics?: string[]
}): Promise<ApiResponse> {
    const payload: any = { ...params }

    if (!payload.range && payload.date_range?.start && payload.date_range?.end) {
        payload.range = {
            from: payload.date_range.start,
            to: payload.date_range.end,
        }
    }

    if (!payload.topics && Array.isArray(payload.tags) && payload.tags.length > 0) {
        payload.topics = payload.tags
    }

    return executeSkill('skill.builtin.mood.review', payload)
}

// ================================
// Health Check
// ================================

/**
 * 技能服务健康检查
 * @returns 服务是否健康
 */
export async function skillsHealthCheck(): Promise<boolean> {
    try {
        const response = await invoke('api_skills_health_check')
        return response === true || response?.success === true
    } catch (error) {
        console.error('Skills health check failed:', error)
        return false
    }
}

export const skillsApi = {
    executeSkill,
    extractResult,
    recordMoodDiary,
    reviewMoodDiary,
    skillsHealthCheck,
}

export default skillsApi
