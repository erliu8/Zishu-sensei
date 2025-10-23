# 🎨 动画系统使用指南

Zishu 社区平台的动画系统提供了完整的动画解决方案，包括 CSS 动画、Framer Motion 动画、微交互效果等。

## 📦 包含内容

### 1. CSS 动画 (`animations.css`)

提供基础的 CSS 动画和工具类：

- ✅ 动画变量和缓动函数
- ✅ 关键帧动画（淡入、滑动、缩放、旋转等）
- ✅ 过渡效果工具类
- ✅ 骨架屏动画
- ✅ 微交互效果
- ✅ 响应式优化

### 2. Framer Motion 变体 (`variants.ts`)

预定义的动画变体配置：

- ✅ 淡入淡出变体
- ✅ 缩放变体
- ✅ 滑动变体
- ✅ 列表和网格动画
- ✅ 卡片动画
- ✅ 模态框/对话框动画
- ✅ 页面过渡动画

### 3. 动画工具函数 (`utils.ts`)

实用的动画 Hooks 和工具：

- ✅ 性能检测（减少动画偏好、设备性能）
- ✅ 滚动相关（滚动位置、进度、视口检测）
- ✅ 鼠标追踪
- ✅ 响应式动画
- ✅ 视差效果

### 4. React 组件

#### 页面过渡组件
- `PageTransition` - 页面过渡效果
- `PageAnimationWrapper` - 页面动画包装器
- `RouteTransitionProvider` - 路由过渡提供器

#### 骨架屏组件
- `Skeleton` - 基础骨架屏
- `SkeletonText` - 文本骨架屏
- `SkeletonCard` - 卡片骨架屏
- `SkeletonPost` - 帖子骨架屏
- `SkeletonAdapterCard` - 适配器卡片骨架屏
- `SkeletonCharacterCard` - 角色卡片骨架屏
- 等等...

#### 加载状态组件
- `Spinner` - 旋转加载器
- `DotsLoader` - 点加载器
- `ProgressBar` - 进度条
- `CircularProgress` - 圆形进度
- `LoadingOverlay` - 加载覆盖层
- `FullScreenLoading` - 全屏加载
- 等等...

#### 微交互组件
- `RippleButton` - 涟漪效果按钮
- `HoverLift` - 悬停提升效果
- `MagneticButton` - 磁性按钮
- `TiltCard` - 3D 倾斜卡片
- `AnimatedLikeButton` - 点赞按钮
- `AnimatedHeartButton` - 爱心按钮
- `AnimatedRating` - 星级评分
- 等等...

## 🚀 快速开始

### 1. 引入 CSS 动画

在全局样式文件中引入：

```css
/* app/globals.css */
@import '../src/styles/animations.css';
```

### 2. 使用 CSS 工具类

```tsx
// 淡入动画
<div className="animate-fade-in">内容</div>

// 上滑淡入
<div className="animate-fade-in-up">内容</div>

// 悬停提升
<div className="hover-lift">卡片</div>

// 骨架屏
<div className="skeleton w-full h-20" />
```

### 3. 使用 Framer Motion 变体

```tsx
import { motion } from 'framer-motion';
import { fadeInUpVariants, listContainerVariants } from '@/shared/animations';

// 单个元素动画
<motion.div
  variants={fadeInUpVariants}
  initial="hidden"
  animate="visible"
  exit="exit"
>
  内容
</motion.div>

// 列表交错动画
<motion.ul
  variants={listContainerVariants}
  initial="hidden"
  animate="visible"
>
  {items.map((item) => (
    <motion.li key={item.id} variants={listItemVariants}>
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

### 4. 使用组件

```tsx
import {
  PageTransition,
  Skeleton,
  Spinner,
  AnimatedLikeButton,
} from '@/shared/components/common';

// 页面过渡
<PageTransition type="fade">
  <YourPage />
</PageTransition>

// 骨架屏
{loading ? <Skeleton height={200} /> : <Content />}

