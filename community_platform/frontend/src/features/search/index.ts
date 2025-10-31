/**
 * 搜索模块 - 主导出
 */

// Domain
export * from './domain';

// API
export * from './api';

// Hooks
export * from './hooks';

// Components - 明确重导出以解决 SearchFilters 名称冲突
export { SearchBar } from './components';
export type { SearchBarProps } from './components';

export { SearchResults } from './components';
export type { SearchResultsProps } from './components';

export { SearchFilters as SearchFiltersComponent } from './components';
export type { SearchFiltersProps } from './components';

export { SearchHistory } from './components';
export type { SearchHistoryProps } from './components';

