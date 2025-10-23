/**
 * 适配器市场组件统一导出
 * @module features/adapter/components/marketplace
 */

// 主组件
export { AdapterMarket } from './AdapterMarket';
export type { AdapterMarketProps } from './AdapterMarket';

// 适配器卡片和列表
export { AdapterCard } from './AdapterCard';
export type { AdapterCardProps } from './AdapterCard';

export { AdapterList, AdapterListSkeleton } from './AdapterList';
export type { AdapterListProps } from './AdapterList';

// 徽章组件
export {
  AdapterTypeBadge,
  CompatibilityBadge,
  CapabilityBadge,
  FeaturedBadge,
  NewBadge,
} from './AdapterBadge';
export type {
  AdapterTypeBadgeProps,
  CompatibilityBadgeProps,
  CapabilityBadgeProps,
  FeaturedBadgeProps,
  NewBadgeProps,
} from './AdapterBadge';

// 筛选和排序
export { CategoryFilter, CategoryBreadcrumb } from './CategoryFilter';
export type { CategoryFilterProps, CategoryBreadcrumbProps } from './CategoryFilter';

export { MarketSearchBar } from './MarketSearchBar';
export type { MarketSearchBarProps, SearchSuggestion } from './MarketSearchBar';

export { SortOptions, SimpleSortButton } from './SortOptions';
export type { 
  SortOptionsProps, 
  SimpleSortButtonProps,
  SortField,
  SortOrder,
  SortOption,
} from './SortOptions';

// 推荐适配器
export { FeaturedAdapters, HorizontalFeaturedAdapters } from './FeaturedAdapters';
export type { 
  FeaturedAdaptersProps,
  HorizontalFeaturedAdaptersProps,
} from './FeaturedAdapters';