// 加载器
<Spinner size="lg" text="加载中..." />

// 点赞按钮
<AnimatedLikeButton
  liked={isLiked}
  onToggle={handleToggle}
  count={likeCount}
/>
```

### 5. 使用动画 Hooks

```tsx
import {
  useReducedMotion,
  useScrollAnimation,
  useInViewport,
} from '@/shared/animations';

function MyComponent() {
  const ref = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const isInView = useInViewport(ref, { threshold: 0.5 });
  
  return (
    <motion.div
      ref={ref}
      animate={isInView ? 'visible' : 'hidden'}
      variants={!prefersReducedMotion ? fadeInUpVariants : undefined}
    >
      内容
    </motion.div>
  );
}
```

## 📖 详细示例

### 页面过渡

```tsx
// app/layout.tsx
import { RouteTransitionProvider } from '@/shared/components/common';

export default function RootLayout({ children }) {
  return (
    <RouteTransitionProvider>
      {children}
    </RouteTransitionProvider>
  );
}

// app/page.tsx
import { PageTransition } from '@/shared/components/common';

export default function Page() {
  return (
    <PageTransition type="fade">
      <div>页面内容</div>
    </PageTransition>
  );
}
```

### 列表动画

```tsx
import { motion } from 'framer-motion';
import { listContainerVariants, listItemVariants } from '@/shared/animations';

