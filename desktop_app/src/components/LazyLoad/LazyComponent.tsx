/**
 * 懒加载组件包装器
 */
import React, { Suspense, lazy, ComponentType, ReactNode } from 'react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface LazyComponentProps {
  /** 懒加载组件的导入函数 */
  importFunc: () => Promise<{ default: ComponentType<any> }>;
  /** 加载中组件 */
  fallback?: ReactNode;
  /** 错误处理组件 */
  errorFallback?: ComponentType<{ error: Error; retry: () => void }>;
  /** 预加载延迟（毫秒） */
  preloadDelay?: number;
  /** 是否启用预加载 */
  enablePreload?: boolean;
  /** 传递给懒加载组件的 props */
  componentProps?: Record<string, any>;
  /** 组件名称（用于调试） */
  displayName?: string;
}

interface LazyComponentState {
  Component: ComponentType<any> | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * 懒加载组件类
 */
export class LazyComponent extends React.Component<LazyComponentProps, LazyComponentState> {
  private preloadTimer: NodeJS.Timeout | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private containerRef = React.createRef<HTMLDivElement>();

  constructor(props: LazyComponentProps) {
    super(props);
    this.state = {
      Component: null,
      isLoading: false,
      error: null,
    };
  }

  componentDidMount() {
    // 如果启用预加载，设置预加载定时器
    if (this.props.enablePreload) {
      this.setupPreload();
    }

    // 设置 Intersection Observer 进行可见性检测
    this.setupIntersectionObserver();
  }

