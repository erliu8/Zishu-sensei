import type { ContextMenuOption } from '@/types/ui'
import clsx from 'clsx'
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
    }, [visible, onClose])

    if (!visible) return null

    const renderOption = (option: ContextMenuOption) => {
        if (option.type === 'divider') {
            return (
                <div
                    key={option.id}
                    className="h-px bg-gray-200 dark:bg-gray-700 my-1"
                />
            )
        }

        return (
            <div
                key={option.id}
                className={clsx(
                    'px-3 py-2 text-sm cursor-pointer flex items-center gap-2',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    'text-gray-700 dark:text-gray-300',
                    {
                        'opacity-50 cursor-not-allowed': option.disabled,
                        'bg-blue-50 dark:bg-blue-900/20': option.checked,
                    },
                    option.className
                )}
                onClick={() => {
                    if (!option.disabled && option.onClick) {
                        option.onClick()
                        onClose()
                    }
                }}
            >
                {option.icon && (
                    <span className="text-base">{option.icon}</span>
                )}
                <span className="flex-1">{option.label}</span>
                {option.shortcut && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {option.shortcut}
                    </span>
                )}
                {option.checked && (
                    <span className="text-blue-600 dark:text-blue-400">✓</span>
                )}
                {option.submenu && (
                    <span className="text-gray-400">▶</span>
                )}
            </div>
        )
    }

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-48"
            style={{
                left: x,
                top: y,
            }}
        >
            {options.map(renderOption)}
        </div>,
        document.body
    )
}