function PostList({ posts }) {
  return (
    <motion.div
      variants={listContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {posts.map((post) => (
        <motion.div
          key={post.id}
          variants={listItemVariants}
          className="bg-card p-4 rounded-lg"
        >
          <h3>{post.title}</h3>
          <p>{post.content}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### 加载状态

```tsx
import { LoadingWrapper, SkeletonPost, Spinner } from '@/shared/components/common';

function PostDetail({ postId }) {
  const { data: post, isLoading } = usePost(postId);
  
  return (
    <LoadingWrapper
      loading={isLoading}
      skeleton={<SkeletonPost />}
    >
      <PostContent post={post} />
    </LoadingWrapper>
  );
}

// 或使用加载覆盖层
function MyComponent() {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div className="relative">
      <LoadingOverlay visible={isLoading} text="处理中..." />
      <Content />
    </div>
  );
}
```

### 微交互

```tsx
import {
  HoverLift,
  RippleButton,
  AnimatedLikeButton,
  AnimatedRating,
} from '@/shared/components/common';

function InteractiveCard() {
  const [liked, setLiked] = useState(false);
  const [rating, setRating] = useState(0);
  
  return (
    <HoverLift>
      <div className="bg-card p-6 rounded-lg">
        <h3>标题</h3>
        <p>内容</p>
        
        <div className="flex items-center gap-4 mt-4">
          <AnimatedLikeButton
            liked={liked}
            onToggle={() => setLiked(!liked)}
            count={42}
          />
          
          <AnimatedRating
            rating={rating}
            onChange={setRating}
          />
        </div>
        
        <RippleButton className="mt-4 px-4 py-2 bg-primary text-white rounded">
          点击我
        </RippleButton>
      </div>
    </HoverLift>
  );
}
```

### 滚动触发动画

```tsx
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useInViewport, fadeInUpVariants } from '@/shared/animations';

function ScrollAnimatedSection() {
  const ref = useRef(null);
  const isInView = useInViewport(ref, { threshold: 0.3 });
  
  return (
    <motion.section
      ref={ref}
      variants={fadeInUpVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      <h2>当滚动到此处时触发动画</h2>
      <p>内容...</p>
    </motion.section>
  );
}
```

### 3D 倾斜卡片

```tsx
import { TiltCard } from '@/shared/components/common';

function FeatureCard() {
  return (
    <TiltCard tiltAngle={15}>
      <div className="bg-gradient-to-br from-primary to-secondary p-8 rounded-xl">
        <h3 className="text-2xl font-bold text-white">特性</h3>
        <p className="text-white/80">描述...</p>
      </div>
    </TiltCard>
  );
}
```

### 进度指示

```tsx
import { ProgressBar, CircularProgress, StepLoading } from '@/shared/components/common';

function UploadProgress() {
  const [progress, setProgress] = useState(0);
  
  return (
    <div className="space-y-6">
      {/* 线性进度条 */}
      <ProgressBar value={progress} showPercentage />
      
      {/* 圆形进度 */}
      <CircularProgress value={progress} showPercentage />
      
      {/* 分步进度 */}
      <StepLoading
        currentStep={2}
        totalSteps={5}
        labels={['上传', '处理', '验证', '完成', '确认']}
      />
    </div>
  );
}
```

## 🎯 最佳实践

### 1. 性能优化

```tsx
// ✅ 使用 useReducedMotion 尊重用户偏好
import { useReducedMotion } from '@/shared/animations';

function MyComponent() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <motion.div
      animate={prefersReducedMotion ? {} : { y: [0, -10, 0] }}
    >
      内容
    </motion.div>
  );
}

// ✅ 使用 LazyMotion 减少包体积
import { AnimationProvider } from '@/shared/components/providers/AnimationProvider';

<AnimationProvider>
  <App />
</AnimationProvider>
```

### 2. 响应式动画

```tsx
import { useResponsiveAnimation } from '@/shared/animations';

function ResponsiveCard() {
  const { duration, distance } = useResponsiveAnimation();
  
  return (
    <motion.div
      whileHover={{ y: -distance }}
      transition={{ duration }}
    >
      内容
    </motion.div>
  );
}
```

### 3. 条件动画

```tsx
// ✅ 根据状态应用不同动画
const variants = isSuccess ? successVariants : errorVariants;

<motion.div variants={variants} animate="visible">
  {message}
</motion.div>
```

### 4. 交错动画

```tsx
// ✅ 列表项交错出现
<motion.div
  variants={listContainerVariants}
  initial="hidden"
  animate="visible"
>
  {items.map((item, index) => (
    <motion.div
      key={item.id}
      variants={listItemVariants}
      custom={index}  // 可用于自定义延迟
    >
      {item.name}
    </motion.div>
  ))}
</motion.div>
```

## ⚙️ 配置

### CSS 变量

在 `animations.css` 中定义的 CSS 变量可以在你的主题中覆盖：

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  /* ... */
}
```

### Framer Motion 配置

使用 `MotionConfig` 全局配置：

```tsx
import { MotionConfig } from 'framer-motion';

<MotionConfig
  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
>
  <App />
</MotionConfig>
```

## 🎨 动画预设

系统提供了常用的动画预设：

```tsx
import { animationPresets } from '@/shared/animations';

<motion.div {...animationPresets.quickFade}>内容</motion.div>
<motion.div {...animationPresets.slideUp}>内容</motion.div>
<motion.div {...animationPresets.scale}>内容</motion.div>
<motion.div {...animationPresets.bounce}>内容</motion.div>
```

## 📱 移动端优化

系统自动处理移动端优化：

- 缩短动画时长
- 减少动画复杂度
- 响应 `prefers-reduced-motion`
- 根据设备性能调整

## 🐛 调试

使用调试工具：

```tsx
import { logAnimationEvent, measureAnimationPerformance } from '@/shared/animations';

// 记录动画事件（仅开发环境）
logAnimationEvent('Card entered viewport', { cardId: 123 });

// 测量动画性能
measureAnimationPerformance('List animation', () => {
  // 执行动画
});
```

## 📚 参考资源

- [Framer Motion 文档](https://www.framer.com/motion/)
- [CSS 动画指南](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations)
- [Web 动画性能](https://web.dev/animations/)

## 🤝 贡献

如需添加新的动画效果，请遵循以下规范：

1. CSS 动画添加到 `animations.css`
2. Framer Motion 变体添加到 `variants.ts`
3. 工具函数添加到 `utils.ts`
4. 组件添加到对应的组件文件
5. 更新此文档

---

**维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23

