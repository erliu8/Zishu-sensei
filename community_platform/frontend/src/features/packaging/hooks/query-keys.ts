/**
 * Packaging Query Keys
 * 打包服务 Query Keys
 */

import type { PackagingTaskQueryParams } from '../domain/packaging.types';

/**
 * Query Keys
 */
export const packagingKeys = {
  all: ['packaging'] as const,
  tasks: () => [...packagingKeys.all, 'tasks'] as const,
  lists: () => [...packagingKeys.tasks(), 'list'] as const,
  list: (params: PackagingTaskQueryParams) => [...packagingKeys.lists(), params] as const,
  task: (taskId: string) => [...packagingKeys.tasks(), taskId] as const,
  stats: (userId?: string) => [...packagingKeys.all, 'stats', userId] as const,
  logs: (taskId: string) => [...packagingKeys.task(taskId), 'logs'] as const,
  templates: () => [...packagingKeys.all, 'templates'] as const,
  template: (templateId: string) => [...packagingKeys.templates(), templateId] as const,
  presets: () => [...packagingKeys.all, 'presets'] as const,
};

