/**
 * Live2DLoadingIndicator组件单元测试
 * 
 * 测试Live2D加载指示器的显示、动画和状态处理
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Live2DLoadingIndicator } from '@/components/Character/Live2D/Live2DLoadingIndicator'
import { Live2DLoadState } from '@/types/live2d'

describe('Live2DLoadingIndicator组件', () => {
  describe('显示测试', () => {
    it('LOADING状态时应该显示加载内容', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.5}
        />
      )

      expect(screen.getByText('正在加载')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('SWITCHING状态时应该显示切换内容', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.SWITCHING}
        />
      )

      expect(screen.getByText('切换中')).toBeInTheDocument()
      expect(screen.getByText('正在切换模型...')).toBeInTheDocument()
    })

    it('ERROR状态时应该显示错误内容', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.ERROR}
          message="加载失败：文件不存在"
        />
      )

      expect(screen.getByText('加载失败')).toBeInTheDocument()
      expect(screen.getByText('加载失败：文件不存在')).toBeInTheDocument()
    })

    it('IDLE状态时应该显示准备内容', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.IDLE}
        />
      )

      expect(screen.getByText('准备中')).toBeInTheDocument()
      expect(screen.getByText('正在初始化...')).toBeInTheDocument()
    })

    it('应该显示加载进度', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.75}
        />
      )

      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('应该显示加载消息', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          message="正在加载纹理..."
        />
      )

      expect(screen.getByText('正在加载纹理...')).toBeInTheDocument()
    })

    it('应该显示加载阶段', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          stage="加载模型文件..."
        />
      )

      expect(screen.getByText('加载模型文件...')).toBeInTheDocument()
    })

    it('progress为0时应该显示0%', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0}
        />
      )

      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('progress为1时应该显示100%', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={1}
        />
      )

      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  describe('动画测试', () => {
    it('LOADING状态应该有旋转动画类', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      const icon = container.querySelector('.live2d-loading-indicator__icon-text--spinning')
      expect(icon).toBeInTheDocument()
    })

    it('SWITCHING状态应该有旋转动画类', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.SWITCHING}
        />
      )

      const icon = container.querySelector('.live2d-loading-indicator__icon-text--spinning')
      expect(icon).toBeInTheDocument()
    })

    it('ERROR状态不应该有旋转动画类', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.ERROR}
        />
      )

      const icon = container.querySelector('.live2d-loading-indicator__icon-text--spinning')
      expect(icon).not.toBeInTheDocument()
    })

    it('IDLE状态不应该有旋转动画类', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.IDLE}
        />
      )

      const icon = container.querySelector('.live2d-loading-indicator__icon-text--spinning')
      expect(icon).not.toBeInTheDocument()
    })

    it('LOADING状态应该显示跳动的点', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      const dots = container.querySelectorAll('.live2d-loading-indicator__dot')
      expect(dots).toHaveLength(3)
    })

    it('SWITCHING状态应该显示跳动的点', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.SWITCHING}
        />
      )

      const dots = container.querySelectorAll('.live2d-loading-indicator__dot')
      expect(dots).toHaveLength(3)
    })

    it('ERROR状态不应该显示跳动的点', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.ERROR}
        />
      )

      const dots = container.querySelector('.live2d-loading-indicator__dots')
      expect(dots).not.toBeInTheDocument()
    })
  })

  describe('样式测试', () => {
    it('应该应用自定义主题背景色', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          theme={{
            loading: {
              backgroundColor: 'rgb(255, 0, 0)',
              color: '#ffffff'
            }
          }}
        />
      )

      const indicator = container.querySelector('.live2d-loading-indicator')
      expect(indicator).toHaveStyle({
        backgroundColor: 'rgb(255, 0, 0)'
      })
    })

    it('应该应用自定义主题文字颜色', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          theme={{
            loading: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'rgb(0, 255, 0)'
            }
          }}
        />
      )

      const indicator = container.querySelector('.live2d-loading-indicator')
      expect(indicator).toHaveStyle({
        color: 'rgb(0, 255, 0)'
      })
    })

    it('应该应用自定义进度条颜色', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.5}
          theme={{
            loading: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'rgb(0, 0, 255)'
            }
          }}
        />
      )

      const progressFill = container.querySelector('.live2d-loading-indicator__progress-fill')
      expect(progressFill).toHaveStyle({
        backgroundColor: 'rgb(0, 0, 255)'
      })
    })

    it('没有主题时应该使用默认样式', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      const indicator = container.querySelector('.live2d-loading-indicator')
      expect(indicator).toHaveStyle({
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#ffffff'
      })
    })

    it('进度条宽度应该反映进度百分比', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.65}
        />
      )

      const progressFill = container.querySelector('.live2d-loading-indicator__progress-fill')
      expect(progressFill).toHaveStyle({
        width: '65%'
      })
    })
  })

  describe('进度条测试', () => {
    it('LOADING状态应该显示进度条', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      const progressBar = container.querySelector('.live2d-loading-indicator__progress')
      expect(progressBar).toBeInTheDocument()
    })

    it('SWITCHING状态应该显示进度条', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.SWITCHING}
        />
      )

      const progressBar = container.querySelector('.live2d-loading-indicator__progress')
      expect(progressBar).toBeInTheDocument()
    })

    it('ERROR状态不应该显示进度条', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.ERROR}
        />
      )

      const progressBar = container.querySelector('.live2d-loading-indicator__progress')
      expect(progressBar).not.toBeInTheDocument()
    })

    it('IDLE状态不应该显示进度条', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.IDLE}
        />
      )

      const progressBar = container.querySelector('.live2d-loading-indicator__progress')
      expect(progressBar).not.toBeInTheDocument()
    })
  })

  describe('图标测试', () => {
    it('LOADING状态应该显示加载图标', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      expect(screen.getByText('🔄')).toBeInTheDocument()
    })

    it('SWITCHING状态应该显示加载图标', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.SWITCHING}
        />
      )

      expect(screen.getByText('🔄')).toBeInTheDocument()
    })

    it('ERROR状态应该显示错误图标', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.ERROR}
        />
      )

      expect(screen.getByText('❌')).toBeInTheDocument()
    })

    it('IDLE状态应该显示等待图标', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.IDLE}
        />
      )

      expect(screen.getByText('⏳')).toBeInTheDocument()
    })
  })

  describe('消息显示测试', () => {
    it('应该同时显示stage和message', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          stage="正在加载模型..."
          message="请稍候"
        />
      )

      expect(screen.getByText('正在加载模型...')).toBeInTheDocument()
      expect(screen.getByText('请稍候')).toBeInTheDocument()
    })

    it('message与description相同时不应该重复显示', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          message="正在加载Live2D模型..."
        />
      )

      const messages = container.querySelectorAll('.live2d-loading-indicator__message')
      expect(messages).toHaveLength(0)
    })

    it('没有message时不应该显示额外消息', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      const message = container.querySelector('.live2d-loading-indicator__message')
      expect(message).not.toBeInTheDocument()
    })
  })

  describe('边界情况测试', () => {
    it('应该处理负数进度', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={-0.5}
        />
      )

      // Math.round(-50) = -50
      expect(screen.getByText('-50%')).toBeInTheDocument()
    })

    it('应该处理超过1的进度', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={1.5}
        />
      )

      expect(screen.getByText('150%')).toBeInTheDocument()
    })

    it('应该处理小数进度', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.456}
        />
      )

      expect(screen.getByText('46%')).toBeInTheDocument()
    })

    it('应该处理空字符串message', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          message=""
        />
      )

      expect(screen.getByText('正在加载')).toBeInTheDocument()
    })

    it('应该处理空字符串stage', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          stage=""
        />
      )

      expect(screen.getByText('正在加载Live2D模型...')).toBeInTheDocument()
    })

    it('应该处理未定义的progress', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('应该处理部分主题配置', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          theme={{
            loading: {
              backgroundColor: 'rgb(255, 0, 0)'
            } as any
          }}
        />
      )

      const indicator = container.querySelector('.live2d-loading-indicator')
      expect(indicator).toHaveStyle({
        backgroundColor: 'rgb(255, 0, 0)',
        color: '#ffffff' // 默认值
      })
    })
  })

  describe('结构测试', () => {
    it('应该包含所有必要的元素', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.5}
        />
      )

      expect(container.querySelector('.live2d-loading-indicator')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__content')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__icon')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__title')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__description')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__progress')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__dots')).toBeInTheDocument()
    })

    it('ERROR状态应该只包含基本元素', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.ERROR}
        />
      )

      expect(container.querySelector('.live2d-loading-indicator')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__icon')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__title')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__description')).toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__progress')).not.toBeInTheDocument()
      expect(container.querySelector('.live2d-loading-indicator__dots')).not.toBeInTheDocument()
    })
  })

  describe('可访问性测试', () => {
    it('应该有适当的语义标签', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      const title = container.querySelector('h3')
      expect(title).toBeInTheDocument()
      expect(title).toHaveTextContent('正在加载')
    })

    it('描述文本应该使用段落标签', () => {
      const { container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      const description = container.querySelector('.live2d-loading-indicator__description')
      expect(description?.tagName).toBe('P')
    })

    it('进度文本应该易于阅读', () => {
      render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.5}
        />
      )

      const progressText = screen.getByText('50%')
      expect(progressText).toBeInTheDocument()
      expect(progressText.className).toBe('live2d-loading-indicator__progress-text')
    })
  })

  describe('渲染一致性测试', () => {
    it('多次渲染应该保持一致', () => {
      const { rerender, container } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.5}
        />
      )

      const firstRender = container.innerHTML

      rerender(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.5}
        />
      )

      expect(container.innerHTML).toBe(firstRender)
    })

    it('状态切换应该正确更新', () => {
      const { rerender } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
        />
      )

      expect(screen.getByText('正在加载')).toBeInTheDocument()

      rerender(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.ERROR}
        />
      )

      expect(screen.getByText('加载失败')).toBeInTheDocument()
      expect(screen.queryByText('正在加载')).not.toBeInTheDocument()
    })

    it('进度更新应该正确反映', () => {
      const { rerender } = render(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.25}
        />
      )

      expect(screen.getByText('25%')).toBeInTheDocument()

      rerender(
        <Live2DLoadingIndicator
          loadState={Live2DLoadState.LOADING}
          progress={0.75}
        />
      )

      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.queryByText('25%')).not.toBeInTheDocument()
    })
  })
})

