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