  componentWillUnmount() {
    if (this.preloadTimer) {
      clearTimeout(this.preloadTimer);
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  /**
   * 设置预加载
   */
  private setupPreload = () => {
    const { preloadDelay = 1000 } = this.props;
    this.preloadTimer = setTimeout(() => {
      this.loadComponent();
    }, preloadDelay);
  };

  /**
   * 设置交叉观察器
   */
  private setupIntersectionObserver = () => {
    if (!('IntersectionObserver' in window)) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.state.Component && !this.state.isLoading) {
            this.loadComponent();
          }
        });
      },
      {
        rootMargin: '50px', // 提前50px开始加载
      }
    );

    if (this.containerRef.current) {
      this.intersectionObserver.observe(this.containerRef.current);
    }
  };

  /**
   * 加载组件
   */
  private loadComponent = async () => {
    if (this.state.isLoading || this.state.Component) {
      return;
    }

    this.setState({ isLoading: true, error: null });

    try {
      const module = await this.props.importFunc();
      const Component = module.default;

      this.setState({
        Component,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error(`Failed to load lazy component ${this.props.displayName}:`, error);
      this.setState({
        Component: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  /**
   * 重试加载
   */
  private retry = () => {
    this.setState({ error: null }, () => {
      this.loadComponent();
    });
  };

  render() {
    const { Component, isLoading, error } = this.state;
    const { 
      fallback = <LoadingSpinner />, 
      errorFallback: ErrorFallback,
      componentProps = {},
      displayName = 'LazyComponent'
    } = this.props;

    // 如果有错误且提供了错误组件，显示错误组件
    if (error && ErrorFallback) {
      return <ErrorFallback error={error} retry={this.retry} />;
    }

    // 如果有错误但没有提供错误组件，显示默认错误信息
    if (error) {
      return (
        <div className="lazy-component-error">
          <p>组件加载失败: {displayName}</p>
          <button onClick={this.retry} className="retry-button">
            重试
          </button>
        </div>
      );
    }

    return (
      <div ref={this.containerRef} className="lazy-component-container">
        {Component ? (
          <Component {...componentProps} />
        ) : isLoading ? (
          fallback
        ) : (
          <div className="lazy-component-placeholder">
            <button onClick={this.loadComponent} className="load-button">
              加载 {displayName}
            </button>
          </div>
        )}
      </div>
    );
  }
}

/**
 * HOC 工厂函数，用于创建懒加载组件
 */
export function createLazyComponent<P = {}>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  options: Partial<LazyComponentProps> = {}
) {
  const LazyWrapper: React.FC<P> = (props) => {
    return (
      <LazyComponent
        importFunc={importFunc}
        componentProps={props}
        {...options}
      />
    );
  };

  LazyWrapper.displayName = `LazyWrapper(${options.displayName || 'Component'})`;
  return LazyWrapper;
}

/**
 * React.lazy 的增强版本
 */
export function enhancedLazy<P = {}>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  options: {
    fallback?: ReactNode;
    errorBoundary?: boolean;
    displayName?: string;
  } = {}
) {
  const LazyComponent = lazy(importFunc);
  
  const EnhancedLazy: React.FC<P> = (props) => {
    const content = (
      <Suspense fallback={options.fallback || <LoadingSpinner />}>
        <LazyComponent {...props} />
      </Suspense>
    );

    if (options.errorBoundary !== false) {
      return (
        <ErrorBoundary fallback={(error, retry) => (
          <div className="lazy-component-error">
            <p>组件加载失败: {options.displayName}</p>
            <p>错误: {error.message}</p>
            <button onClick={retry} className="retry-button">
              重试
            </button>
          </div>
        )}>
          {content}
        </ErrorBoundary>
      );
    }

    return content;
  };

  EnhancedLazy.displayName = `EnhancedLazy(${options.displayName || 'Component'})`;
  return EnhancedLazy;
}

/**
 * 懒加载路由组件
 */
export const LazyRoute: React.FC<{
  component: () => Promise<{ default: ComponentType<any> }>;
  fallback?: ReactNode;
  preload?: boolean;
}> = ({ component, fallback, preload = false }) => {
  const LazyComponent = React.useMemo(() => lazy(component), [component]);
  
  // 预加载逻辑
  React.useEffect(() => {
    if (preload) {
      component().catch(console.error);
    }
  }, [component, preload]);

  return (
    <Suspense fallback={fallback || <LoadingSpinner />}>
      <LazyComponent />
    </Suspense>
  );
};

/**
 * 条件懒加载 Hook
 */
export function useConditionalLazy<T = any>(
  condition: boolean,
  importFunc: () => Promise<{ default: T }>
) {
  const [module, setModule] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (condition && !module && !isLoading) {
      setIsLoading(true);
      setError(null);

      importFunc()
        .then((mod) => {
          setModule(mod.default);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        });
    }
  }, [condition, module, isLoading, importFunc]);

  const retry = React.useCallback(() => {
    if (error) {
      setError(null);
      setIsLoading(false);
      setModule(null);
    }
  }, [error]);

  return { module, isLoading, error, retry };
}

/**
 * 预加载 Hook
 */
export function usePreload(
  importFuncs: Array<() => Promise<any>>,
  condition: boolean = true
) {
  const [preloadedCount, setPreloadedCount] = React.useState(0);
  const [isPreloading, setIsPreloading] = React.useState(false);
  const [errors, setErrors] = React.useState<Error[]>([]);

  React.useEffect(() => {
    if (!condition || importFuncs.length === 0) {
      return;
    }

    setIsPreloading(true);
    setPreloadedCount(0);
    setErrors([]);

    const promises = importFuncs.map((importFunc, index) =>
      importFunc()
        .then(() => {
          setPreloadedCount(prev => prev + 1);
        })
        .catch((error) => {
          setErrors(prev => [...prev, error]);
          console.error(`Preload failed for module ${index}:`, error);
        })
    );

    Promise.allSettled(promises).finally(() => {
      setIsPreloading(false);
    });
  }, [importFuncs, condition]);

  return {
    progress: importFuncs.length > 0 ? preloadedCount / importFuncs.length : 0,
    isPreloading,
    errors,
    isComplete: preloadedCount === importFuncs.length,
  };
}

export default LazyComponent;
