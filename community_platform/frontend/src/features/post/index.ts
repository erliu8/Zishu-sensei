/**
 * Post Feature 主导出文件
 */

// Domain
export * from './domain';

// Components - 明确重导出以解决 PostStats 名称冲突
export { PostCard } from './components';
export type { PostCardProps } from './components';

export { PostList } from './components';
export type { PostListProps } from './components';

export { PostDetail } from './components';
export type { PostDetailProps } from './components';

export { PostEditor } from './components';
export type { PostEditorProps } from './components';

export { PostActions } from './components';
export type { PostActionsProps } from './components';

export { PostStats as PostStatsComponent } from './components';
export type { PostStatsProps } from './components';
