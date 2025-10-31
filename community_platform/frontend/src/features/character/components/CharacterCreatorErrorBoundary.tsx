/**
 * 角色创建器错误边界组件
 * 捕获子组件中的错误，防止整个应用崩溃
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * 错误边界类组件
 */
class CharacterCreatorErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] CharacterCreator Error caught:', {
      error,
      errorInfo,
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 错误回退UI组件
 */
function ErrorFallback({ 
  error, 
  onReset 
}: { 
  error: Error | null; 
  onReset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-red-900">出错了</CardTitle>
              <CardDescription className="text-red-700">
                创建角色时遇到了问题
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 bg-white border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-900 mb-2">错误详情：</p>
              <p className="text-sm text-red-700 font-mono break-words">
                {error.message}
              </p>
            </div>
          )}

          <div className="p-4 bg-white border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>可能的解决方案：</strong>
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mt-2">
              <li>检查您的网络连接</li>
              <li>刷新页面重试</li>
              <li>清除浏览器缓存</li>
              <li>如果问题持续，请联系技术支持</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button onClick={onReset} variant="default" className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
            <Button 
              onClick={() => router.push('/')} 
              variant="outline" 
              className="flex-1"
            >
              <Home className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 导出函数式组件包装器，以便使用hooks
export function CharacterCreatorErrorBoundary({ children, fallback }: Props) {
  return (
    <CharacterCreatorErrorBoundaryClass fallback={fallback}>
      {children}
    </CharacterCreatorErrorBoundaryClass>
  );
}

