/**
 * 通用组件统一导出
 */

// 页面过渡
export {
  PageTransition,
  PageAnimationWrapper,
  RouteTransitionProvider,
} from './PageTransition';

// 骨架屏
export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonList,
  SkeletonTable,
  SkeletonPost,
  SkeletonAdapterCard,
  SkeletonCharacterCard,
  SkeletonComment,
  SkeletonSearchResult,
  SkeletonGrid,
  SkeletonForm,
  SkeletonPage,
} from './Skeleton';

// 加载状态
export {
  Spinner,
  DotsLoader,
  PulseLoader,
  ProgressBar,
  CircularProgress,
  LoadingOverlay,
  FullScreenLoading,
  StepLoading,
  SkeletonPulse,
  LoadingSkeleton,
  WaveLoader,
} from './LoadingAnimations';

// 微交互
export {
  RippleButton,
  HoverLift,
  MagneticButton,
  TiltCard,
  AnimatedLikeButton,
  AnimatedBookmarkButton,
  AnimatedHeartButton,
  AnimatedRating,
  CountUp,
  HoverReveal,
  DraggableItem,
  SwipeToDelete,
  Parallax,
  FloatingBubble,
} from './MicroInteractions';

// 头像组件
export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

// 评分组件
export { RatingStars } from './RatingStars';
export type { RatingStarsProps } from './RatingStars';

// 图片上传
export { ImageUploader } from './ImageUploader';
export type { ImageUploaderProps } from './ImageUploader';

export { ImageCropper } from './ImageCropper';
export type { ImageCropperProps, CropArea } from './ImageCropper';

export { ImageBatchUploader } from './ImageBatchUploader';
export type { ImageBatchUploaderProps } from './ImageBatchUploader';

export { AvatarUploader } from './AvatarUploader';
export type { AvatarUploaderProps } from './AvatarUploader';

// Markdown 编辑器
export { MarkdownEditor } from './MarkdownEditor';
export type { MarkdownEditorProps } from './MarkdownEditor';

export { MarkdownViewer } from './MarkdownViewer';
export type { MarkdownViewerProps } from './MarkdownViewer';

export { MarkdownToolbar } from './MarkdownToolbar';
export type { MarkdownToolbarProps, MarkdownAction } from './MarkdownToolbar';

// 滚动动画
export {
  FadeInWhenVisible,
  ScrollProgress,
  ScrollParallax,
  ScrollScale,
  ScrollRotate,
  ScrollOpacity,
  StaggerScroll,
  ScrollCounter,
  StickyScroll,
  ScrollReveal,
  ScrollBackgroundParallax,
  ScrollTextReveal,
  ScrollToTop,
} from './ScrollAnimations';

// 面包屑导航
export { Breadcrumb } from './Breadcrumb';
export type { BreadcrumbProps, BreadcrumbItem } from './Breadcrumb';

// 空状态组件
export { EmptyState } from './EmptyState';

// 加载状态组件  
export { LoadingSpinner } from './LoadingSpinner';

// 分页组件
export { Pagination } from './Pagination';

// 图片画廊组件
export { ImageGallery } from './ImageGallery';
export type { ImageGalleryProps } from './ImageGallery';

// 折叠组件
export { Collapse, Collapsible } from './Collapse';
export type { CollapseProps, CollapsibleProps } from './Collapse';

// 本地路径输入
export { LocalPathInput } from './LocalPathInput';
export type { LocalPathInputProps } from './LocalPathInput';

// 部署位置选择
export { DeploymentLocationSelect } from './DeploymentLocationSelect';
export type { DeploymentLocationSelectProps } from './DeploymentLocationSelect';
