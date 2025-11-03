/**
 * 动画性能管理器
 * 
 * 提供高性能动画管理，包括帧率控制、GPU 加速和批量调度
 */

import type {
  AnimationConfig,
  AnimationInstance,
  AnimationStats,
  EasingFunction,
} from '../types/rendering';
import { applyEasing, calculateProgress } from '../types/rendering';

// ============================================================================
// 动画管理器类
// ============================================================================

class AnimationManager {
  private animations: Map<string, AnimationInstance> = new Map();
  private animationFrameId: number | null = null;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private fpsHistory: number[] = [];
  private droppedFrames: number = 0;
  private isRunning: boolean = false;

  /**
   * 创建动画
   */
  createAnimation(config: {
    name: string;
    duration: number;
    easing?: EasingFunction;
    onUpdate?: (progress: number) => void;
    onComplete?: () => void;
    priority?: 'low' | 'normal' | 'high';
    useGPU?: boolean;
  }): AnimationInstance {
    const id = `animation-${Date.now()}-${Math.random()}`;
    const startTime = performance.now();

    const animationConfig: AnimationConfig = {
      duration: config.duration,
      easing: config.easing || 'easeInOut',
      useGPU: config.useGPU !== false,
      targetFPS: 60,
      useRAF: true,
      priority: config.priority || 'normal',
    };

    let progress = 0;
    let isRunning = true;
    let isPaused = false;
    let pausedTime = 0;

    const update = (currentTime: number) => {
      if (!isRunning || isPaused) return;

      progress = calculateProgress(startTime + pausedTime, config.duration, currentTime);

      if (progress >= 1) {
        progress = 1;
        isRunning = false;
        this.animations.delete(id);
      }

      const easedProgress = applyEasing(progress, animationConfig.easing);
      
      if (config.onUpdate) {
        config.onUpdate(easedProgress);
      }

      if (progress >= 1 && config.onComplete) {
        config.onComplete();
      }
    };

    const instance: AnimationInstance = {
      id,
      name: config.name,
      startTime,
      progress: 0,
      isRunning: true,
      config: animationConfig,
      cancel: () => {
        isRunning = false;
        this.animations.delete(id);
      },
      pause: () => {
        if (!isPaused) {
          isPaused = true;
          pausedTime += performance.now() - startTime;
        }
      },
      resume: () => {
        if (isPaused) {
          isPaused = false;
        }
      },
    };

    // 添加更新函数
    (instance as any)._update = update;

    this.animations.set(id, instance);
    this.startLoop();

    return instance;
  }

  /**
   * 启动动画循环
   */
  private startLoop(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;

      // 计算 FPS
      const deltaTime = currentTime - this.lastFrameTime;
      const fps = deltaTime > 0 ? 1000 / deltaTime : 0;
      
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }

      // 检测掉帧
      if (deltaTime > 32) { // 低于 30 FPS
        this.droppedFrames++;
      }

      // 更新所有动画
      this.animations.forEach((animation) => {
        if (animation.isRunning) {
          (animation as any)._update(currentTime);
        }
      });

      this.frameCount++;
      this.lastFrameTime = currentTime;

      // 如果还有动画，继续循环
      if (this.animations.size > 0) {
        this.animationFrameId = requestAnimationFrame(loop);
      } else {
        this.stopLoop();
      }
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * 停止动画循环
   */
  private stopLoop(): void {
    this.isRunning = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 取消动画
   */
  cancelAnimation(id: string): void {
    const animation = this.animations.get(id);
    if (animation) {
      animation.cancel();
    }
  }

  /**
   * 取消所有动画
   */
  cancelAllAnimations(): void {
    this.animations.forEach((animation) => {
      animation.cancel();
    });
    this.animations.clear();
    this.stopLoop();
  }

  /**
   * 暂停动画
   */
  pauseAnimation(id: string): void {
    const animation = this.animations.get(id);
    if (animation) {
      animation.pause();
    }
  }

  /**
   * 恢复动画
   */
  resumeAnimation(id: string): void {
    const animation = this.animations.get(id);
    if (animation) {
      animation.resume();
    }
  }

  /**
   * 获取动画统计
   */
  getStats(): AnimationStats {
    const avgFPS = this.fpsHistory.length > 0
      ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
      : 0;

    const currentFPS = this.fpsHistory[this.fpsHistory.length - 1] || 0;

    return {
      activeAnimations: this.animations.size,
      averageFPS: Math.round(avgFPS),
      currentFPS: Math.round(currentFPS),
      droppedFrames: this.droppedFrames,
      cpuTime: 0, // 需要通过 Performance API 测量
      gpuTime: undefined,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.frameCount = 0;
    this.fpsHistory = [];
    this.droppedFrames = 0;
  }

  /**
   * 获取所有动画
   */
  getAnimations(): AnimationInstance[] {
    return Array.from(this.animations.values());
  }

  /**
   * 获取动画
   */
  getAnimation(id: string): AnimationInstance | undefined {
    return this.animations.get(id);
  }
}

// 导出单例
export const animationManager = new AnimationManager();

// ============================================================================
// 动画辅助函数
// ============================================================================

/**
 * 创建动画
 */
export function animate(config: {
  from: number;
  to: number;
  duration: number;
  easing?: EasingFunction;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
  priority?: 'low' | 'normal' | 'high';
}): AnimationInstance {
  const { from, to, onUpdate, ...rest } = config;
  const range = to - from;

  return animationManager.createAnimation({
    ...rest,
    name: 'value-animation',
    onUpdate: (progress) => {
      const value = from + range * progress;
      onUpdate(value);
    },
  });
}

/**
 * 创建序列动画
 */
export async function animateSequence(animations: Array<{
  from: number;
  to: number;
  duration: number;
  easing?: EasingFunction;
  onUpdate: (value: number) => void;
}>): Promise<void> {
  for (const config of animations) {
    await new Promise<void>((resolve) => {
      animate({
        ...config,
        onComplete: () => resolve(),
      });
    });
  }
}

/**
 * 创建并行动画
 */
export function animateParallel(animations: Array<{
  from: number;
  to: number;
  duration: number;
  easing?: EasingFunction;
  onUpdate: (value: number) => void;
}>): Promise<void> {
  return Promise.all(
    animations.map(
      (config) =>
        new Promise<void>((resolve) => {
          animate({
            ...config,
            onComplete: () => resolve(),
          });
        })
    )
  ).then(() => {});
}

/**
 * 创建弹簧动画
 */
export function spring(config: {
  from: number;
  to: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}): AnimationInstance {
  const {
    from,
    to,
    stiffness = 180,
    damping = 12,
    mass = 1,
    onUpdate,
    onComplete,
  } = config;

  let position = from;
  let velocity = 0;
  let startTime = performance.now();

  return animationManager.createAnimation({
    name: 'spring-animation',
    duration: 2000, // 最大持续时间
    onUpdate: (progress) => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - startTime) / 1000;
      startTime = currentTime;

      // 弹簧物理模拟
      const spring_force = -stiffness * (position - to);
      const damping_force = -damping * velocity;
      const acceleration = (spring_force + damping_force) / mass;

      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;

      onUpdate(position);

      // 检查是否停止
      if (
        Math.abs(velocity) < 0.01 &&
        Math.abs(position - to) < 0.01
      ) {
        onUpdate(to);
        if (onComplete) onComplete();
        return 1; // 完成动画
      }

      return progress;
    },
  });
}

