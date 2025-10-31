/**
 * Live2DControlPanel组件单元测试
 * 
 * 测试Live2D控制面板的UI、交互和功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Live2DControlPanel } from '@/components/Character/Live2D/Live2DControlPanel'
import { Live2DAnimationType, Live2DAnimationPriority } from '@/types/live2d'

// 创建测试用的模型状态
const createMockModelState = (overrides = {}) => ({
  loaded: true,
  animating: false,
  interactive: true,
  lastUpdated: Date.now(),
  ...overrides
})

// 创建测试用的动画信息
const createMockAnimationInfo = (overrides = {}) => ({
  config: {
    type: Live2DAnimationType.IDLE,
    group: 'idle',
    index: 0,
    priority: Live2DAnimationPriority.IDLE,
    ...overrides.config
  },
  state: 'playing',
  progress: 0.5,
  duration: 3000,
  startTime: Date.now(),
  ...overrides
})

// 创建测试用的动画列表
const createMockAnimations = () => [
  {
    type: Live2DAnimationType.IDLE,
    group: 'idle',
    index: 0,
    priority: Live2DAnimationPriority.IDLE
  },
  {
    type: Live2DAnimationType.IDLE,
    group: 'idle',
    index: 1,
    priority: Live2DAnimationPriority.IDLE
  },
  {
    type: Live2DAnimationType.TAP,
    group: 'tap_body',
    index: 0,
    priority: Live2DAnimationPriority.NORMAL
  },
  {
    type: Live2DAnimationType.HAPPY,
    group: 'happy',
    index: 0,
    priority: Live2DAnimationPriority.NORMAL
  }
]

// 创建测试用的控制配置
const createMockControls = (overrides = {}) => ({
  showPlayPause: true,
  showAnimationSelector: true,
  showExpressionSelector: true,
  showZoomControls: true,
  showResetPosition: true,
  showFullscreen: true,
  showSettings: true,
  position: 'bottom' as const,
  autoHide: false,
  autoHideDelay: 3000,
  ...overrides
})

describe('Live2DControlPanel组件', () => {
  const mockOnPlayAnimation = vi.fn()
  const mockOnStopAnimation = vi.fn()
  const mockOnSetExpression = vi.fn()
  const mockOnResetTransform = vi.fn()
  const mockOnToggleFullscreen = vi.fn()
  const mockOnUpdateSettings = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI测试', () => {
    it('应该渲染所有控制按钮', () => {
      const controls = createMockControls()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={controls}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      // 验证主要控制按钮存在
      expect(screen.getByTitle('播放')).toBeInTheDocument()
      expect(screen.getByTitle('重置缩放')).toBeInTheDocument()
      expect(screen.getByTitle('全屏')).toBeInTheDocument()
      expect(screen.getByTitle('设置')).toBeInTheDocument()
    })

    it('应该根据配置显示/隐藏按钮', () => {
      const controls = createMockControls({
        showPlayPause: false,
        showZoomControls: false,
        showFullscreen: false
      })
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={controls}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      // 这些按钮不应该存在
      expect(screen.queryByTitle('播放')).not.toBeInTheDocument()
      expect(screen.queryByTitle('暂停')).not.toBeInTheDocument()
      expect(screen.queryByTitle('重置缩放')).not.toBeInTheDocument()
      expect(screen.queryByTitle('全屏')).not.toBeInTheDocument()
    })

    it('应该应用正确的位置class', () => {
      const { container } = render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls({ position: 'top' })}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const panel = container.querySelector('.live2d-control-panel')
      expect(panel).toHaveClass('live2d-control-panel--top')
    })

    it('visible=false时应该不渲染', () => {
      const { container } = render(
        <Live2DControlPanel
          visible={false}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('交互测试', () => {
    it('点击播放/暂停应该切换状态', async () => {
      const user = userEvent.setup()
      
      const { rerender } = render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState({ animating: false })}
          animationInfo={null}
          availableAnimations={createMockAnimations()}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      // 初始状态应该是播放按钮
      const playButton = screen.getByTitle('播放')
      await user.click(playButton)

      expect(mockOnPlayAnimation).toHaveBeenCalled()

      // 重新渲染为动画中状态
      rerender(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState({ animating: true })}
          animationInfo={createMockAnimationInfo()}
          availableAnimations={createMockAnimations()}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const pauseButton = screen.getByTitle('暂停')
      await user.click(pauseButton)

      expect(mockOnStopAnimation).toHaveBeenCalled()
    })

    it('选择动画应该触发回调', async () => {
      const user = userEvent.setup()
      
      // 先点击设置按钮展开详细面板
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={createMockAnimations()}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        await user.click(settingsButton)
      })

      // 点击动画标签页
      const animationsTab = screen.getByText('动画')
      await act(async () => {
        await user.click(animationsTab)
      })

      // 点击随机播放按钮
      const randomButton = screen.getByText('随机播放')
      await act(async () => {
        await user.click(randomButton)
      })

      expect(mockOnPlayAnimation).toHaveBeenCalled()
    })

    it('选择表情应该触发回调', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={3}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      // 点击表情标签页
      const expressionsTab = screen.getByText('表情')
      await user.click(expressionsTab)

      // 点击第一个表情
      const expression = screen.getByText('表情 1')
      await user.click(expression)

      expect(mockOnSetExpression).toHaveBeenCalledWith(0)
    })

    it('重置按钮应该调用重置函数', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const resetButton = screen.getByTitle('重置缩放')
      await user.click(resetButton)

      expect(mockOnResetTransform).toHaveBeenCalled()
    })

    it('全屏按钮应该切换全屏', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const fullscreenButton = screen.getByTitle('全屏')
      await user.click(fullscreenButton)

      expect(mockOnToggleFullscreen).toHaveBeenCalled()
    })
  })

  describe('动画列表测试', () => {
    it('应该显示可用动画', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={createMockAnimations()}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      // 应该显示空闲动画（默认选中）
      const idleAnimations = screen.getAllByText(/idle/)
      expect(idleAnimations.length).toBeGreaterThan(0)
    })

    it('应该按类型分组显示动画', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={createMockAnimations()}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      // 选择动画类型
      const select = screen.getByDisplayValue('空闲')
      await user.selectOptions(select, Live2DAnimationType.TAP)

      // 应该显示TAP类型的动画
      expect(screen.getByText(/tap_body/)).toBeInTheDocument()
    })

    it('没有动画时应该显示空状态', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      expect(screen.getByText('该类型暂无可用动画')).toBeInTheDocument()
    })

    it('应该高亮当前播放的动画', async () => {
      const user = userEvent.setup()
      
      const { container } = render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState({ animating: true })}
          animationInfo={createMockAnimationInfo({
            config: {
              type: Live2DAnimationType.IDLE,
              group: 'idle',
              index: 0
            }
          })}
          availableAnimations={createMockAnimations()}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      const activeAnimation = container.querySelector('.live2d-control-panel__animation-item--active')
      expect(activeAnimation).toBeInTheDocument()
    })
  })

  describe('表情网格测试', () => {
    it('应该显示表情网格', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={5}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      const expressionsTab = screen.getByText('表情')
      await user.click(expressionsTab)

      // 应该显示5个表情
      expect(screen.getByText('表情 1')).toBeInTheDocument()
      expect(screen.getByText('表情 5')).toBeInTheDocument()
    })

    it('没有表情时应该显示空状态', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      const expressionsTab = screen.getByText('表情')
      await user.click(expressionsTab)

      expect(screen.getByText('该模型暂无表情配置')).toBeInTheDocument()
    })
  })

  describe('标签页切换测试', () => {
    it('应该能够切换到动画标签页', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={createMockAnimations()}
          expressionCount={3}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      const animationsTab = screen.getByText('动画')
      await user.click(animationsTab)

      expect(animationsTab).toHaveClass('live2d-control-panel__tab--active')
    })

    it('应该能够切换到表情标签页', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={createMockAnimations()}
          expressionCount={3}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      const expressionsTab = screen.getByText('表情')
      await user.click(expressionsTab)

      expect(expressionsTab).toHaveClass('live2d-control-panel__tab--active')
    })

    it('应该能够切换到设置标签页', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={createMockAnimations()}
          expressionCount={3}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      const settingsTab = screen.getAllByText('设置').find(el => el.className.includes('tab'))
      await user.click(settingsTab!)

      expect(settingsTab).toHaveClass('live2d-control-panel__tab--active')
    })
  })

  describe('模型状态测试', () => {
    it('模型未加载时应该禁用控制按钮', () => {
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState({ loaded: false })}
          animationInfo={null}
          availableAnimations={createMockAnimations()}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const playButton = screen.getByTitle('播放')
      expect(playButton).toBeDisabled()

      const resetButton = screen.getByTitle('重置缩放')
      expect(resetButton).toBeDisabled()
    })

    it('应该显示当前动画信息', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState({ animating: true })}
          animationInfo={createMockAnimationInfo({
            config: {
              type: Live2DAnimationType.HAPPY,
              group: 'happy',
              index: 0
            },
            progress: 0.6
          })}
          availableAnimations={createMockAnimations()}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      expect(screen.getByText('当前播放:')).toBeInTheDocument()
      expect(screen.getByText('进度: 60%')).toBeInTheDocument()
    })
  })

  describe('边界情况测试', () => {
    it('应该处理空的动画列表', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      expect(screen.getByText('该类型暂无可用动画')).toBeInTheDocument()
    })

    it('应该处理expressionCount为0', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      const expressionsTab = screen.getByText('表情')
      await user.click(expressionsTab)

      expect(screen.getByText('该模型暂无表情配置')).toBeInTheDocument()
    })

    it('应该处理null的animationInfo', () => {
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={createMockAnimations()}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      expect(screen.getByTitle('播放')).toBeInTheDocument()
    })

    it('应该处理展开/收起状态切换', async () => {
      const user = userEvent.setup()
      
      const { container } = render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState()}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')

      // 初始状态不应该有expanded class
      let panel = container.querySelector('.live2d-control-panel')
      expect(panel).not.toHaveClass('live2d-control-panel--expanded')

      // 点击展开
      await user.click(settingsButton)
      expect(panel).toHaveClass('live2d-control-panel--expanded')

      // 再次点击收起
      await user.click(settingsButton)
      expect(panel).not.toHaveClass('live2d-control-panel--expanded')
    })
  })

  describe('性能信息测试', () => {
    it('应该显示性能信息', async () => {
      const user = userEvent.setup()
      
      render(
        <Live2DControlPanel
          visible={true}
          controls={createMockControls()}
          modelState={createMockModelState({
            loaded: true,
            interactive: true,
            lastUpdated: new Date('2025-01-01T12:00:00').getTime()
          })}
          animationInfo={null}
          availableAnimations={[]}
          expressionCount={0}
          onPlayAnimation={mockOnPlayAnimation}
          onStopAnimation={mockOnStopAnimation}
          onSetExpression={mockOnSetExpression}
          onResetTransform={mockOnResetTransform}
          onToggleFullscreen={mockOnToggleFullscreen}
          onUpdateSettings={mockOnUpdateSettings}
        />
      )

      const settingsButton = screen.getByTitle('设置')
      await user.click(settingsButton)

      const settingsTab = screen.getAllByText('设置').find(el => el.className.includes('tab'))
      await user.click(settingsTab!)

      expect(screen.getByText(/模型状态:/)).toBeInTheDocument()
      expect(screen.getByText(/已加载/)).toBeInTheDocument()
      expect(screen.getByText(/交互状态:/)).toBeInTheDocument()
      expect(screen.getByText(/启用/)).toBeInTheDocument()
    })
  })
})

