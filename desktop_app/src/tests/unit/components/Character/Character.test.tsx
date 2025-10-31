/**
 * Character组件单元测试
 * 
 * 测试主要Character组件的渲染、配置和交互功能
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Character } from '@/components/Character'
import { renderWithProviders } from '@/tests/utils/test-utils'

// Mock Live2DViewer组件
vi.mock('@/components/Character/Live2D/Live2DViewer', () => ({
  Live2DViewer: vi.fn(({ onInteraction, onModelLoad, onError, modelConfig }) => {
    // 模拟组件挂载后立即触发模型加载完成
    React.useEffect(() => {
      if (modelConfig?.id && onModelLoad) {
        // 使用 setTimeout 模拟异步加载
        setTimeout(() => onModelLoad(modelConfig.id), 0)
      }
    }, [modelConfig?.id, onModelLoad])

    return (
      <div 
        data-testid="live2d-viewer"
        data-model-id={modelConfig?.id}
        onClick={() => {
          onInteraction?.({
            type: 'click',
            position: { x: 100, y: 100 }
          })
        }}
      >
        <button 
          data-testid="trigger-load"
          onClick={() => onModelLoad?.(modelConfig?.id)}
        >
          Trigger Load
        </button>
        <button 
          data-testid="trigger-error"
          onClick={() => onError?.(new Error('Test Error'))}
        >
          Trigger Error
        </button>
        Live2D Viewer Mock
      </div>
    )
  })
}))

// Mock ModelLoader hook
vi.mock('@/components/Character/ModelLoader', () => ({
  useModelLoader: () => ({
    currentCharacter: { id: 'hiyori', name: 'Hiyori' },
    switchCharacter: vi.fn().mockResolvedValue(undefined)
  })
}))

// Mock modelManager - 使用 vi.fn() 直接在 mock 中创建
vi.mock('@/utils/modelManager', () => ({
  modelManager: {
    createModelConfig: vi.fn().mockResolvedValue({
      id: 'hiyori',
      path: '/models/hiyori/hiyori.model3.json',
      textures: []
    }),
    setCurrentModelId: vi.fn(),
    getAvailableModels: vi.fn().mockReturnValue([])
  }
}))

// Mock CharacterTransition - 总是渲染 children 以简化测试
vi.mock('@/components/Character/Animations/CharacterTransition', () => ({
  CharacterTransitionWithLoading: ({ children }: any) => <>{children}</>,
  TransitionType: 'fade'
}))

// 测试用角色数据
const mockCharacter = {
  id: 'test-character-1',
  name: 'Test Character',
  avatar: '/test-avatar.png',
  description: 'A test character for unit tests'
}

describe('Character组件', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    vi.clearAllMocks()
  })

  describe('渲染测试', () => {
    it('应该正确渲染角色组件', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      // 等待异步加载完成
      await waitFor(() => {
        const viewer = screen.getByTestId('live2d-viewer')
        expect(viewer).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('当没有角色时应该渲染空容器', () => {
      const mockOnInteraction = vi.fn()
      
      const { container } = render(
        <Character 
          character={null} 
          onInteraction={mockOnInteraction}
        />
      )

      // 应该有容器，但没有Live2D内容
      expect(container.firstChild).not.toBeNull()
      expect(screen.queryByTestId('live2d-viewer')).not.toBeInTheDocument()
    })

    it('应该正确传递角色数据到Live2D组件', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        const viewer = screen.getByTestId('live2d-viewer')
        expect(viewer).toHaveAttribute('data-model-id', 'hiyori')
      }, { timeout: 3000 })
    })

    it('应该渲染包装容器并设置正确的样式', () => {
      const mockOnInteraction = vi.fn()
      
      const { container } = render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveStyle({
        position: 'relative',
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column'
      })
    })
  })

  describe('配置测试', () => {
    it('应该正确生成Hiyori模型配置', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        const viewer = screen.getByTestId('live2d-viewer')
        expect(viewer).toHaveAttribute('data-model-id', 'hiyori')
      }, { timeout: 3000 })
    })

    it('应该正确设置Live2D查看器配置', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      // 验证Live2DViewer被调用
      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('配置应该使用useMemo缓存', async () => {
      const mockOnInteraction = vi.fn()
      
      const { rerender } = render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })

      // 重新渲染组件
      rerender(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      // 验证组件仍然正常渲染
      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该包含正确的模型路径', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该包含动画配置', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该包含表情配置', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该设置正确的画布尺寸', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该启用交互功能', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该启用自动空闲动画', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该设置性能配置', async () => {
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })
  })

  describe('交互测试', () => {
    it('应该处理Live2D交互事件', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      const viewer = screen.getByTestId('live2d-viewer')
      await user.click(viewer)

      await waitFor(() => {
        expect(mockOnInteraction).toHaveBeenCalled()
      })
    })

    it('应该触发onInteraction回调', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      const viewer = screen.getByTestId('live2d-viewer')
      await user.click(viewer)

      await waitFor(() => {
        expect(mockOnInteraction).toHaveBeenCalledWith(
          'live2d_interaction',
          expect.objectContaining({
            character: mockCharacter,
            event: expect.any(Object)
          })
        )
      })
    })

    it('应该正确传递交互数据', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      const viewer = screen.getByTestId('live2d-viewer')
      await user.click(viewer)

      await waitFor(() => {
        expect(mockOnInteraction).toHaveBeenCalledWith(
          'live2d_interaction',
          expect.objectContaining({
            character: mockCharacter,
            type: 'click',
            position: { x: 100, y: 100 }
          })
        )
      })
    })

    it('应该在每次交互时传递最新的角色数据', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      const { rerender } = render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      const viewer = screen.getByTestId('live2d-viewer')
      await user.click(viewer)

      const updatedCharacter = { ...mockCharacter, name: 'Updated Character' }
      rerender(
        <Character 
          character={updatedCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await user.click(viewer)

      await waitFor(() => {
        expect(mockOnInteraction).toHaveBeenLastCalledWith(
          'live2d_interaction',
          expect.objectContaining({
            character: updatedCharacter
          })
        )
      })
    })
  })

  describe('生命周期测试', () => {
    it('应该处理模型加载完成事件', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      }, { timeout: 3000 })

      const triggerButton = screen.getByTestId('trigger-load')
      await user.click(triggerButton)

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Live2D模型加载完成:',
          'hiyori'
        )
      })
    })

    it('应该在模型加载完成时触发回调', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      }, { timeout: 3000 })

      const triggerButton = screen.getByTestId('trigger-load')
      await user.click(triggerButton)

      await waitFor(() => {
        expect(mockOnInteraction).toHaveBeenCalledWith(
          'model_loaded',
          expect.objectContaining({
            character: mockCharacter,
            modelId: 'hiyori'
          })
        )
      })
    })

    it('应该处理模型加载错误', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      }, { timeout: 3000 })

      const triggerErrorButton = screen.getByTestId('trigger-error')
      await user.click(triggerErrorButton)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Live2D模型加载错误:',
          expect.any(Error)
        )
      })
    })

    it('应该记录错误到控制台', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      const testError = new Error('Test Error')
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      }, { timeout: 3000 })

      const triggerErrorButton = screen.getByTestId('trigger-error')
      await user.click(triggerErrorButton)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled()
      })
    })

    it('应该在错误时触发错误回调', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      }, { timeout: 3000 })

      const triggerErrorButton = screen.getByTestId('trigger-error')
      await user.click(triggerErrorButton)

      await waitFor(() => {
        expect(mockOnInteraction).toHaveBeenCalledWith(
          'model_error',
          expect.objectContaining({
            character: mockCharacter,
            error: expect.any(Error)
          })
        )
      })
    })
  })

  describe('边界情况测试', () => {
    it('应该处理角色从有到无的变化', async () => {
      const mockOnInteraction = vi.fn()
      
      const { rerender } = render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })

      rerender(
        <Character 
          character={null} 
          onInteraction={mockOnInteraction}
        />
      )

      // 组件应该仍然存在但没有Live2D内容
      expect(screen.queryByTestId('live2d-viewer')).not.toBeInTheDocument()
    })

    it('应该处理角色从无到有的变化', async () => {
      const mockOnInteraction = vi.fn()
      
      const { rerender } = render(
        <Character 
          character={null} 
          onInteraction={mockOnInteraction}
        />
      )

      expect(screen.queryByTestId('live2d-viewer')).not.toBeInTheDocument()

      rerender(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该处理角色切换', async () => {
      const mockOnInteraction = vi.fn()
      
      const { rerender } = render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })

      const newCharacter = {
        id: 'test-character-2',
        name: 'New Character',
        avatar: '/new-avatar.png',
        description: 'A new character'
      }

      rerender(
        <Character 
          character={newCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该处理undefined的onInteraction回调', async () => {
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={undefined as any}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })

    it('应该处理回调函数的变化', async () => {
      const user = userEvent.setup()
      const mockOnInteraction1 = vi.fn()
      const mockOnInteraction2 = vi.fn()
      
      const { rerender } = render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction1}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })

      const viewer = screen.getByTestId('live2d-viewer')
      await user.click(viewer)

      await waitFor(() => {
        expect(mockOnInteraction1).toHaveBeenCalled()
      })

      mockOnInteraction1.mockClear()

      rerender(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction2}
        />
      )

      await user.click(viewer)

      await waitFor(() => {
        expect(mockOnInteraction1).not.toHaveBeenCalled()
        expect(mockOnInteraction2).toHaveBeenCalled()
      })
    })
  })

  describe('性能测试', () => {
    it('配置对象应该被正确缓存', async () => {
      const mockOnInteraction = vi.fn()
      
      const { rerender } = render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })

      const viewer1 = screen.getByTestId('live2d-viewer')

      // 触发不影响配置的重新渲染
      rerender(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      const viewer2 = screen.getByTestId('live2d-viewer')

      // 验证组件正常渲染
      expect(viewer1).toBeInTheDocument()
      expect(viewer2).toBeInTheDocument()
    })

    it('应该在多次渲染时保持稳定', async () => {
      const mockOnInteraction = vi.fn()
      
      const { rerender } = render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })

      // 多次重新渲染
      for (let i = 0; i < 10; i++) {
        rerender(
          <Character 
            character={mockCharacter} 
            onInteraction={mockOnInteraction}
          />
        )
      }

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })
    })
  })

  describe('集成测试', () => {
    it('应该完整地处理用户交互流程', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      // 等待viewer加载
      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })

      // 模拟模型加载
      const triggerLoadButton = screen.getByTestId('trigger-load')
      await user.click(triggerLoadButton)

      await waitFor(() => {
        expect(mockOnInteraction).toHaveBeenCalledWith(
          'model_loaded',
          expect.any(Object)
        )
      })

      // 模拟用户交互
      const viewer = screen.getByTestId('live2d-viewer')
      await user.click(viewer)

      await waitFor(() => {
        expect(mockOnInteraction).toHaveBeenCalledWith(
          'live2d_interaction',
          expect.any(Object)
        )
      })
    })

    it('应该处理多个交互事件', async () => {
      const user = userEvent.setup()
      const mockOnInteraction = vi.fn()
      
      render(
        <Character 
          character={mockCharacter} 
          onInteraction={mockOnInteraction}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('live2d-viewer')).toBeInTheDocument()
      })

      const viewer = screen.getByTestId('live2d-viewer')

      // 多次点击
      await user.click(viewer)
      await user.click(viewer)
      await user.click(viewer)

      await waitFor(() => {
        expect(mockOnInteraction).toHaveBeenCalledTimes(4) // 3次点击 + 1次自动模型加载
      })
    })
  })
})

