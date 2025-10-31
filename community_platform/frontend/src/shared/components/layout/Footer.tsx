/**
 * Footer 页脚组件
 * 提供网站底部信息展示，包含链接、版权声明等
 */

import { cn } from '@/shared/utils'
import React from 'react'
import { Container } from './Container'

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  bordered?: boolean
}

export const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ className, bordered = true, children, ...props }, ref) => {
    return (
      <footer
        ref={ref}
        className={cn(
          'w-full bg-muted/30',
          bordered && 'border-t',
          className
        )}
        {...props}
      >
        <Container>
          <div className="py-8">
            {children}
          </div>
        </Container>
      </footer>
    )
  }
)

Footer.displayName = 'Footer'

// FooterSection 子组件
export interface FooterSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
}

export const FooterSection = React.forwardRef<HTMLDivElement, FooterSectionProps>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-4', className)} {...props}>
        {title && (
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {title}
          </h3>
        )}
        <div className="space-y-2">
          {children}
        </div>
      </div>
    )
  }
)

FooterSection.displayName = 'FooterSection'

// FooterLink 子组件
export interface FooterLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}

export const FooterLink = React.forwardRef<HTMLAnchorElement, FooterLinkProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        className={cn(
          'block text-sm text-muted-foreground hover:text-foreground transition-colors',
          className
        )}
        {...props}
      >
        {children}
      </a>
    )
  }
)

FooterLink.displayName = 'FooterLink'

// FooterBottom 子组件
export interface FooterBottomProps extends React.HTMLAttributes<HTMLDivElement> {}

export const FooterBottom = React.forwardRef<HTMLDivElement, FooterBottomProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'pt-8 mt-8 border-t text-sm text-muted-foreground',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

FooterBottom.displayName = 'FooterBottom'

