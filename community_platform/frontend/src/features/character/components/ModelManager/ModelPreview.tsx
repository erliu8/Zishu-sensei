/**
 * ModelPreview 组件
 * 模型实时预览（支持 Live2D 渲染）
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { LoadingSpinner } from '@/shared/components/common';
import {
  Play,
  Pause,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import type { Model, PhysicsConfig } from '../../domain';
import { ModelType } from '../../types';

export interface ModelPreviewProps {
  /** 模型数据 */
  model: Model;
  /** 物理参数配置 */
  physics?: PhysicsConfig;
  /** 是否启用物理效果 */
  enablePhysics?: boolean;
  /** 是否自动播放动画 */
  autoPlay?: boolean;
  /** 背景色 */
  backgroundColor?: string;
  /** 是否显示网格 */
  showGrid?: boolean;
  /** 是否全屏 */
  fullscreen?: boolean;
  /** 全屏状态变化回调 */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** 自定义类名 */
  className?: string;
}

export const ModelPreview: React.FC<ModelPreviewProps> = ({
  model,
  physics,
  enablePhysics = true,
  autoPlay = true,
  backgroundColor = '#f0f0f0',
  showGrid = false,
  fullscreen = false,
  onFullscreenChange,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 状态
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [scale, setScale] = useState(1.0);
  const [showInfo, setShowInfo] = useState(true);

  // Live2D 实例引用（实际项目中需要初始化 Live2D SDK）
  const live2dModelRef = useRef<any>(null);

  // 初始化 Live2D 模型
  useEffect(() => {
    if (!canvasRef.current) return;

    const initializeLive2D = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // TODO: 实际项目中需要集成 Live2D SDK
        // 这里是模拟实现
        
        if (model.type === ModelType.LIVE2D) {
          // 模拟加载延迟
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // 在实际项目中，这里应该:
          // 1. 初始化 Live2D SDK
          // 2. 加载模型文件 (model.modelUrl)
          // 3. 设置物理参数 (physics)
          // 4. 启动渲染循环

          console.log('Loading Live2D model:', model.modelUrl);
          console.log('Physics config:', physics);

          // 存储模型引用
          live2dModelRef.current = {
            modelUrl: model.modelUrl,
            physics,
            // ... 其他 Live2D 相关属性
          };
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载模型失败');
        setIsLoading(false);
      }
    };

    initializeLive2D();

    // 清理函数
    return () => {
      // 清理 Live2D 资源
      if (live2dModelRef.current) {
        // 释放 Live2D 模型资源
        live2dModelRef.current = null;
      }
    };
  }, [model, physics]);

  // 更新物理参数
  useEffect(() => {
    if (live2dModelRef.current && physics && enablePhysics) {
      // 更新 Live2D 模型的物理参数
      console.log('Updating physics:', physics);
      // live2dModelRef.current.updatePhysics(physics);
    }
  }, [physics, enablePhysics]);

  // 渲染循环
  useEffect(() => {
    if (!canvasRef.current || !live2dModelRef.current) return;
    if (!isPlaying) return;

    let animationFrameId: number;

    const render = () => {
      // 渲染 Live2D 模型
      // const ctx = canvasRef.current?.getContext('2d');
      // if (ctx) {
      //   ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      //   // 绘制模型
      //   live2dModelRef.current.draw(ctx);
      // }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying]);

  // 处理缩放
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  };

  const handleResetView = () => {
    setScale(1.0);
  };

  // 处理播放/暂停
  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // 处理全屏
  const handleToggleFullscreen = () => {
    onFullscreenChange?.(!fullscreen);
  };

  // 获取模型类型显示名称
  const getModelTypeLabel = () => {
    switch (model.type) {
      case ModelType.LIVE2D:
        return 'Live2D';
      case ModelType.VRM:
        return 'VRM';
      case ModelType.SPRITE:
        return 'Sprite';
      case ModelType.AVATAR:
        return 'Avatar';
      default:
        return model.type;
    }
  };

  return (
    <Card className={cn('w-full', fullscreen && 'fixed inset-0 z-50 rounded-none', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{model.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{getModelTypeLabel()}</Badge>
              <span className="text-xs">版本 {model.version}</span>
              {model.fileSize && (
                <span className="text-xs">
                  · {(model.fileSize / 1024 / 1024).toFixed(2)} MB
                </span>
              )}
            </CardDescription>
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowInfo(!showInfo)}
              title={showInfo ? '隐藏信息' : '显示信息'}
            >
              {showInfo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFullscreen}
              title={fullscreen ? '退出全屏' : '全屏'}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative p-0">
        {/* 预览区域 */}
        <div
          ref={containerRef}
          className={cn(
            'relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900',
            fullscreen ? 'h-[calc(100vh-200px)]' : 'h-[600px]'
          )}
          style={{ backgroundColor }}
        >
          {/* 加载状态 */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
              <LoadingSpinner size="lg" text="加载模型中..." />
            </div>
          )}

          {/* 错误状态 */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-8 z-10">
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{
              transform: `scale(${scale})`,
              transition: 'transform 0.2s ease',
            }}
          />

          {/* 网格（可选） */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
              }}
            />
          )}

          {/* 控制栏 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleTogglePlay}
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            <div className="w-px h-6 bg-border" />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>

            <div className="px-2 text-sm font-medium min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border" />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetView}
              title="重置视图"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>

          {/* 信息叠加层 */}
          {showInfo && !isLoading && !error && (
            <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs">
              <h4 className="text-sm font-medium mb-2">模型信息</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <span>类型:</span>
                  <span>{getModelTypeLabel()}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>版本:</span>
                  <span>{model.version}</span>
                </div>
                {model.creator && (
                  <div className="flex justify-between gap-4">
                    <span>作者:</span>
                    <span className="truncate">{model.creator}</span>
                  </div>
                )}
                {enablePhysics && physics && (
                  <>
                    <div className="pt-2 mt-2 border-t">
                      <span className="font-medium">物理参数</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>重力:</span>
                      <span>{physics.gravity.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>风力:</span>
                      <span>{physics.wind.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>弹性:</span>
                      <span>{(physics.elasticity * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>阻尼:</span>
                      <span>{(physics.damping * 100).toFixed(0)}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部说明 */}
        <div className="px-6 py-3 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            💡 提示：拖拽模型可以移动位置，使用鼠标滚轮可以缩放视图
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

ModelPreview.displayName = 'ModelPreview';

