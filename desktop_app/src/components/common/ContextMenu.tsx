import type { ContextMenuOption } from '@/types/ui'
import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ContextMenuProps {
    visible: boolean
    x: number
    y: number
    options: ContextMenuOption[]
    onClose: () => void
}

/**
 * 上下文菜单组件
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({
    visible,
    x,
    y,
    options,
    onClose,
}) => {
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!visible) return
        
        console.log('🖱️ [ContextMenu] 菜单已显示:', { x, y, optionsCount: options.length })
        
        // 调试：检查菜单元素
        setTimeout(() => {
            if (menuRef.current) {
                const rect = menuRef.current.getBoundingClientRect()
                const computedStyle = window.getComputedStyle(menuRef.current)
                console.log('🖱️ [ContextMenu] 菜单DOM元素:', {
                    exists: !!menuRef.current,
                    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    display: computedStyle.display,
                    visibility: computedStyle.visibility,
                    opacity: computedStyle.opacity,
                    zIndex: computedStyle.zIndex,
                    position: computedStyle.position,
                    pointerEvents: computedStyle.pointerEvents,
                    backgroundColor: computedStyle.backgroundColor,
                    border: computedStyle.border,
                })
                console.log('🖱️ [ContextMenu] 菜单HTML:', menuRef.current.outerHTML.substring(0, 300))
                console.log('🖱️ [ContextMenu] 菜单父元素:', menuRef.current.parentElement?.tagName)
                console.log('🖱️ [ContextMenu] 菜单在body中:', document.body.contains(menuRef.current))
                
                // 检查点击位置的元素
                const elementAtPoint = document.elementFromPoint(x + 10, y + 10)
                console.log('🖱️ [ContextMenu] 菜单位置的元素:', {
                    tagName: elementAtPoint?.tagName,
                    className: elementAtPoint?.className,
                    isMenuElement: elementAtPoint === menuRef.current || menuRef.current.contains(elementAtPoint as Node),
                })
            } else {
                console.error('❌ [ContextMenu] menuRef.current 不存在!')
            }
        }, 100)

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [visible, onClose, x, y, options.length])

    if (!visible) {
        console.log('🖱️ [ContextMenu] 组件不可见，返回 null')
        return null
    }
    
    console.log('🖱️ [ContextMenu] 开始渲染菜单:', { x, y, optionsCount: options.length, visible })

    const renderOption = (option: ContextMenuOption) => {
        if (option.type === 'separator') {
            return (
                <div
                    key={option.id}
                    style={{
                        height: '1px',
                        backgroundColor: 'var(--color-border, #e5e7eb)',
                        margin: '4px 0',
                    }}
                />
            )
        }

        return (
            <div
                key={option.id}
                style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: option.disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'hsl(var(--color-popover-foreground))',
                    opacity: option.disabled ? 0.5 : 1,
                    backgroundColor: option.checked ? 'hsl(var(--color-accent))' : 'transparent',
                }}
                onMouseEnter={(e) => {
                    if (!option.disabled) {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-accent))'
                    }
                }}
                onMouseLeave={(e) => {
                    if (!option.disabled) {
                        e.currentTarget.style.backgroundColor = option.checked ? 'hsl(var(--color-accent))' : 'transparent'
                    }
                }}
                onClick={() => {
                    if (!option.disabled && option.onClick) {
                        option.onClick()
                        onClose()
                    }
                }}
            >
                {option.icon && (
                    <span style={{ fontSize: '16px' }}>{option.icon}</span>
                )}
                <span style={{ flex: 1 }}>{option.label}</span>
                {option.shortcut && (
                    <span style={{ fontSize: '12px', color: 'hsl(var(--color-muted-foreground))' }}>
                        {option.shortcut}
                    </span>
                )}
                {option.checked && (
                    <span style={{ color: 'hsl(var(--color-primary))' }}>✓</span>
                )}
                {option.children && option.children.length > 0 && (
                    <span style={{ color: 'hsl(var(--color-muted-foreground))' }}>▶</span>
                )}
            </div>
        )
    }

    return createPortal(
        <div
            ref={menuRef}
            style={{
                position: 'fixed',
                left: x,
                top: y,
                zIndex: 9999,
                minWidth: '192px',
                backgroundColor: 'hsl(var(--color-popover))',
                border: '1px solid hsl(var(--color-border))',
                borderRadius: '6px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                padding: '4px 0',
                display: 'block',
                visibility: 'visible',
                opacity: 1,
                pointerEvents: 'auto',
            }}
        >
            {options.map(renderOption)}
        </div>,
        document.body
    )
}
