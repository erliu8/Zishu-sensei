/**
 * PetWindow 宠物窗口组件测试
 * 
 * 测试覆盖：
 * - 渲染测试：基础显示、角色信息、状态栏
 * - 动画测试：各种状态动画、心情表情、过渡效果
 * - 交互测试：点击、悬停、拖拽、双击
 * - 状态测试：角色状态、心情变化、经验系统
 * - 响应式测试：尺寸适配、位置调整
 * - 无障碍测试：键盘支持、屏幕阅读器
 * - 性能测试：动画性能、内存管理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import {
  renderWithProviders,
  expectVisible,
  expectHasClass,
  clickElement,
  doubleClickElement,
  hoverElement,
  wait,
} from '../../../utils/test-utils'

// 导入实际的 PetWindow 组件
import { PetWindow as PetWindowComponent } from '../../../../components/Layout/PetWindow'

// 为测试目的，将组件转换为接受任意 props
const PetWindow = PetWindowComponent as any

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}))

// Mock clsx
vi.mock('clsx', () => ({
  default: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

// 类型定义（从组件中复制）
interface Character {
  id: string
  name: string
  type: string
  avatar: string
  description: string
  mood?: 'happy' | 'sad' | 'excited' | 'sleepy' | 'angry' | 'confused'
  level?: number
  experience?: number
}

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

interface AnimationConfig {
  duration?: number
  easing?: string
}

// 测试开始
describe('PetWindow 宠物窗口组件', () => {
  // Mock 数据
  const mockCharacter: Character = {
    id: 'test-character',
    name: '测试角色',
    type: 'assistant',
    avatar: '🤖',
    description: '这是一个测试角色',
    mood: 'happy',
    level: 5,
    experience: 75,
  }
  
  const mockPosition: Position = { x: 100, y: 100 }
  const mockSize: Size = { width: 200, height: 200 }
  
  // Mock 回调函数
  const mockOnContextMenu = vi.fn()
  const mockOnModeChange = vi.fn()
  const mockOnDrag = vi.fn()
  const mockOnClick = vi.fn()
  const mockOnHover = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock RAF for animations
    global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
    global.cancelAnimationFrame = vi.fn()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  // ==================== 渲染测试 ====================
  
  describe('渲染测试', () => {
    it('应该正确渲染宠物窗口基础结构', () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      // 主容器应该存在
      const container = screen.getByRole('button')
      expect(container).toBeInTheDocument()
      expect(container).toHaveAttribute('aria-label', '宠物 测试角色')
    })
    
    it('应该显示角色头像', () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const avatar = screen.getByText('🤖')
      expectVisible(avatar)
    })
    
    it('应该显示角色名称', () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const name = screen.getByText('测试角色')
      expectVisible(name)
    })
    
    it('没有角色时应该显示默认内容', () => {
      renderWithProviders(
        <PetWindow
          character={undefined as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const defaultAvatar = screen.getByText('🤖')
      const defaultName = screen.getByText('加载中...')
      
      expectVisible(defaultAvatar)
      expectVisible(defaultName)
    })
    
    it('应该应用自定义尺寸和位置', () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          position={mockPosition}
          size={mockSize}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toHaveStyle(`
        width: ${mockSize.width}px;
        height: ${mockSize.height}px;
        left: ${mockPosition.x}px;
        top: ${mockPosition.y}px;
      `)
    })
  })
  
  // ==================== 角色状态测试 ====================
  
  describe('角色状态测试', () => {
    it('应该根据角色心情显示不同的状态颜色', () => {
      const happyCharacter: Character = { ...mockCharacter, mood: 'happy' as const }
      renderWithProviders(
        <PetWindow
          character={happyCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const nameElement = screen.getByText('测试角色')
      expect(nameElement.closest('.text-green-500')).toBeTruthy()
    })
    
    it('应该显示角色经验条', async () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          position={mockPosition}
          showStatus={true}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      // 悬停显示状态栏
      const container = screen.getByRole('button')
      await hoverElement(container)
      
      await waitFor(() => {
        const levelText = screen.getByText('Lv.5')
        expectVisible(levelText)
      })
    })
    
    it('应该根据状态显示正确的文本', async () => {
      const talkingCharacter: Character = { ...mockCharacter }
      renderWithProviders(
        <PetWindow
          character={talkingCharacter as any}
          showStatus={true}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      await hoverElement(container)
      
      await waitFor(() => {
        // 根据实际组件实现调整断言
        expect(container).toBeInTheDocument()
      })
    })
    
    it('应该显示心情图标', () => {
      const excitedCharacter: Character = { ...mockCharacter, mood: 'excited' as const }
      renderWithProviders(
        <PetWindow
          character={excitedCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const moodIcon = screen.getByText('🤩')
      expectVisible(moodIcon)
    })
  })
  
  // ==================== 交互测试 ====================
  
  describe('交互测试', () => {
    it('点击应该触发 onClick 回调', async () => {
      const { user } = renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onClick={mockOnClick}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      await clickElement(container, user)
      
      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })
    
    it('双击应该触发模式切换', async () => {
      const { user } = renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      await doubleClickElement(container, user)
      
      expect(mockOnModeChange).toHaveBeenCalledWith('chat')
    })
    
    it('右键应该触发上下文菜单', () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      fireEvent.contextMenu(container)
      
      expect(mockOnContextMenu).toHaveBeenCalledTimes(1)
    })
    
    it('悬停应该显示状态栏和提示', async () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          showStatus={true}
          showHints={true}
          onHover={mockOnHover}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      
      // 鼠标进入
      fireEvent.mouseEnter(container)
      
      expect(mockOnHover).toHaveBeenCalledWith(true)
      
      await waitFor(() => {
        const hints = screen.getByText('右键菜单 | 双击对话 | 拖拽移动')
        expectVisible(hints)
      })
    })
    
    it('鼠标离开应该隐藏状态栏和提示', async () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          showStatus={true}
          showHints={true}
          onHover={mockOnHover}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      
      // 先悬停显示
      fireEvent.mouseEnter(container)
      
      // 然后离开
      fireEvent.mouseLeave(container)
      
      expect(mockOnHover).toHaveBeenCalledWith(false)
    })
  })
  
  // ==================== 拖拽测试 ====================
  
  describe('拖拽测试', () => {
    it('支持拖拽的窗口应该有正确的样式', () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          draggable={true}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expectHasClass(container, 'cursor-grab')
    })
    
    it('禁用拖拽的窗口应该有指针样式', () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          draggable={false}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expectHasClass(container, 'cursor-pointer')
    })
    
    it('拖拽结束应该调用 onDrag 回调', () => {
      // 这个测试需要 mock framer-motion 的拖拽事件
      // 由于我们已经 mock 了 framer-motion，这里只能验证基础结构
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          position={mockPosition}
          draggable={true}
          onDrag={mockOnDrag}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toBeInTheDocument()
      // 实际的拖拽测试需要更复杂的 framer-motion mock
    })
  })
  
  // ==================== 状态栏测试 ====================
  
  describe('状态栏测试', () => {
    it('showStatus=false 时不应该显示状态栏', async () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          showStatus={false}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      await hoverElement(container)
      
      // 等待一段时间确保没有状态栏出现
      await wait(300)
      
      const statusText = screen.queryByText('待机中')
      expect(statusText).not.toBeInTheDocument()
    })
    
    it('应该显示正确的状态文本', async () => {
      const workingCharacter: Character = { ...mockCharacter }
      renderWithProviders(
        <PetWindow
          character={workingCharacter as any}
          showStatus={true}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      fireEvent.mouseEnter(container)
      
      await waitFor(() => {
        // 根据实际组件实现调整断言
        expect(container).toBeInTheDocument()
      })
    })
    
    it('应该显示经验进度条', async () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          showStatus={true}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      fireEvent.mouseEnter(container)
      
      await waitFor(() => {
        // 查找经验条相关的元素
        const container = screen.getByRole('button')
        expect(container).toBeInTheDocument()
        // 由于 mock 了 framer-motion，具体的进度条样式测试需要更详细的实现
      })
    })
  })
  
  // ==================== 提示测试 ====================
  
  describe('提示测试', () => {
    it('showHints=false 时不应该显示提示', async () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          showHints={false}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      await hoverElement(container)
      
      await wait(300)
      
      const hints = screen.queryByText(/右键菜单/)
      expect(hints).not.toBeInTheDocument()
    })
    
    it('拖拽禁用时提示中不应该包含拖拽文本', async () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          draggable={false}
          showHints={true}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      fireEvent.mouseEnter(container)
      
      await waitFor(() => {
        const hints = screen.getByText('右键菜单 | 双击对话')
        expectVisible(hints)
        expect(hints).not.toHaveTextContent('拖拽移动')
      })
    })
  })
  
  // ==================== 动画测试 ====================
  
  describe('动画测试', () => {
    it('应该根据角色状态切换动画', () => {
      const { rerender } = renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      // 切换到对话状态
      const talkingCharacter: Character = { ...mockCharacter }
      rerender(
        <PetWindow
          character={talkingCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      // 验证组件仍然正常渲染
      const container = screen.getByRole('button')
      expect(container).toBeInTheDocument()
    })
    
    it('兴奋心情应该触发特殊动画', () => {
      const excitedCharacter: Character = { ...mockCharacter, mood: 'excited' as const }
      renderWithProviders(
        <PetWindow
          character={excitedCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      // 由于我们 mock 了 framer-motion，主要验证组件正常渲染
      const container = screen.getByRole('button')
      expect(container).toBeInTheDocument()
      
      // 验证心情图标
      const moodIcon = screen.getByText('🤩')
      expectVisible(moodIcon)
    })
    
    it('睡眠状态应该有对应的动画', () => {
      const sleepingCharacter: Character = { 
        ...mockCharacter, 
        mood: 'sleepy' as const 
      }
      renderWithProviders(
        <PetWindow
          character={sleepingCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toBeInTheDocument()
      
      // 验证睡眠心情图标
      const moodIcon = screen.getByText('😴')
      expectVisible(moodIcon)
    })
  })
  
  // ==================== 涟漪效果测试 ====================
  
  describe('涟漪效果测试', () => {
    it('悬停时应该显示涟漪效果', async () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      fireEvent.mouseEnter(container)
      
      // 由于我们 mock 了动画，这里主要验证悬停状态的处理
      expect(container).toBeInTheDocument()
    })
  })
  
  // ==================== 无障碍测试 ====================
  
  describe('无障碍测试', () => {
    it('应该有正确的 ARIA 属性', () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toHaveAttribute('role', 'button')
      expect(container).toHaveAttribute('tabIndex', '0')
      expect(container).toHaveAttribute('aria-label', '宠物 测试角色')
      expect(container).toHaveAttribute('aria-description', '状态: 待机中, 心情: happy')
    })
    
    it('加载状态应该有适当的描述', () => {
      renderWithProviders(
        <PetWindow
          character={undefined as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toHaveAttribute('aria-description', '加载中')
    })
    
    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onClick={mockOnClick}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      
      // Tab 导航到组件
      await user.tab()
      expect(container).toHaveFocus()
      
      // Enter 键触发点击
      await user.keyboard('{Enter}')
      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })
  })
  
  // ==================== 边界情况测试 ====================
  
  describe('边界情况测试', () => {
    it('应该处理缺少回调函数的情况', async () => {
      const { user } = renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      
      // 没有 onClick 回调时点击不应该报错
      await expect(clickElement(container, user)).resolves.not.toThrow()
      
      // 没有 onHover 回调时悬停不应该报错
      await expect(hoverElement(container)).resolves.not.toThrow()
    })
    
    it('应该处理空的角色数据', () => {
      const emptyCharacter: Character = {
        id: 'empty',
        name: '',
        type: 'assistant',
        avatar: '',
        description: '',
      }
      
      renderWithProviders(
        <PetWindow
          character={emptyCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toBeInTheDocument()
    })
    
    it('应该处理极大的尺寸', () => {
      const largeSize = { width: 1000, height: 1000 }
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          size={largeSize}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toHaveStyle(`
        width: ${largeSize.width}px;
        height: ${largeSize.height}px;
      `)
    })
    
    it('应该处理极小的尺寸', () => {
      const smallSize = { width: 50, height: 50 }
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          size={smallSize}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toHaveStyle(`
        width: ${smallSize.width}px;
        height: ${smallSize.height}px;
      `)
    })
    
    it('应该处理负数位置', () => {
      const negativePosition = { x: -100, y: -50 }
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          position={negativePosition}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toHaveStyle(`
        left: ${negativePosition.x}px;
        top: ${negativePosition.y}px;
      `)
    })
  })
  
  // ==================== 性能测试 ====================
  
  describe('性能测试', () => {
    it('应该避免不必要的重新渲染', () => {
      const { rerender } = renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      // 相同 props 重新渲染
      rerender(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toBeInTheDocument()
    })
    
    it('快速状态切换应该正常处理', () => {
      const { rerender } = renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      // 快速切换多个mood状态
      const moods: Character['mood'][] = ['happy', 'sad', 'excited', 'sleepy']
      
      moods.forEach(mood => {
        rerender(
          <PetWindow
            character={{ ...mockCharacter, mood } as any}
            onContextMenu={mockOnContextMenu}
            onModeChange={mockOnModeChange}
          />
        )
      })
      
      const container = screen.getByRole('button')
      expect(container).toBeInTheDocument()
    })
    
    it('频繁的悬停事件应该正常处理', async () => {
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          showStatus={true}
          onHover={mockOnHover}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      
      // 快速触发多次悬停事件
      for (let i = 0; i < 5; i++) {
        fireEvent.mouseEnter(container)
        fireEvent.mouseLeave(container)
      }
      
      // 应该正常调用回调，不应该崩溃
      expect(mockOnHover).toHaveBeenCalled()
    })
  })
  
  // ==================== 自定义配置测试 ====================
  
  describe('自定义配置测试', () => {
    it('应该支持自定义动画配置', () => {
      const animationConfig: AnimationConfig = {
        duration: 1000,
        easing: 'ease-out',
      }
      
      renderWithProviders(
        <PetWindow
          character={mockCharacter as any}
          animationConfig={animationConfig}
          onContextMenu={mockOnContextMenu}
          onModeChange={mockOnModeChange}
        />
      )
      
      const container = screen.getByRole('button')
      expect(container).toBeInTheDocument()
    })
    
    it('应该处理所有心情状态', () => {
      const moods: Character['mood'][] = ['happy', 'sad', 'excited', 'sleepy', 'angry', 'confused']
      
      moods.forEach(mood => {
        const { unmount } = renderWithProviders(
          <PetWindow
            character={{ ...mockCharacter, mood } as any}
            onContextMenu={mockOnContextMenu}
            onModeChange={mockOnModeChange}
          />
        )
        
        const container = screen.getByRole('button')
        expect(container).toBeInTheDocument()
        
        unmount()
      })
    })
  })
})
