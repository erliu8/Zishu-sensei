/**
 * 动画系统演示页面
 * 
 * 展示所有可用的动画效果和组件
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  fadeInUpVariants,
  listContainerVariants,
  listItemVariants,
  cardVariants,
} from '@/shared/animations';
import {
  Skeleton,
  SkeletonCard,
  SkeletonPost,
  Spinner,
  DotsLoader,
  PulseLoader,
  ProgressBar,
  CircularProgress,
  RippleButton,
  HoverLift,
  TiltCard,
  AnimatedLikeButton,
  AnimatedHeartButton,
  AnimatedRating,
  FloatingBubble,
  StepLoading,
} from '@/shared/components/common';

export default function AnimationsDemo() {
  const [liked, setLiked] = useState(false);
  const [hearted, setHearted] = useState(false);
  const [rating, setRating] = useState(0);
  const [progress, setProgress] = useState(65);
  const [currentStep, setCurrentStep] = useState(2);

  return (
    <div className="container mx-auto py-12 px-4 max-w-7xl">
      {/* 页面标题 */}
      <motion.div
        variants={fadeInUpVariants}
        initial="hidden"
        animate="visible"
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold mb-4">🎨 动画系统演示</h1>
        <p className="text-muted-foreground text-lg">
          探索 Zishu 社区平台的所有动画效果和交互组件
        </p>
      </motion.div>

      <div className="space-y-16">
        {/* CSS 动画类 */}
        <Section title="CSS 动画类">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DemoCard title="淡入" className="animate-fade-in">
              淡入动画
            </DemoCard>
            <DemoCard title="上滑淡入" className="animate-fade-in-up">
              上滑淡入动画
            </DemoCard>
            <DemoCard title="缩放" className="animate-scale-in">
              缩放动画
            </DemoCard>
            <DemoCard title="弹跳" className="animate-bounce-in">
              弹跳动画
            </DemoCard>
            <DemoCard title="悬停提升" className="hover-lift cursor-pointer">
              悬停查看效果
            </DemoCard>
            <DemoCard title="悬停缩放" className="hover-scale cursor-pointer">
              悬停查看效果
            </DemoCard>
          </div>
        </Section>

        {/* Framer Motion 列表动画 */}
        <Section title="列表交错动画">
          <motion.div
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {['项目 1', '项目 2', '项目 3', '项目 4', '项目 5'].map(
              (item, index) => (
                <motion.div
                  key={index}
                  variants={listItemVariants}
                  className="bg-card p-4 rounded-lg border"
                >
                  {item}
                </motion.div>
              )
            )}
          </motion.div>
        </Section>

        {/* 卡片动画 */}
        <Section title="卡片动画">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                whileTap="tap"
                className="bg-card p-6 rounded-lg border cursor-pointer"
              >
                <h3 className="font-semibold mb-2">卡片 {i}</h3>
                <p className="text-sm text-muted-foreground">
                  悬停和点击查看动画效果
                </p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* 骨架屏 */}
        <Section title="骨架屏组件">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-3">基础骨架屏</h4>
              <Skeleton height={100} className="mb-3" />
              <Skeleton height={20} width="80%" className="mb-2" />
              <Skeleton height={20} width="60%" />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-3">卡片骨架屏</h4>
              <SkeletonCard />
            </div>
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3">帖子骨架屏</h4>
            <SkeletonPost />
          </div>
        </Section>

        {/* 加载器 */}
        <Section title="加载指示器">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center gap-3">
              <h4 className="text-sm font-medium">旋转加载器</h4>
              <Spinner size="lg" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <h4 className="text-sm font-medium">点加载器</h4>
              <DotsLoader size={32} />
            </div>
            <div className="flex flex-col items-center gap-3">
              <h4 className="text-sm font-medium">脉冲加载器</h4>
              <PulseLoader size="lg" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <h4 className="text-sm font-medium">浮动气泡</h4>
              <FloatingBubble>
                <div className="w-16 h-16 bg-primary rounded-full" />
              </FloatingBubble>
            </div>
          </div>
        </Section>

        {/* 进度指示器 */}
        <Section title="进度指示器">
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">线性进度条</h4>
                <button
                  onClick={() => setProgress((p) => (p + 10) % 100)}
                  className="text-sm text-primary hover:underline"
                >
                  增加进度
                </button>
              </div>
              <ProgressBar value={progress} showPercentage />
            </div>

            <div className="flex items-center gap-8">
              <div>
                <h4 className="text-sm font-medium mb-3">圆形进度</h4>
                <CircularProgress value={progress} showPercentage size={80} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium mb-3">不确定进度</h4>
                <ProgressBar indeterminate />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium">分步进度</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                    className="px-3 py-1 text-sm bg-secondary rounded"
                    disabled={currentStep === 0}
                  >
                    上一步
                  </button>
                  <button
                    onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
                    className="px-3 py-1 text-sm bg-secondary rounded"
                    disabled={currentStep === 4}
                  >
                    下一步
                  </button>
                </div>
              </div>
              <StepLoading
                currentStep={currentStep}
                steps={['上传', '处理', '验证', '完成', '确认']}
              />
            </div>
          </div>
        </Section>

        {/* 微交互 */}
        <Section title="微交互组件">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-3">涟漪按钮</h4>
                <RippleButton className="px-6 py-3 bg-primary text-primary-foreground rounded-lg">
                  点击我看涟漪效果
                </RippleButton>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3">悬停提升</h4>
                <HoverLift liftHeight={12}>
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-xl">
                    悬停在我上面
                  </div>
                </HoverLift>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3">3D 倾斜卡片</h4>
                <TiltCard tiltAngle={15}>
                  <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white p-8 rounded-xl">
                    <h3 className="text-xl font-bold mb-2">倾斜我</h3>
                    <p className="text-white/80">移动鼠标查看 3D 效果</p>
                  </div>
                </TiltCard>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-3">动画按钮</h4>
                <div className="flex flex-wrap gap-4">
                  <AnimatedLikeButton
                    liked={liked}
                    onToggle={() => setLiked(!liked)}
                    count={42}
                    size="lg"
                  />
                  <AnimatedHeartButton
                    liked={hearted}
                    onToggle={() => setHearted(!hearted)}
                    count={128}
                    size="lg"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3">星级评分</h4>
                <AnimatedRating
                  rating={rating}
                  onChange={setRating}
                  size="lg"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  当前评分: {rating}
                </p>
              </div>

              <div className="bg-card p-6 rounded-lg border">
                <h4 className="text-sm font-medium mb-3">组合示例</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  这是一个包含多种微交互的卡片
                </p>
                <div className="flex items-center gap-4">
                  <AnimatedLikeButton
                    liked={liked}
                    onToggle={() => setLiked(!liked)}
                  />
                  <AnimatedHeartButton
                    liked={hearted}
                    onToggle={() => setHearted(!hearted)}
                  />
                  <AnimatedRating rating={rating} onChange={setRating} />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* 响应式提示 */}
        <Section title="响应式优化">
          <div className="bg-muted p-6 rounded-lg">
            <h4 className="font-medium mb-2">🎯 自动优化</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✅ 自动检测 <code>prefers-reduced-motion</code> 用户偏好</li>
              <li>✅ 移动端缩短动画时长</li>
              <li>✅ 根据设备性能调整动画复杂度</li>
              <li>✅ 使用 GPU 加速提升性能</li>
              <li>✅ 懒加载 Framer Motion 减少包体积</li>
            </ul>
          </div>
        </Section>
      </div>
    </div>
  );
}

// 辅助组件
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={fadeInUpVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      className="space-y-4"
    >
      <h2 className="text-2xl font-bold border-b pb-2">{title}</h2>
      {children}
    </motion.section>
  );
}

function DemoCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card p-6 rounded-lg border text-center ${className || ''}`}
    >
      <h3 className="font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

