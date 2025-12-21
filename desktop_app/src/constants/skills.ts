/**
 * 技能相关常量定义
 */

import type { Skill } from '@/types/characterTemplate'

/**
 * 可用技能列表
 */
export const AVAILABLE_SKILLS: Skill[] = [
  {
    package_id: 'skill.builtin.mood.record',
    name: '情绪记录',
    description: '记录用户在对话中的情绪状态和上下文信息',
    category: 'official',
    builtin: true,
  },
  {
    package_id: 'skill.builtin.mood.review',
    name: '情绪回顾',
    description: '回顾和分析历史情绪记录，提供情绪趋势分析',
    category: 'official',
    builtin: true,
  },
]

/**
 * 默认启用的技能列表
 */
export const DEFAULT_ENABLED_SKILLS: string[] = [
  'skill.builtin.mood.record',
  'skill.builtin.mood.review',
]

/**
 * 按分类分组的技能
 */
export const SKILLS_BY_CATEGORY = {
  official: AVAILABLE_SKILLS.filter(skill => skill.category === 'official'),
  community: AVAILABLE_SKILLS.filter(skill => skill.category === 'community'),
  custom: AVAILABLE_SKILLS.filter(skill => skill.category === 'custom'),
}

/**
 * 获取技能的显示名称
 */
export const getSkillDisplayName = (packageId: string): string => {
  const skill = AVAILABLE_SKILLS.find(s => s.package_id === packageId)
  return skill?.name || packageId
}

/**
 * 获取技能的描述
 */
export const getSkillDescription = (packageId: string): string => {
  const skill = AVAILABLE_SKILLS.find(s => s.package_id === packageId)
  return skill?.description || '暂无描述'
}