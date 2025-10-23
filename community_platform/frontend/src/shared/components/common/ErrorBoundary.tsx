/**
 * ErrorBoundary 错误边界组件
 * 捕获 React 组件树中的错误，显示降级 UI
 */

import React from 'react'
import { ErrorState } from './ErrorState'

export interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  override render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback

      if (FallbackComponent) {
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }

      return (
        <ErrorState
          title="出错了"
          message={this.state.error.message}
          action={{
            label: '重试',
            onClick: this.resetError,
          }}
        />
      )
    }

    return this.props.children
  }
}

// Hook 版本的 ErrorBoundary
export function useErrorHandler(): (error: Error) => void {
  const [, setError] = React.useState<Error>()

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error
    })
  }, [])
}

