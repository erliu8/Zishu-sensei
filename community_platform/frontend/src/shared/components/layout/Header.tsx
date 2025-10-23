/**
 * Header 头部导航组件
 * 提供网站主导航栏，包含 logo、导航菜单和用户操作
 */

import { cn } from '@/shared/utils'
import React from 'react'
import { Container } from './Container'

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  sticky?: boolean
  transparent?: boolean
  bordered?: boolean
}

export const Header = React.forwardRef<HTMLElement, HeaderProps>(
  ({ className, sticky = true, transparent = false, bordered = true, children, ...props }, ref) => {
    return (
      <header
        ref={ref}
        className={cn(
          'w-full transition-all duration-200',
          sticky && 'sticky top-0 z-50',
          transparent ? 'bg-transparent' : 'bg-white dark:bg-gray-900',
          bordered && 'border-b border-gray-200 dark:border-gray-800',
          'shadow-sm',
          className
        )}
        {...props}
      >
        <Container>
          <div className="flex h-16 items-center justify-between">
            {children}
          </div>
        </Container>
      </header>
    )
  }
)

Header.displayName = 'Header'

// HeaderLogo 子组件
export interface HeaderLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  href?: string
}

export const HeaderLogo = React.forwardRef<HTMLDivElement, HeaderLogoProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center space-x-2 font-bold text-xl', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

HeaderLogo.displayName = 'HeaderLogo'

// HeaderNav 子组件
export interface HeaderNavProps extends React.HTMLAttributes<HTMLElement> {}

export const HeaderNav = React.forwardRef<HTMLElement, HeaderNavProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn('hidden md:flex items-center space-x-6', className)}
        {...props}
      >
        {children}
      </nav>
    )
  }
)

HeaderNav.displayName = 'HeaderNav'

// HeaderActions 子组件
export interface HeaderActionsProps extends React.HTMLAttributes<HTMLDivElement> {}

export const HeaderActions = React.forwardRef<HTMLDivElement, HeaderActionsProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center space-x-4', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

HeaderActions.displayName = 'HeaderActions'

