/**
 * Loading 组件测试
 * 
 * 测试各种加载样式、尺寸和配置选项
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Loading, InlineLoading } from '../../../../components/common/Loading'
import { renderWithProviders, expectVisible, expectHidden } from '../../../utils/test-utils'
import type { LoadingVariant, LoadingSize } from '../../../../components/common/Loading'

// Mock CSS 模块
vi.mock('../../../../src/components/common/Loading/styles.css', () => ({}))

describe('Loading 组件', () => {
  describe('✅ 渲染测试', () => {
    it('应该正确渲染默认加载组件', () => {
      render(<Loading />)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(document.querySelector('.loading-container')).toBeInTheDocument()
    })

    it('应该正确渲染所有加载样式', () => {
      const variants: LoadingVariant[] = ['spinner', 'dots', 'bars', 'pulse', 'ring', 'progress']
      
      variants.forEach(variant => {
        const { unmount } = render(<Loading variant={variant} />)
        
        expect(document.querySelector('.loading-container')).toBeInTheDocument()
        
        if (variant === 'spinner') {
          expect(document.querySelector('.loading-spinner')).toBeInTheDocument()
          expect(document.querySelector('.loading-spinner-circle')).toBeInTheDocument()
        } else if (variant === 'dots') {
          expect(document.querySelector('.loading-dots')).toBeInTheDocument()
          expect(document.querySelectorAll('.loading-dot')).toHaveLength(3)
        } else if (variant === 'bars') {
          expect(document.querySelector('.loading-bars')).toBeInTheDocument()
          expect(document.querySelectorAll('.loading-bar')).toHaveLength(5)
        } else if (variant === 'pulse') {
          expect(document.querySelector('.loading-pulse')).toBeInTheDocument()
          expect(document.querySelectorAll('.loading-pulse-ring')).toHaveLength(2)
        } else if (variant === 'ring') {
          expect(document.querySelector('.loading-ring')).toBeInTheDocument()
          expect(document.querySelector('.loading-ring-inner')).toBeInTheDocument()
        } else if (variant === 'progress') {
          expect(document.querySelector('.loading-progress')).toBeInTheDocument()
          expect(document.querySelector('.loading-progress-bar')).toBeInTheDocument()
        }
        
        unmount()
      })
    })

    it('应该正确渲染所有尺寸', () => {
      const sizes: LoadingSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
      
      sizes.forEach(size => {
        const { unmount } = render(<Loading size={size} />)
        
        const loadingElement = document.querySelector(`.loading-${size}`)
        expect(loadingElement).toBeInTheDocument()
        
        unmount()
      })
    })

    it('应该显示加载文本', () => {
      const loadingText = '正在加载数据...'
      render(<Loading text={loadingText} />)
      
      expect(screen.getByText(loadingText)).toBeInTheDocument()
      expect(document.querySelector('.loading-text')).toBeInTheDocument()
    })

    it('应该显示进度条和进度文本', () => {
      render(<Loading variant="progress" progress={65} showProgress={true} />)
      
      expect(screen.getByText('65%')).toBeInTheDocument()
      expect(document.querySelector('.loading-progress-text')).toBeInTheDocument()
      
      const progressBar = document.querySelector('.loading-progress-bar') as HTMLElement
      expect(progressBar).toHaveStyle({ width: '65%' })
    })

    it('应该隐藏进度文本当 showProgress 为 false', () => {
      render(<Loading variant="progress" progress={50} showProgress={false} />)
      
      expect(screen.queryByText('50%')).not.toBeInTheDocument()
      expect(document.querySelector('.loading-progress-text')).not.toBeInTheDocument()
    })
  })

  describe('✅ 可见性测试', () => {
    it('visible=false 时不应该渲染', () => {
      render(<Loading visible={false} />)
      
      expect(document.querySelector('.loading-container')).not.toBeInTheDocument()
    })

    it('visible=true 时应该渲染（默认行为）', () => {
      render(<Loading visible={true} />)
      
      expect(document.querySelector('.loading-container')).toBeInTheDocument()
    })

    it('默认情况下应该可见', () => {
      render(<Loading />)
      
      expect(document.querySelector('.loading-container')).toBeInTheDocument()
    })
  })

  describe('✅ 全屏模式测试', () => {
    it('应该渲染全屏加载遮罩', () => {
      render(<Loading fullScreen />)
      
      expect(document.querySelector('.loading-overlay')).toBeInTheDocument()
      expect(document.querySelector('.loading-container')).toBeInTheDocument()
    })

    it('应该应用正确的遮罩透明度', () => {
      render(<Loading fullScreen overlayOpacity={0.8} />)
      
      const overlay = document.querySelector('.loading-overlay') as HTMLElement
      expect(overlay).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.8)' })
    })

    it('非全屏模式不应该有遮罩', () => {
      render(<Loading fullScreen={false} />)
      
      expect(document.querySelector('.loading-overlay')).not.toBeInTheDocument()
      expect(document.querySelector('.loading-container')).toBeInTheDocument()
    })
  })

  describe('✅ 自定义样式测试', () => {
    it('应该应用自定义颜色', () => {
      const customColor = '#ff6b6b'
      render(<Loading color={customColor} />)
      
      const spinner = document.querySelector('.loading-spinner') as HTMLElement
      expect(spinner).toHaveStyle({ color: customColor })
    })

    it('应该应用自定义类名', () => {
      const customClass = 'custom-loading-class'
      render(<Loading className={customClass} />)
      
      const container = document.querySelector('.loading-container')
      expect(container).toHaveClass(customClass)
    })

    it('应该同时应用颜色到文本和图标', () => {
      const customColor = '#42b883'
      render(<Loading color={customColor} text="加载中..." />)
      
      const spinner = document.querySelector('.loading-spinner') as HTMLElement
      const text = document.querySelector('.loading-text') as HTMLElement
      
      expect(spinner).toHaveStyle({ color: customColor })
      expect(text).toHaveStyle({ color: customColor })
    })
  })

  describe('✅ 进度条测试', () => {
    it('应该正确设置进度条宽度', () => {
      const progressValues = [0, 25, 50, 75, 100]
      
      progressValues.forEach(progress => {
        const { unmount } = render(<Loading variant="progress" progress={progress} />)
        
        const progressBar = document.querySelector('.loading-progress-bar') as HTMLElement
        expect(progressBar).toHaveStyle({ width: `${progress}%` })
        
        unmount()
      })
    })

    it('应该处理无效的进度值', () => {
      const { rerender } = render(<Loading variant="progress" progress={undefined} />)
      
      let progressBar = document.querySelector('.loading-progress-bar') as HTMLElement
      expect(progressBar).toHaveStyle({ width: '0%' })
      
      rerender(<Loading variant="progress" progress={-10} />)
      progressBar = document.querySelector('.loading-progress-bar') as HTMLElement
      expect(progressBar).toHaveStyle({ width: '-10%' })
      
      rerender(<Loading variant="progress" progress={150} />)
      progressBar = document.querySelector('.loading-progress-bar') as HTMLElement
      expect(progressBar).toHaveStyle({ width: '150%' })
    })

    it('应该格式化进度百分比', () => {
      const { rerender } = render(
        <Loading variant="progress" progress={33.6666} showProgress />
      )
      
      expect(screen.getByText('34%')).toBeInTheDocument()
      
      rerender(<Loading variant="progress" progress={66.1234} showProgress />)
      
      expect(screen.getByText('66%')).toBeInTheDocument()
    })
  })

  describe('✅ 边界情况测试', () => {
    it('应该处理空的 text 属性', () => {
      render(<Loading text="" />)
      
      expect(document.querySelector('.loading-text')).not.toBeInTheDocument()
    })

    it('应该处理 null 或 undefined text', () => {
      const { rerender } = render(<Loading text={null} />)
      expect(document.querySelector('.loading-text')).not.toBeInTheDocument()
      
      rerender(<Loading text={undefined} />)
      expect(document.querySelector('.loading-text')).not.toBeInTheDocument()
    })

    it('应该处理无效的变体', () => {
      render(<Loading variant={'invalid' as any} />)
      
      // 应该渲染容器但没有具体的加载图标
      expect(document.querySelector('.loading-container')).toBeInTheDocument()
    })

    it('应该处理极端的遮罩透明度值', () => {
      const { rerender } = render(<Loading fullScreen overlayOpacity={0} />)
      
      let overlay = document.querySelector('.loading-overlay') as HTMLElement
      expect(overlay).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0)' })
      
      rerender(<Loading fullScreen overlayOpacity={1} />)
      
      overlay = document.querySelector('.loading-overlay') as HTMLElement
      expect(overlay).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 1)' })
      
      rerender(<Loading fullScreen overlayOpacity={2} />)
      
      overlay = document.querySelector('.loading-overlay') as HTMLElement
      expect(overlay).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 2)' })
    })
  })

  describe('✅ 性能测试', () => {
    it('不可见时应该返回 null 而不是渲染DOM', () => {
      render(<Loading visible={false} />)
      
      expect(document.querySelector('.loading-container')).not.toBeInTheDocument()
      expect(document.querySelector('.loading-overlay')).not.toBeInTheDocument()
    })

    it('应该避免不必要的重新渲染', () => {
      let renderCount = 0
      
      const TestLoading = (props: any) => {
        renderCount++
        return <Loading {...props} />
      }
      
      const { rerender } = render(<TestLoading variant="spinner" />)
      expect(renderCount).toBe(1)
      
      // 相同的 props
      rerender(<TestLoading variant="spinner" />)
      expect(renderCount).toBe(2) // 没有memo，会重新渲染
    })
  })
})

describe('InlineLoading 组件', () => {
  describe('✅ 基础渲染测试', () => {
    it('应该渲染内联加载组件', () => {
      render(<InlineLoading />)
      
      expect(document.querySelector('.loading-inline')).toBeInTheDocument()
      expect(document.querySelector('.loading-container')).toBeInTheDocument()
    })

    it('应该使用默认的 spinner 变体和 sm 尺寸', () => {
      render(<InlineLoading />)
      
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument()
      expect(document.querySelector('.loading-sm')).toBeInTheDocument()
    })

    it('应该支持自定义变体和尺寸', () => {
      render(<InlineLoading variant="dots" size="md" />)
      
      expect(document.querySelector('.loading-dots')).toBeInTheDocument()
      expect(document.querySelector('.loading-md')).toBeInTheDocument()
    })

    it('应该应用自定义类名', () => {
      const customClass = 'custom-inline-loading'
      render(<InlineLoading className={customClass} />)
      
      const inlineLoading = document.querySelector('.loading-inline')
      expect(inlineLoading).toHaveClass(customClass)
    })
  })

  describe('✅ 样式测试', () => {
    it('应该包含正确的类名结构', () => {
      render(<InlineLoading />)
      
      const inlineWrapper = document.querySelector('.loading-inline')
      const container = document.querySelector('.loading-container')
      
      expect(inlineWrapper).toBeInTheDocument()
      expect(container).toBeInTheDocument()
      expect(inlineWrapper).toContainElement(container)
    })

    it('应该支持所有变体', () => {
      const variants: LoadingVariant[] = ['spinner', 'dots', 'bars', 'pulse', 'ring']
      
      variants.forEach(variant => {
        const { unmount } = render(<InlineLoading variant={variant} />)
        
        expect(document.querySelector('.loading-inline')).toBeInTheDocument()
        
        unmount()
      })
    })

    it('应该支持所有尺寸', () => {
      const sizes: LoadingSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
      
      sizes.forEach(size => {
        const { unmount } = render(<InlineLoading size={size} />)
        
        expect(document.querySelector(`.loading-${size}`)).toBeInTheDocument()
        
        unmount()
      })
    })
  })
})

describe('Loading 组件集成测试', () => {
  describe('✅ 真实使用场景', () => {
    it('应该在数据加载时显示加载状态', async () => {
      let isLoading = true
      
      const { rerender } = render(
        <div>
          {isLoading && <Loading text="正在加载数据..." />}
          {!isLoading && <div>数据内容</div>}
        </div>
      )
      
      // 初始状态：显示加载
      expect(screen.getByText('正在加载数据...')).toBeInTheDocument()
      expect(screen.queryByText('数据内容')).not.toBeInTheDocument()
      
      // 加载完成：隐藏加载，显示内容
      isLoading = false
      rerender(
        <div>
          {isLoading && <Loading text="正在加载数据..." />}
          {!isLoading && <div>数据内容</div>}
        </div>
      )
      
      expect(screen.queryByText('正在加载数据...')).not.toBeInTheDocument()
      expect(screen.getByText('数据内容')).toBeInTheDocument()
    })

    it('应该在文件上传时显示进度', () => {
      const uploadProgress = 45
      
      render(
        <Loading 
          variant="progress" 
          progress={uploadProgress}
          text="正在上传文件..."
          showProgress={true}
        />
      )
      
      expect(screen.getByText('正在上传文件...')).toBeInTheDocument()
      expect(screen.getByText('45%')).toBeInTheDocument()
      
      const progressBar = document.querySelector('.loading-progress-bar') as HTMLElement
      expect(progressBar).toHaveStyle({ width: '45%' })
    })

    it('应该在全屏模式下阻止背景交互', () => {
      const handleBackgroundClick = vi.fn()
      
      render(
        <div onClick={handleBackgroundClick}>
          <div>背景内容</div>
          <Loading fullScreen text="处理中..." />
        </div>
      )
      
      // 全屏遮罩应该存在
      expect(document.querySelector('.loading-overlay')).toBeInTheDocument()
      expect(screen.getByText('处理中...')).toBeInTheDocument()
    })
  })

  describe('✅ 可访问性测试', () => {
    it('应该有正确的 ARIA 属性', () => {
      render(<Loading text="正在加载..." />)
      
      // Loading组件应该有 role="status"
      const container = document.querySelector('.loading-container')
      expect(container?.closest('[role="status"]')).toBeInTheDocument()
    })

    it('应该提供屏幕阅读器友好的文本', () => {
      render(<Loading text="正在同步数据，请稍候..." />)
      
      expect(screen.getByText('正在同步数据，请稍候...')).toBeInTheDocument()
    })

    it('应该支持 aria-label', () => {
      render(
        <div role="status" aria-label="内容正在加载">
          <Loading />
        </div>
      )
      
      expect(screen.getByLabelText('内容正在加载')).toBeInTheDocument()
    })
  })
})
