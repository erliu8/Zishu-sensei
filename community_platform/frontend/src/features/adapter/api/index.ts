/**
 * 适配器 API 模块导出
 * @module features/adapter/api
 */

// 导出 API 客户端
export { AdapterApiClient, adapterApiClient } from './AdapterApiClient';
export { AdapterVersionApiClient, adapterVersionApiClient } from './AdapterVersionApiClient';
export { AdapterCategoryApiClient, adapterCategoryApiClient } from './AdapterCategoryApiClient';
export { AdapterRatingApiClient, adapterRatingApiClient } from './AdapterRatingApiClient';
export { AdapterDependencyApiClient, adapterDependencyApiClient } from './AdapterDependencyApiClient';

// 导出 API 相关类型
export type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from './AdapterCategoryApiClient';

export type {
  RatingQueryParams,
  RatingListResponse,
} from './AdapterRatingApiClient';

export type {
  DependencyTreeNode,
  DependencyCheckResult,
} from './AdapterDependencyApiClient';

