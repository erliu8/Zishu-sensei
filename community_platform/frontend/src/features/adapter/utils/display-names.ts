/**
 * 适配器显示名称映射工具
 * 将底层适配器类型映射到用户友好的显示名称
 * @module features/adapter/utils
 */

import { AdapterType } from '../domain';

/**
 * 适配器类型显示名称映射
 */
export const ADAPTER_TYPE_DISPLAY_NAMES: Record<AdapterType, string> = {
  [AdapterType.HARD]: '插件',
  [AdapterType.SOFT]: '提示词工程',
  [AdapterType.INTELLIGENT]: '微调模型',
};

/**
 * 适配器类型描述映射
 */
export const ADAPTER_TYPE_DESCRIPTIONS: Record<AdapterType, string> = {
  [AdapterType.HARD]: '由原生代码构建的工具，可扩展AI能力',
  [AdapterType.SOFT]: '基于提示词和RAG技术的智能引导',
  [AdapterType.INTELLIGENT]: '经过专业微调的AI模型',
};

/**
 * 适配器类型图标映射
 */
export const ADAPTER_TYPE_ICONS: Record<AdapterType, string> = {
  [AdapterType.HARD]: '🔌',
  [AdapterType.SOFT]: '💭',
  [AdapterType.INTELLIGENT]: '🤖',
};

/**
 * 获取适配器类型的显示名称
 */
export function getAdapterTypeDisplayName(type: AdapterType): string {
  return ADAPTER_TYPE_DISPLAY_NAMES[type] || type;
}

/**
 * 获取适配器类型的描述
 */
export function getAdapterTypeDescription(type: AdapterType): string {
  return ADAPTER_TYPE_DESCRIPTIONS[type] || '';
}

/**
 * 获取适配器类型的图标
 */
export function getAdapterTypeIcon(type: AdapterType): string {
  return ADAPTER_TYPE_ICONS[type] || '📦';
}

/**
 * 市场名称映射
 */
export const MARKET_DISPLAY_NAME = '插件市场';
export const MARKET_DESCRIPTION = '浏览和下载社区插件、提示词工程和微调模型';

