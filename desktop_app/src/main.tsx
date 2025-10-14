// PixiJS 修复 - 必须在任何 PixiJS 相关导入之前
;(function() {
  try {
    // 尝试修复全局 PIXI 对象
    if (typeof window !== 'undefined' && (window as any).PIXI) {
      const PIXI = (window as any).PIXI
      if (PIXI.BatchRenderer && PIXI.BatchRenderer.prototype.checkMaxIfStatementsInShader) {
        const original = PIXI.BatchRenderer.prototype.checkMaxIfStatementsInShader
        if (!original._isFixed) {
          PIXI.BatchRenderer.prototype.checkMaxIfStatementsInShader = function(maxIfs: number) {
            const safeMaxIfs = Math.max(maxIfs || 32, 32)
            console.log('🔧 PixiJS BatchRenderer main.tsx 修复:', maxIfs, '->', safeMaxIfs)
            return original.call(this, safeMaxIfs)
          }
          PIXI.BatchRenderer.prototype.checkMaxIfStatementsInShader._isFixed = true
          console.log('✅ PixiJS BatchRenderer main.tsx 修复完成')
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ main.tsx PixiJS 修复失败:', error)
  }
})()

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { GlobalErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoadingProvider } from '@/contexts/LoadingContext'
import { TauriProvider } from '@/contexts/TauriContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { initializeLive2DCubismCore } from '@/utils/live2d-init'
import App from './App'

import '@/styles/animations.css'
import '@/styles/components.css'
import '@/styles/globals.css'

// 创建 React Query 客户端
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // 数据保持新鲜时间
            staleTime: 5 * 60 * 1000, // 5分钟
            // 缓存时间（使用 gcTime 替代已弃用的 cacheTime）
            gcTime: 10 * 60 * 1000, // 10分钟
            // 重试次数
            retry: (failureCount, error: any) => {
                // 对于 4xx 错误不重试
                if (error?.status >= 400 && error?.status < 500) {
                    return false
                }
                return failureCount < 3
            },
            // 重试延迟
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // 窗口聚焦时重新获取
            refetchOnWindowFocus: false,
            // 网络重连时重新获取
            refetchOnReconnect: true,
            // 组件挂载时重新获取
            refetchOnMount: true,
        },
        mutations: {
            // 变更重试次数
            retry: 1,
            // 变更重试延迟
            retryDelay: 1000,
        },
    },
})

// 错误处理
const handleGlobalError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('全局错误:', error, errorInfo)

    // 发送错误报告到后端（如果需要）
    if (import.meta.env?.PROD) {
        // 这里可以集成错误报告服务
        // 例如：Sentry, LogRocket 等
    }
}

// 性能监控
if (import.meta.env?.DEV) {
    // 开发环境下的性能监控
    const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
            console.log(`性能指标 - ${entry.name}: ${entry.duration}ms`)
        })
    })

    observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] })
}

// 应用初始化
const initializeApp = async () => {
    try {
        console.log('🚀 开始初始化应用...')
        
        // 首先初始化 Live2D Cubism Core
        try {
            await initializeLive2DCubismCore()
            console.log('✅ Live2D Cubism Core 初始化完成')
        } catch (error) {
            console.error('⚠️ Live2D Cubism Core 初始化失败，但应用将继续运行:', error)
        }

        // 检查 Tauri 环境
        if (window.__TAURI__) {
            console.log('Tauri 环境检测成功')

            // 导入 Tauri API
            const { invoke } = await import('@tauri-apps/api/tauri')
            const { appWindow } = await import('@tauri-apps/api/window')

            // 初始化应用状态
            try {
                await invoke('initialize_app')
                console.log('✅ Tauri 应用初始化完成')
            } catch (error) {
                console.warn('⚠️ Tauri 应用初始化失败:', error)
            }

            // 设置窗口事件监听
            await appWindow.listen('tauri://close-requested', () => {
                console.log('应用即将关闭')
                // 这里可以添加清理逻辑
            })

            // 设置窗口焦点事件
            await appWindow.listen('tauri://focus', () => {
                console.log('窗口获得焦点')
            })

            await appWindow.listen('tauri://blur', () => {
                console.log('窗口失去焦点')
            })
        } else {
            console.log('Web 环境运行')
        }
    } catch (error) {
        console.error('应用初始化失败:', error)
    }
}

// 应用根组件
const AppRoot: React.FC = () => {
    React.useEffect(() => {
        initializeApp()
    }, [])

    return (
        <React.StrictMode>
            <GlobalErrorBoundary onError={handleGlobalError}>
                <QueryClientProvider client={queryClient}>
                    <BrowserRouter>
                        <TauriProvider>
                            <ThemeProvider>
                                <LoadingProvider>
                                    <ToastProvider>
                                        <App />
                                        {/* React Query 开发工具 */}
                                        {import.meta.env?.DEV && (
                                            <ReactQueryDevtools
                                                initialIsOpen={false}
                                                position={'bottom-right' as any}
                                            />
                                        )}
                                    </ToastProvider>
                                </LoadingProvider>
                            </ThemeProvider>
                        </TauriProvider>
                    </BrowserRouter>
                    {/* React Query 开发工具（仅开发环境） */}
                </QueryClientProvider>
            </GlobalErrorBoundary>
        </React.StrictMode>
    )
}

// 渲染应用
const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error('Root element not found')
}

const root = ReactDOM.createRoot(rootElement)

// 渲染应用
root.render(<AppRoot />)

// 热模块替换
if (import.meta.hot) {
    import.meta.hot.accept()
}

// 注册 Service Worker（生产环境）
if (import.meta.env?.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration)
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError)
            })
    })
}

// 全局类型声明
declare global {
    interface Window {
        __APP_VERSION__?: string
        __BUILD_TIME__?: string
    }
    
    interface ImportMeta {
        readonly env: ImportMetaEnv
        readonly hot?: {
            accept(): void
            accept(cb: () => void): void
        }
    }
    
    interface ImportMetaEnv {
        readonly DEV: boolean
        readonly PROD: boolean
        readonly MODE: string
        readonly BASE_URL: string
    }
}

// 导出类型
export type { QueryClient }