/**
 * 淡入动画
 */
export function fadeIn(
  element: HTMLElement,
  duration: number = 300
): AnimationInstance {
  element.style.opacity = '0';
  element.style.display = '';

  return animate({
    from: 0,
    to: 1,
    duration,
    easing: 'easeOut',
    onUpdate: (value) => {
      element.style.opacity = value.toString();
    },
  });
}

/**
 * 淡出动画
 */
export function fadeOut(
  element: HTMLElement,
  duration: number = 300
): AnimationInstance {
  return animate({
    from: 1,
    to: 0,
    duration,
    easing: 'easeIn',
    onUpdate: (value) => {
      element.style.opacity = value.toString();
    },
    onComplete: () => {
      element.style.display = 'none';
    },
  });
}

/**
 * 滑入动画
 */
export function slideIn(
  element: HTMLElement,
  direction: 'left' | 'right' | 'top' | 'bottom' = 'left',
  duration: number = 300
): AnimationInstance {
  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
  const sign = direction === 'left' || direction === 'top' ? -1 : 1;

  return animate({
    from: 100 * sign,
    to: 0,
    duration,
    easing: 'easeOut',
    onUpdate: (value) => {
      element.style.transform = `translate${axis}(${value}%)`;
    },
  });
}

/**
 * 滑出动画
 */
export function slideOut(
  element: HTMLElement,
  direction: 'left' | 'right' | 'top' | 'bottom' = 'left',
  duration: number = 300
): AnimationInstance {
  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
  const sign = direction === 'left' || direction === 'top' ? -1 : 1;

  return animate({
    from: 0,
    to: 100 * sign,
    duration,
    easing: 'easeIn',
    onUpdate: (value) => {
      element.style.transform = `translate${axis}(${value}%)`;
    },
  });
}

/**
 * 缩放动画
 */
export function scale(
  element: HTMLElement,
  from: number,
  to: number,
  duration: number = 300
): AnimationInstance {
  return animate({
    from,
    to,
    duration,
    easing: 'easeInOut',
    onUpdate: (value) => {
      element.style.transform = `scale(${value})`;
    },
  });
}

/**
 * 旋转动画
 */
export function rotate(
  element: HTMLElement,
  from: number,
  to: number,
  duration: number = 300
): AnimationInstance {
  return animate({
    from,
    to,
    duration,
    easing: 'linear',
    onUpdate: (value) => {
      element.style.transform = `rotate(${value}deg)`;
    },
  });
}

/**
 * 抖动动画
 */
export function shake(
  element: HTMLElement,
  intensity: number = 10,
  duration: number = 500
): AnimationInstance {
  let originalTransform = element.style.transform;

  return animationManager.createAnimation({
    name: 'shake-animation',
    duration,
    onUpdate: (progress) => {
      const shake = Math.sin(progress * Math.PI * 8) * intensity * (1 - progress);
      element.style.transform = `${originalTransform} translateX(${shake}px)`;
    },
    onComplete: () => {
      element.style.transform = originalTransform;
    },
  });
}

/**
 * 脉冲动画
 */
export function pulse(
  element: HTMLElement,
  scale: number = 1.1,
  duration: number = 300
): AnimationInstance {
  return animationManager.createAnimation({
    name: 'pulse-animation',
    duration,
    onUpdate: (progress) => {
      const value = 1 + (scale - 1) * Math.sin(progress * Math.PI);
      element.style.transform = `scale(${value})`;
    },
    onComplete: () => {
      element.style.transform = 'scale(1)';
    },
  });
}

// 导出类型
export type { AnimationManager };

