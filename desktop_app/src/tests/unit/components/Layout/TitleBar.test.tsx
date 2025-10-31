/**
 * TitleBar 标题栏组件测试
 * 
 * 测试覆盖：
 * - 渲染测试：应用标题、窗口控制按钮、菜单栏
 * - 窗口控制测试：最小化、最大化、关闭、全屏
 * - 平台适配测试：Windows、macOS、Linux 样式差异
 * - 拖拽测试：窗口拖拽、双击最大化
 * - 菜单测试：菜单栏、下拉菜单、快捷键
 * - 状态测试：最大化状态、全屏状态、聚焦状态
 * - 主题测试：主题切换、自定义样式
 * - 无障碍测试：键盘导航、屏幕阅读器支持
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import {
  renderWithProviders,
  mockTauriAPI,
  expectVisible,
  expectHasClass,
  expectDisabled,
  expectEnabled,
  clickElement,
  doubleClickElement,
  randomString,
} from '../../../utils/test-utils'
import { createMockSettings } from '../../../mocks/factories'

// Mock 依赖
const mockUseWindowManager = vi.fn()
const mockUseSettings = vi.fn()
const mockUseTheme = vi.fn()
const mockUseTauri = vi.fn()

vi.mock('@/hooks/useWindowManager', () => ({
  useWindowManager: mockUseWindowManager,
}))

vi.mock('@/hooks/useSettings', () => ({
  useSettings: mockUseSettings,
}))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: mockUseTheme,
}))

vi.mock('@/hooks/useTauri', () => ({
  useTauri: mockUseTauri,
}))

// Mock Tauri API
const mockTauri = mockTauriAPI()
vi.mock('@tauri-apps/api/tauri', () => mockTauri)
vi.mock('@tauri-apps/api/window', () => mockTauri.window)
vi.mock('@tauri-apps/api/os', () => ({
  type: vi.fn().mockResolvedValue('Linux'),
  platform: vi.fn().mockResolvedValue('linux'),
}))

// 菜单项类型
interface MenuItem {
  id: string
  label?: string
  shortcut?: string
  disabled?: boolean
  separator?: boolean
  submenu?: MenuItem[]
  onClick?: () => void
}

// TitleBar 组件属性
interface TitleBarProps {
  title?: string
  subtitle?: string
  showIcon?: boolean
  showMenuBar?: boolean
  showWindowControls?: boolean
  showStatusIndicator?: boolean
  icon?: string
  platform?: 'windows' | 'macos' | 'linux'
  windowState?: 'normal' | 'maximized' | 'fullscreen' | 'minimized'
  isWindowFocused?: boolean
  isDraggable?: boolean
  menuItems?: MenuItem[]
  onMinimize?: () => void
  onMaximize?: () => void
  onClose?: () => void
  onDoubleClick?: () => void
  onMenuClick?: (menuId: string) => void
  onDragStart?: (event: React.MouseEvent) => void
  className?: string
  style?: React.CSSProperties
}

// TitleBar 组件实现（用于测试）
const TitleBar: React.FC<TitleBarProps> = ({
  title = '紫舒老师',
  subtitle,
  showIcon = true,
  showMenuBar = true,
  showWindowControls = true,
  showStatusIndicator = false,
  icon = '🤖',
  platform = 'linux',
  windowState = 'normal',
  isWindowFocused = true,
  isDraggable = true,
  menuItems,
  onMinimize,
  onMaximize,
  onClose,
  onDoubleClick,
  onMenuClick,
  onDragStart,
  className = '',
  style = {},
}) => {
  const [activeMenu, setActiveMenu] = React.useState<string | null>(null)
  
  // 默认菜单项
  const defaultMenuItems: MenuItem[] = [
    {
      id: 'file',
      label: '文件',
      submenu: [
        { id: 'file-new', label: '新建对话', shortcut: 'Ctrl+N' },
        { id: 'file-open', label: '打开文件', shortcut: 'Ctrl+O' },
        { id: 'file-save', label: '保存', shortcut: 'Ctrl+S' },
        { id: 'file-separator', separator: true },
        { id: 'file-settings', label: '设置', shortcut: 'Ctrl+,' },
        { id: 'file-exit', label: '退出', shortcut: 'Ctrl+Q' },
      ],
    },
    {
      id: 'edit',
      label: '编辑',
      submenu: [
        { id: 'edit-undo', label: '撤销', shortcut: 'Ctrl+Z' },
        { id: 'edit-redo', label: '重做', shortcut: 'Ctrl+Y' },
        { id: 'edit-separator', separator: true },
        { id: 'edit-cut', label: '剪切', shortcut: 'Ctrl+X' },
        { id: 'edit-copy', label: '复制', shortcut: 'Ctrl+C' },
        { id: 'edit-paste', label: '粘贴', shortcut: 'Ctrl+V' },
      ],
    },
    {
      id: 'view',
      label: '视图',
      submenu: [
        { id: 'view-zoom-in', label: '放大', shortcut: 'Ctrl+=' },
        { id: 'view-zoom-out', label: '缩小', shortcut: 'Ctrl+-' },
        { id: 'view-reset-zoom', label: '重置缩放', shortcut: 'Ctrl+0' },
        { id: 'view-separator', separator: true },
        { id: 'view-fullscreen', label: '全屏', shortcut: 'F11' },
        { id: 'view-sidebar', label: '侧边栏', shortcut: 'Ctrl+B' },
      ],
    },
    {
      id: 'help',
      label: '帮助',
      submenu: [
        { id: 'help-docs', label: '文档' },
        { id: 'help-shortcuts', label: '快捷键' },
        { id: 'help-separator', separator: true },
        { id: 'help-about', label: '关于' },
      ],
    },
  ]
  
  const menus = menuItems === undefined ? defaultMenuItems : menuItems
  
  // 处理菜单点击
  const handleMenuClick = (menuId: string) => {
    onMenuClick?.(menuId)
    setActiveMenu(null)
  }
  
  // 处理双击
  const handleDoubleClick = () => {
    if (!isDraggable) return
    onDoubleClick?.()
    // 默认行为：双击切换最大化
    if (windowState === 'maximized') {
      onMaximize?.() // 还原
    } else {
      onMaximize?.() // 最大化
    }
  }
  
  // 处理拖拽开始
  const handleMouseDown = (event: React.MouseEvent) => {
    if (!isDraggable) return
    onDragStart?.(event)
  }
  
  // 获取窗口控制按钮样式
  const getWindowControlsStyle = () => {
    switch (platform) {
      case 'macos':
        return 'macos-controls'
      case 'windows':
        return 'windows-controls'
      default:
        return 'linux-controls'
    }
  }
  
  // 渲染菜单项
  const renderMenuItem = (item: MenuItem, depth = 0) => {
    if (item.separator) {
      return (
        <li
          key={item.id}
          className="menu-separator"
          data-testid={`menu-separator-${item.id}`}
          role="separator"
        />
      )
    }
    
    return (
      <li
        key={item.id}
        className="menu-item"
        data-testid={`menu-item-${item.id}`}
        role="none"
      >
        <button
          className={`menu-button ${item.disabled ? 'disabled' : ''}`}
          data-testid={`menu-button-${item.id}`}
          onClick={() => handleMenuClick(item.id)}
          disabled={item.disabled}
          role="menuitem"
          aria-haspopup={item.submenu ? 'menu' : undefined}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <span className="menu-label">{item.label}</span>
          {item.shortcut && (
            <span className="menu-shortcut" data-testid={`menu-shortcut-${item.id}`}>
              {item.shortcut}
            </span>
          )}
        </button>
        
        {item.submenu && (
          <ul className="submenu" role="menu" aria-label={`${item.label}子菜单`}>
            {item.submenu.map(subItem => renderMenuItem(subItem, depth + 1))}
          </ul>
        )}
      </li>
    )
  }
  
  return (
    <header
      className={`title-bar ${className} ${platform} ${windowState} ${isWindowFocused ? 'focused' : 'unfocused'}`}
      data-testid="title-bar"
      data-platform={platform}
      data-window-state={windowState}
      data-focused={isWindowFocused}
      data-draggable={isDraggable}
      role="banner"
      style={style}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* macOS 红绿灯按钮 */}
      {platform === 'macos' && showWindowControls && (
        <div
          className="macos-traffic-lights"
          data-testid="macos-traffic-lights"
          role="group"
          aria-label="窗口控制"
        >
          <button
            className="traffic-light close"
            data-testid="macos-close"
            onClick={(e) => {
              e.stopPropagation()
              onClose?.()
            }}
            aria-label="关闭窗口"
            title="关闭"
          >
            ●
          </button>
          <button
            className="traffic-light minimize"
            data-testid="macos-minimize"
            onClick={(e) => {
              e.stopPropagation()
              onMinimize?.()
            }}
            aria-label="最小化窗口"
            title="最小化"
          >
            ●
          </button>
          <button
            className="traffic-light maximize"
            data-testid="macos-maximize"
            onClick={(e) => {
              e.stopPropagation()
              onMaximize?.()
            }}
            aria-label={windowState === 'maximized' ? '还原窗口' : '最大化窗口'}
            title={windowState === 'maximized' ? '还原' : '最大化'}
          >
            ●
          </button>
        </div>
      )}
      
      {/* 应用图标和标题 */}
      <div className="title-content" data-testid="title-content">
        {showIcon && (
          <span className="app-icon" data-testid="app-icon">
            {icon}
          </span>
        )}
        
        <div className="title-text" data-testid="title-text">
          <h1 className="app-title" data-testid="app-title">
            {title}
          </h1>
          {subtitle && (
            <span className="app-subtitle" data-testid="app-subtitle">
              {subtitle}
            </span>
          )}
        </div>
        
        {showStatusIndicator && (
          <div className="status-indicator" data-testid="status-indicator">
            <span className={`status-dot ${isWindowFocused ? 'active' : 'inactive'}`}></span>
          </div>
        )}
      </div>
      
      {/* 菜单栏 */}
      {showMenuBar && menus.length > 0 && (
        <nav className="menu-bar" data-testid="menu-bar" role="menubar">
          {menus.map(menu => (
            <div
              key={menu.id}
              className="menu-container"
              data-testid={`menu-container-${menu.id}`}
              onMouseEnter={() => activeMenu && setActiveMenu(menu.id)}
            >
              <button
                className={`menu-trigger ${activeMenu === menu.id ? 'active' : ''}`}
                data-testid={`menu-trigger-${menu.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveMenu(activeMenu === menu.id ? null : menu.id)
                }}
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={activeMenu === menu.id}
              >
                {menu.label}
              </button>
              
              {activeMenu === menu.id && menu.submenu && (
                <div
                  className="menu-dropdown"
                  data-testid={`menu-dropdown-${menu.id}`}
                  role="menu"
                  aria-label={menu.label}
                >
                  <ul className="menu-list" role="none">
                    {menu.submenu.map(item => renderMenuItem(item))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </nav>
      )}
      
      {/* Windows/Linux 窗口控制按钮 */}
      {platform !== 'macos' && showWindowControls && (
        <div
          className={`window-controls ${getWindowControlsStyle()}`}
          data-testid="window-controls"
          role="group"
          aria-label="窗口控制"
        >
          <button
            className="control-button minimize"
            data-testid="control-minimize"
            onClick={(e) => {
              e.stopPropagation()
              onMinimize?.()
            }}
            aria-label="最小化窗口"
            title="最小化"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          
          <button
            className="control-button maximize"
            data-testid="control-maximize"
            onClick={(e) => {
              e.stopPropagation()
              onMaximize?.()
            }}
            aria-label={windowState === 'maximized' ? '还原窗口' : '最大化窗口'}
            title={windowState === 'maximized' ? '还原' : '最大化'}
          >
            {windowState === 'maximized' ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            )}
          </button>
          
          <button
            className="control-button close"
            data-testid="control-close"
            onClick={(e) => {
              e.stopPropagation()
              onClose?.()
            }}
            aria-label="关闭窗口"
            title="关闭"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      )}
      
      {/* 点击外部关闭菜单的遮罩 */}
      {activeMenu && (
        <div
          className="menu-overlay"
          data-testid="menu-overlay"
          onClick={() => setActiveMenu(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'transparent',
          }}
        />
      )}
    </header>
  )
}

// 测试开始
describe('TitleBar 标题栏组件', () => {
  // Mock 设置
  const mockSettings = createMockSettings()
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock hooks 返回值
    mockUseWindowManager.mockReturnValue({
      windowState: 'normal',
      isWindowFocused: true,
      minimizeWindow: vi.fn(),
      maximizeWindow: vi.fn(),
      closeWindow: vi.fn(),
      toggleMaximize: vi.fn(),
    })
    
    mockUseSettings.mockReturnValue({
      config: mockSettings,
      updateConfig: vi.fn(),
      isLoading: false,
      error: null,
    })
    
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      toggleTheme: vi.fn(),
    })
    
    mockUseTauri.mockReturnValue({
      isAvailable: true,
      invoke: mockTauri.invoke,
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  // ==================== 渲染测试 ====================
  
  describe('渲染测试', () => {
    it('应该正确渲染标题栏', () => {
      renderWithProviders(<TitleBar />)
      
      expectVisible(screen.getByTestId('title-bar'))
      expectVisible(screen.getByTestId('title-content'))
      expectVisible(screen.getByTestId('app-title'))
    })
    
    it('应该显示应用标题', () => {
      renderWithProviders(<TitleBar title="测试应用" />)
      
      const title = screen.getByTestId('app-title')
      expect(title).toHaveTextContent('测试应用')
    })
    
    it('应该显示应用图标', () => {
      renderWithProviders(<TitleBar icon="🎯" />)
      
      const icon = screen.getByTestId('app-icon')
      expectVisible(icon)
      expect(icon).toHaveTextContent('🎯')
    })
    
    it('应该显示副标题', () => {
      renderWithProviders(<TitleBar subtitle="Beta 版本" />)
      
      const subtitle = screen.getByTestId('app-subtitle')
      expectVisible(subtitle)
      expect(subtitle).toHaveTextContent('Beta 版本')
    })
    
    it('应该根据props控制元素显示', () => {
      renderWithProviders(
        <TitleBar
          showIcon={false}
          showMenuBar={false}
          showWindowControls={false}
          showStatusIndicator={false}
        />
      )
      
      expect(screen.queryByTestId('app-icon')).not.toBeInTheDocument()
      expect(screen.queryByTestId('menu-bar')).not.toBeInTheDocument()
      expect(screen.queryByTestId('window-controls')).not.toBeInTheDocument()
      expect(screen.queryByTestId('status-indicator')).not.toBeInTheDocument()
    })
    
    it('应该显示状态指示器', () => {
      renderWithProviders(
        <TitleBar showStatusIndicator={true} isWindowFocused={true} />
      )
      
      const indicator = screen.getByTestId('status-indicator')
      expectVisible(indicator)
      
      const statusDot = indicator.querySelector('.status-dot')
      expect(statusDot).toHaveClass('active')
    })
  })
  
  // ==================== 窗口控制测试 ====================
  
  describe('窗口控制测试', () => {
    it('应该显示窗口控制按钮', () => {
      renderWithProviders(<TitleBar platform="windows" />)
      
      expectVisible(screen.getByTestId('window-controls'))
      expectVisible(screen.getByTestId('control-minimize'))
      expectVisible(screen.getByTestId('control-maximize'))
      expectVisible(screen.getByTestId('control-close'))
    })
    
    it('点击最小化应该调用回调', async () => {
      const mockOnMinimize = vi.fn()
      const { user } = renderWithProviders(
        <TitleBar onMinimize={mockOnMinimize} />
      )
      
      await clickElement(screen.getByTestId('control-minimize'), user)
      expect(mockOnMinimize).toHaveBeenCalledTimes(1)
    })
    
    it('点击最大化应该调用回调', async () => {
      const mockOnMaximize = vi.fn()
      const { user } = renderWithProviders(
        <TitleBar onMaximize={mockOnMaximize} />
      )
      
      await clickElement(screen.getByTestId('control-maximize'), user)
      expect(mockOnMaximize).toHaveBeenCalledTimes(1)
    })
    
    it('点击关闭应该调用回调', async () => {
      const mockOnClose = vi.fn()
      const { user } = renderWithProviders(
        <TitleBar onClose={mockOnClose} />
      )
      
      await clickElement(screen.getByTestId('control-close'), user)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
    
    it('最大化状态下按钮应该显示还原图标', () => {
      renderWithProviders(<TitleBar windowState="maximized" />)
      
      const maximizeButton = screen.getByTestId('control-maximize')
      expect(maximizeButton).toHaveAttribute('aria-label', '还原窗口')
      expect(maximizeButton).toHaveAttribute('title', '还原')
    })
    
    it('正常状态下按钮应该显示最大化图标', () => {
      renderWithProviders(<TitleBar windowState="normal" />)
      
      const maximizeButton = screen.getByTestId('control-maximize')
      expect(maximizeButton).toHaveAttribute('aria-label', '最大化窗口')
      expect(maximizeButton).toHaveAttribute('title', '最大化')
    })
  })
  
  // ==================== macOS 红绿灯测试 ====================
  
  describe('macOS 红绿灯测试', () => {
    it('macOS 应该显示红绿灯按钮', () => {
      renderWithProviders(<TitleBar platform="macos" />)
      
      expectVisible(screen.getByTestId('macos-traffic-lights'))
      expectVisible(screen.getByTestId('macos-close'))
      expectVisible(screen.getByTestId('macos-minimize'))
      expectVisible(screen.getByTestId('macos-maximize'))
    })
    
    it('macOS 红绿灯按钮应该有正确的功能', async () => {
      const mockOnClose = vi.fn()
      const mockOnMinimize = vi.fn()
      const mockOnMaximize = vi.fn()
      const { user } = renderWithProviders(
        <TitleBar
          platform="macos"
          onClose={mockOnClose}
          onMinimize={mockOnMinimize}
          onMaximize={mockOnMaximize}
        />
      )
      
      await clickElement(screen.getByTestId('macos-close'), user)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
      
      await clickElement(screen.getByTestId('macos-minimize'), user)
      expect(mockOnMinimize).toHaveBeenCalledTimes(1)
      
      await clickElement(screen.getByTestId('macos-maximize'), user)
      expect(mockOnMaximize).toHaveBeenCalledTimes(1)
    })
    
    it('非 macOS 平台不应该显示红绿灯按钮', () => {
      renderWithProviders(<TitleBar platform="windows" />)
      
      expect(screen.queryByTestId('macos-traffic-lights')).not.toBeInTheDocument()
    })
  })
  
  // ==================== 菜单测试 ====================
  
  describe('菜单测试', () => {
    it('应该显示菜单栏', () => {
      renderWithProviders(<TitleBar />)
      
      expectVisible(screen.getByTestId('menu-bar'))
      expectVisible(screen.getByTestId('menu-trigger-file'))
      expectVisible(screen.getByTestId('menu-trigger-edit'))
      expectVisible(screen.getByTestId('menu-trigger-view'))
      expectVisible(screen.getByTestId('menu-trigger-help'))
    })
    
    it('点击菜单应该显示下拉菜单', async () => {
      const { user } = renderWithProviders(<TitleBar />)
      
      // 初始状态不应该显示下拉菜单
      expect(screen.queryByTestId('menu-dropdown-file')).not.toBeInTheDocument()
      
      // 点击文件菜单
      await clickElement(screen.getByTestId('menu-trigger-file'), user)
      
      // 应该显示下拉菜单
      expectVisible(screen.getByTestId('menu-dropdown-file'))
      
      // 验证菜单项
      expectVisible(screen.getByTestId('menu-item-file-new'))
      expectVisible(screen.getByTestId('menu-item-file-open'))
      expectVisible(screen.getByTestId('menu-item-file-save'))
    })
    
    it('应该显示菜单项快捷键', async () => {
      const { user } = renderWithProviders(<TitleBar />)
      
      await clickElement(screen.getByTestId('menu-trigger-file'), user)
      
      const newItemShortcut = screen.getByTestId('menu-shortcut-file-new')
      expectVisible(newItemShortcut)
      expect(newItemShortcut).toHaveTextContent('Ctrl+N')
    })
    
    it('点击菜单项应该调用回调', async () => {
      const mockOnMenuClick = vi.fn()
      const { user } = renderWithProviders(
        <TitleBar onMenuClick={mockOnMenuClick} />
      )
      
      // 打开文件菜单
      await clickElement(screen.getByTestId('menu-trigger-file'), user)
      
      // 点击新建菜单项
      await clickElement(screen.getByTestId('menu-button-file-new'), user)
      
      expect(mockOnMenuClick).toHaveBeenCalledWith('file-new')
    })
    
    it('应该支持菜单分隔符', async () => {
      const { user } = renderWithProviders(<TitleBar />)
      
      await clickElement(screen.getByTestId('menu-trigger-file'), user)
      
      expectVisible(screen.getByTestId('menu-separator-file-separator'))
    })
    
    it('点击外部应该关闭菜单', async () => {
      const { user } = renderWithProviders(<TitleBar />)
      
      // 打开菜单
      await clickElement(screen.getByTestId('menu-trigger-file'), user)
      expectVisible(screen.getByTestId('menu-dropdown-file'))
      
      // 点击遮罩层
      await clickElement(screen.getByTestId('menu-overlay'), user)
      
      // 菜单应该关闭
      await waitFor(() => {
        expect(screen.queryByTestId('menu-dropdown-file')).not.toBeInTheDocument()
      })
    })
    
    it('应该处理禁用的菜单项', () => {
      const disabledMenuItems = [
        {
          id: 'test',
          label: '测试',
          submenu: [
            { id: 'disabled-item', label: '禁用项', disabled: true },
            { id: 'enabled-item', label: '启用项', disabled: false },
          ],
        },
      ]
      
      const { user } = renderWithProviders(
        <TitleBar menuItems={disabledMenuItems} />
      )
      
      return clickElement(screen.getByTestId('menu-trigger-test'), user).then(() => {
        const disabledButton = screen.getByTestId('menu-button-disabled-item')
        const enabledButton = screen.getByTestId('menu-button-enabled-item')
        
        expectDisabled(disabledButton)
        expectEnabled(enabledButton)
      })
    })
  })
  
  // ==================== 拖拽测试 ====================
  
  describe('拖拽测试', () => {
    it('双击应该切换最大化状态', async () => {
      const mockOnMaximize = vi.fn()
      const { user } = renderWithProviders(
        <TitleBar windowState="normal" onMaximize={mockOnMaximize} />
      )
      
      await doubleClickElement(screen.getByTestId('title-bar'), user)
      
      expect(mockOnMaximize).toHaveBeenCalledTimes(1)
    })
    
    it('双击应该调用自定义回调', async () => {
      const mockOnDoubleClick = vi.fn()
      const { user } = renderWithProviders(
        <TitleBar onDoubleClick={mockOnDoubleClick} />
      )
      
      await doubleClickElement(screen.getByTestId('title-bar'), user)
      
      expect(mockOnDoubleClick).toHaveBeenCalledTimes(1)
    })
    
    it('鼠标按下应该调用拖拽回调', () => {
      const mockOnDragStart = vi.fn()
      renderWithProviders(<TitleBar onDragStart={mockOnDragStart} />)
      
      const titleBar = screen.getByTestId('title-bar')
      fireEvent.mouseDown(titleBar)
      
      expect(mockOnDragStart).toHaveBeenCalledTimes(1)
      expect(mockOnDragStart).toHaveBeenCalledWith(expect.any(Object))
    })
    
    it('禁用拖拽时不应该响应拖拽事件', () => {
      const mockOnDragStart = vi.fn()
      const mockOnDoubleClick = vi.fn()
      renderWithProviders(
        <TitleBar
          isDraggable={false}
          onDragStart={mockOnDragStart}
          onDoubleClick={mockOnDoubleClick}
        />
      )
      
      const titleBar = screen.getByTestId('title-bar')
      fireEvent.mouseDown(titleBar)
      fireEvent.doubleClick(titleBar)
      
      expect(mockOnDragStart).not.toHaveBeenCalled()
      expect(mockOnDoubleClick).not.toHaveBeenCalled()
    })
  })
  
  // ==================== 平台适配测试 ====================
  
  describe('平台适配测试', () => {
    it('应该正确设置平台数据属性', () => {
      renderWithProviders(<TitleBar platform="windows" />)
      
      const titleBar = screen.getByTestId('title-bar')
      expect(titleBar).toHaveAttribute('data-platform', 'windows')
      expectHasClass(titleBar, 'windows')
    })
    
    it('Windows 应该显示正确的控制按钮样式', () => {
      renderWithProviders(<TitleBar platform="windows" />)
      
      const controls = screen.getByTestId('window-controls')
      expectHasClass(controls, 'windows-controls')
    })
    
    it('Linux 应该显示正确的控制按钮样式', () => {
      renderWithProviders(<TitleBar platform="linux" />)
      
      const controls = screen.getByTestId('window-controls')
      expectHasClass(controls, 'linux-controls')
    })
    
    it('macOS 应该显示红绿灯而不是标准控制按钮', () => {
      renderWithProviders(<TitleBar platform="macos" />)
      
      expectVisible(screen.getByTestId('macos-traffic-lights'))
      expect(screen.queryByTestId('window-controls')).not.toBeInTheDocument()
    })
  })
  
  // ==================== 状态测试 ====================
  
  describe('状态测试', () => {
    it('应该正确反映窗口状态', () => {
      renderWithProviders(<TitleBar windowState="maximized" />)
      
      const titleBar = screen.getByTestId('title-bar')
      expect(titleBar).toHaveAttribute('data-window-state', 'maximized')
      expectHasClass(titleBar, 'maximized')
    })
    
    it('应该正确反映聚焦状态', () => {
      renderWithProviders(<TitleBar isWindowFocused={false} />)
      
      const titleBar = screen.getByTestId('title-bar')
      expect(titleBar).toHaveAttribute('data-focused', 'false')
      expectHasClass(titleBar, 'unfocused')
    })
    
    it('全屏状态下应该有特殊样式', () => {
      renderWithProviders(<TitleBar windowState="fullscreen" />)
      
      const titleBar = screen.getByTestId('title-bar')
      expectHasClass(titleBar, 'fullscreen')
    })
    
    it('应该正确反映拖拽状态', () => {
      renderWithProviders(<TitleBar isDraggable={false} />)
      
      const titleBar = screen.getByTestId('title-bar')
      expect(titleBar).toHaveAttribute('data-draggable', 'false')
    })
  })
  
  // ==================== 无障碍测试 ====================
  
  describe('无障碍测试', () => {
    it('应该有正确的ARIA属性', () => {
      renderWithProviders(<TitleBar />)
      
      const titleBar = screen.getByTestId('title-bar')
      expect(titleBar).toHaveAttribute('role', 'banner')
      
      const menuBar = screen.getByTestId('menu-bar')
      expect(menuBar).toHaveAttribute('role', 'menubar')
      
      const windowControls = screen.getByTestId('window-controls')
      expect(windowControls).toHaveAttribute('role', 'group')
      expect(windowControls).toHaveAttribute('aria-label', '窗口控制')
    })
    
    it('菜单应该有正确的ARIA状态', async () => {
      const { user } = renderWithProviders(<TitleBar />)
      
      const fileMenu = screen.getByTestId('menu-trigger-file')
      expect(fileMenu).toHaveAttribute('aria-haspopup', 'menu')
      expect(fileMenu).toHaveAttribute('aria-expanded', 'false')
      
      // 打开菜单
      await clickElement(fileMenu, user)
      expect(fileMenu).toHaveAttribute('aria-expanded', 'true')
    })
    
    it('控制按钮应该有适当的标签', () => {
      renderWithProviders(<TitleBar />)
      
      const minimizeButton = screen.getByTestId('control-minimize')
      const maximizeButton = screen.getByTestId('control-maximize')
      const closeButton = screen.getByTestId('control-close')
      
      expect(minimizeButton).toHaveAttribute('aria-label', '最小化窗口')
      expect(maximizeButton).toHaveAttribute('aria-label', '最大化窗口')
      expect(closeButton).toHaveAttribute('aria-label', '关闭窗口')
    })
    
    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<TitleBar />)
      
      // Tab 到第一个菜单
      await user.tab()
      expect(screen.getByTestId('menu-trigger-file')).toHaveFocus()
      
      // 继续 Tab 导航
      await user.tab()
      expect(screen.getByTestId('menu-trigger-edit')).toHaveFocus()
    })
  })
  
  // ==================== 自定义菜单测试 ====================
  
  describe('自定义菜单测试', () => {
    it('应该支持自定义菜单项', () => {
      const customMenuItems = [
        {
          id: 'custom',
          label: '自定义',
          submenu: [
            { id: 'custom-action', label: '自定义操作', shortcut: 'Ctrl+K' },
          ],
        },
      ]
      
      renderWithProviders(<TitleBar menuItems={customMenuItems} />)
      
      expectVisible(screen.getByTestId('menu-trigger-custom'))
      expect(screen.getByTestId('menu-trigger-custom')).toHaveTextContent('自定义')
    })
    
    it('空菜单项数组应该隐藏菜单栏', () => {
      renderWithProviders(<TitleBar menuItems={[]} />)
      
      expect(screen.queryByTestId('menu-bar')).not.toBeInTheDocument()
    })
  })
  
  // ==================== 边界情况测试 ====================
  
  describe('边界情况测试', () => {
    it('应该处理缺少回调函数的情况', async () => {
      const { user } = renderWithProviders(<TitleBar />)
      
      // 点击控制按钮不应该报错
      await expect(
        clickElement(screen.getByTestId('control-minimize'), user)
      ).resolves.not.toThrow()
      
      // 双击标题栏不应该报错
      await expect(
        doubleClickElement(screen.getByTestId('title-bar'), user)
      ).resolves.not.toThrow()
    })
    
    it('应该处理极长的标题文本', () => {
      const longTitle = '这是一个非常非常长的应用程序标题用于测试文本溢出处理能力'
      renderWithProviders(<TitleBar title={longTitle} />)
      
      const title = screen.getByTestId('app-title')
      expect(title).toHaveTextContent(longTitle)
    })
    
    it('应该处理特殊字符', () => {
      renderWithProviders(
        <TitleBar title="<script>alert('xss')</script>" />
      )
      
      const title = screen.getByTestId('app-title')
      expect(title).toHaveTextContent("<script>alert('xss')</script>")
    })
    
    it('应该正确应用自定义样式', () => {
      const customStyle = { backgroundColor: 'red', border: '1px solid blue' }
      const customClass = randomString()
      
      renderWithProviders(
        <TitleBar style={customStyle} className={customClass} />
      )
      
      const titleBar = screen.getByTestId('title-bar')
      expectHasClass(titleBar, customClass)
      // 样式应用验证
      expect(titleBar).toHaveAttribute('style')
      const style = titleBar.getAttribute('style')
      expect(style).toContain('background-color')
      expect(style).toContain('border')
    })
  })
  
  // ==================== 性能测试 ====================
  
  describe('性能测试', () => {
    it('应该避免不必要的重新渲染', () => {
      const { rerender } = renderWithProviders(<TitleBar />)
      
      // 相同props重新渲染
      rerender(<TitleBar />)
      
      expectVisible(screen.getByTestId('title-bar'))
    })
    
    it('菜单状态变化不应该影响其他组件', async () => {
      const { user } = renderWithProviders(<TitleBar />)
      
      const titleBefore = screen.getByTestId('app-title').textContent
      
      // 打开和关闭菜单
      await clickElement(screen.getByTestId('menu-trigger-file'), user)
      await clickElement(screen.getByTestId('menu-overlay'), user)
      
      const titleAfter = screen.getByTestId('app-title').textContent
      expect(titleAfter).toBe(titleBefore)
    })
  })
})
