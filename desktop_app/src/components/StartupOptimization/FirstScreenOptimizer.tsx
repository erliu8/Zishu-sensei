/**
 * 首屏渲染优化组件
 * 负责优化首屏加载性能，包括关键资源预加载、渲染优化等
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { resourcePreloader, PreloadResource, smartPreloadResources } from '../../utils/resourcePreloader';
import { useStartupOptimization } from '../../hooks/useStartupOptimization';
import { StartupPhase } from '../../types/startup';
import './FirstScreenOptimizer.css';

export interface FirstScreenOptimizerProps {
  children: React.ReactNode;
  criticalResources?: PreloadResource[];
  enableImageOptimization?: boolean;
  enableCSSOptimization?: boolean;
  onOptimizationComplete?: () => void;
  onProgress?: (stage: string, progress: number) => void;
}

interface OptimizationStage {
  name: string;
  description: string;
  weight: number;
  completed: boolean;
}

/**
 * 首屏优化器组件
 */
export const FirstScreenOptimizer: React.FC<FirstScreenOptimizerProps> = ({
  children,
  criticalResources = [],
  enableImageOptimization = true,
  enableCSSOptimization = true,
  onOptimizationComplete,
  onProgress,
}) => {
  const [isOptimizing, setIsOptimizing] = useState(true);
  const [currentStage, setCurrentStage] = useState('');
  const [overallProgress, setOverallProgress] = useState(0);
  const [stages, setStages] = useState<OptimizationStage[]>([]);
  const [isReady, setIsReady] = useState(false);
  
  const { progress } = useStartupOptimization();
  const optimizationRef = useRef<boolean>(false);

  // 定义优化阶段
  const initializeStages = useCallback((): OptimizationStage[] => {
    const allStages: OptimizationStage[] = [
      {
        name: 'resource-preload',
        description: '预加载关键资源',
        weight: 30,
        completed: false,
      },
      {
        name: 'critical-css',
        description: '优化关键样式',
        weight: 20,
        completed: false,
      },
      {
        name: 'image-optimization',
        description: '图片懒加载优化',
        weight: 15,
        completed: false,
      },
      {
        name: 'font-loading',
        description: '字体加载优化',
        weight: 15,
        completed: false,
      },
      {
        name: 'dom-optimization',
        description: 'DOM 结构优化',
        weight: 10,
        completed: false,
      },
      {
        name: 'render-optimization',
        description: '渲染性能优化',
        weight: 10,
        completed: false,
      },
    ];

    return allStages.filter(stage => {
      switch (stage.name) {
        case 'image-optimization':
          return enableImageOptimization;
        case 'critical-css':
          return enableCSSOptimization;
        default:
          return true;
      }
    });
  }, [enableImageOptimization, enableCSSOptimization]);

  // 更新进度
  const updateProgress = useCallback((stageName: string, stageProgress: number = 100) => {
    setStages(prevStages => {
      const updatedStages = prevStages.map(stage => {
        if (stage.name === stageName) {
          return { ...stage, completed: stageProgress >= 100 };
        }
        return stage;
      });

      // 计算总体进度
      const totalWeight = updatedStages.reduce((sum, stage) => sum + stage.weight, 0);
      const completedWeight = updatedStages.reduce((sum, stage) => {
        if (stage.completed) return sum + stage.weight;
        if (stage.name === stageName) return sum + (stage.weight * stageProgress / 100);
        return sum;
      }, 0);

      const progress = Math.round((completedWeight / totalWeight) * 100);
      setOverallProgress(progress);
      onProgress?.(stageName, progress);

      return updatedStages;
    });
  }, [onProgress]);

  // 预加载关键资源
  const preloadCriticalResources = useCallback(async () => {
    setCurrentStage('预加载关键资源');
    
    try {
      if (criticalResources.length > 0) {
        await smartPreloadResources(criticalResources, {
          onProgress: (loaded, total) => {
            const progress = Math.round((loaded / total) * 100);
            updateProgress('resource-preload', progress);
          },
        });
      } else {
        updateProgress('resource-preload', 100);
      }
    } catch (error) {
      console.error('Failed to preload critical resources:', error);
      updateProgress('resource-preload', 100); // 即使失败也继续
    }
  }, [criticalResources, updateProgress]);

  // 优化关键 CSS
  const optimizeCriticalCSS = useCallback(async () => {
    if (!enableCSSOptimization) return;
    
    setCurrentStage('优化关键样式');
    
    try {
      // 移除非关键 CSS 的阻塞
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
      stylesheets.forEach((stylesheet, index) => {
        const link = stylesheet as HTMLLinkElement;
        if (!link.dataset.critical) {
          // 异步加载非关键样式
          setTimeout(() => {
            link.media = 'all';
          }, 100 * index);
        }
      });

      // 内联关键 CSS
      const criticalCSS = await loadCriticalCSS();
      if (criticalCSS) {
        inlineCriticalCSS(criticalCSS);
      }

      updateProgress('critical-css', 100);
    } catch (error) {
      console.error('CSS optimization failed:', error);
      updateProgress('critical-css', 100);
    }
  }, [enableCSSOptimization, updateProgress]);

  // 优化图片加载
  const optimizeImageLoading = useCallback(async () => {
    if (!enableImageOptimization) return;
    
    setCurrentStage('图片懒加载优化');
    
    try {
      // 设置图片懒加载
      const images = document.querySelectorAll('img[data-src]');
      
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
              }
            }
          });
        }, {
          rootMargin: '50px 0px',
          threshold: 0.01,
        });

        images.forEach(img => imageObserver.observe(img));
      } else {
        // 降级处理：直接加载所有图片
        images.forEach(img => {
          const image = img as HTMLImageElement;
          if (image.dataset.src) {
            image.src = image.dataset.src;
            image.removeAttribute('data-src');
          }
        });
      }

      updateProgress('image-optimization', 100);
    } catch (error) {
      console.error('Image optimization failed:', error);
      updateProgress('image-optimization', 100);
    }
  }, [enableImageOptimization, updateProgress]);

  // 优化字体加载
  const optimizeFontLoading = useCallback(async () => {
    setCurrentStage('字体加载优化');
    
    try {
      // 使用 font-display: swap 优化字体加载
      const style = document.createElement('style');
      style.textContent = `
        @font-face {
          font-family: 'NotoSansSC';
          src: url('/fonts/NotoSansSC-Regular.woff2') format('woff2');
          font-display: swap;
          font-weight: 400;
        }
        @font-face {
          font-family: 'NotoSansSC';
          src: url('/fonts/NotoSansSC-Medium.woff2') format('woff2');
          font-display: swap;
          font-weight: 500;
        }
      `;
      document.head.appendChild(style);

      // 预加载字体
      await resourcePreloader.preloadFonts([
        '/fonts/NotoSansSC-Regular.woff2',
        '/fonts/NotoSansSC-Medium.woff2',
      ]);

      updateProgress('font-loading', 100);
    } catch (error) {
      console.error('Font optimization failed:', error);
      updateProgress('font-loading', 100);
    }
  }, [updateProgress]);

  // 优化 DOM 结构
  const optimizeDOMStructure = useCallback(async () => {
    setCurrentStage('DOM 结构优化');
    
    try {
      // 移除不必要的 DOM 节点
      const emptyElements = document.querySelectorAll(':empty:not(img):not(br):not(hr):not(input)');
      emptyElements.forEach(el => {
        if (el.childNodes.length === 0 && !el.hasAttribute('data-keep-empty')) {
          el.remove();
        }
      });

      // 合并相邻的文本节点
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      const textNodes: Text[] = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node as Text);
      }

      for (let i = 0; i < textNodes.length - 1; i++) {
        const current = textNodes[i];
        const next = textNodes[i + 1];
        
        if (current.nextSibling === next && current.parentNode === next.parentNode) {
          current.textContent += next.textContent;
          next.remove();
        }
      }

      updateProgress('dom-optimization', 100);
    } catch (error) {
      console.error('DOM optimization failed:', error);
      updateProgress('dom-optimization', 100);
    }
  }, [updateProgress]);

  // 优化渲染性能
  const optimizeRendering = useCallback(async () => {
    setCurrentStage('渲染性能优化');
    
    try {
      // 启用硬件加速
      const root = document.documentElement;
      root.style.transform = 'translateZ(0)';
      root.style.willChange = 'transform';

      // 优化滚动性能
      document.body.style.transform = 'translate3d(0, 0, 0)';

      // 设置视口优化
      let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.appendChild(viewport);
      }
      viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover';

      updateProgress('render-optimization', 100);
    } catch (error) {
      console.error('Render optimization failed:', error);
      updateProgress('render-optimization', 100);
    }
  }, [updateProgress]);

  // 加载关键 CSS
  const loadCriticalCSS = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/css/critical.css');
      return await response.text();
    } catch (error) {
      console.error('Failed to load critical CSS:', error);
      return null;
    }
  }, []);

  // 内联关键 CSS
  const inlineCriticalCSS = useCallback((css: string): void => {
    const style = document.createElement('style');
    style.textContent = css;
    style.dataset.critical = 'true';
    document.head.insertBefore(style, document.head.firstChild);
  }, []);

  // 执行所有优化
  const runOptimizations = useCallback(async () => {
    if (optimizationRef.current) return;
    optimizationRef.current = true;

    const optimizationStages = initializeStages();
    setStages(optimizationStages);

    try {
      // 按顺序执行优化
      await preloadCriticalResources();
      await optimizeCriticalCSS();
      await optimizeImageLoading();
      await optimizeFontLoading();
      await optimizeDOMStructure();
      await optimizeRendering();

      setIsOptimizing(false);
      setIsReady(true);
      onOptimizationComplete?.();
      
      console.log('First screen optimization completed');
    } catch (error) {
      console.error('Optimization failed:', error);
      setIsOptimizing(false);
      setIsReady(true);
      onOptimizationComplete?.();
    }
  }, [
    initializeStages,
    preloadCriticalResources,
    optimizeCriticalCSS,
    optimizeImageLoading,
    optimizeFontLoading,
    optimizeDOMStructure,
    optimizeRendering,
    onOptimizationComplete,
  ]);

  // 开始优化
  useEffect(() => {
    if (progress.currentPhase === StartupPhase.AppInitialization || 
        progress.currentPhase === StartupPhase.FrontendInitialization ||
        progress.currentPhase === null) {
      runOptimizations();
    }
  }, [progress.currentPhase, runOptimizations]);

  // 渲染优化 UI
  if (isOptimizing) {
    return (
      <div className="first-screen-optimizer">
        <div className="optimizer-backdrop" />
        <div className="optimizer-content">
          <div className="optimizer-header">
            <div className="optimizer-logo">
              <div className="logo-spinner" />
            </div>
            <h2>正在优化首屏加载</h2>
            <p className="current-stage">{currentStage}</p>
          </div>
          
          <div className="optimizer-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="progress-text">{overallProgress}%</div>
          </div>

          <div className="optimizer-stages">
            {stages.map((stage, index) => (
              <div 
                key={stage.name}
                className={`stage-item ${stage.completed ? 'completed' : ''} ${
                  currentStage.includes(stage.description) ? 'active' : ''
                }`}
              >
                <div className="stage-icon">
                  {stage.completed ? '✓' : index + 1}
                </div>
                <div className="stage-content">
                  <div className="stage-name">{stage.description}</div>
                  <div className="stage-weight">{stage.weight}%</div>
                </div>
              </div>
            ))}
          </div>

          <div className="optimizer-tips">
            <p>💡 正在为您优化应用性能，首次启动可能需要一些时间</p>
          </div>
        </div>
      </div>
    );
  }

  // 优化完成，渲染子组件
  return (
    <div className={`first-screen-optimized ${isReady ? 'ready' : ''}`}>
      {children}
    </div>
  );
};

/**
 * 高阶组件：为组件添加首屏优化
 */
export function withFirstScreenOptimization<P extends object>(
  Component: React.ComponentType<P>,
  resources?: PreloadResource[]
) {
  const OptimizedComponent: React.FC<P> = (props) => {
    return (
      <FirstScreenOptimizer criticalResources={resources}>
        <Component {...props} />
      </FirstScreenOptimizer>
    );
  };

  OptimizedComponent.displayName = `withFirstScreenOptimization(${Component.displayName || Component.name})`;
  return OptimizedComponent;
}

export default FirstScreenOptimizer;
