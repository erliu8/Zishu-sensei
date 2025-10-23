/**
 * Grid 栅格布局组件
 * 提供响应式的栅格系统，支持不同的列数和间距
 */

import { cn } from '@/shared/utils'
import { VariantProps, cva } from 'class-variance-authority'
import React from 'react'

const gridVariants = cva('grid w-full', {
  variants: {
    cols: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
      12: 'grid-cols-12',
    },
    gap: {
      none: 'gap-0',
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-8',
    },
  },
  defaultVariants: {
    cols: 3,
    gap: 'md',
  },
})

export interface GridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof gridVariants> {
  as?: React.ElementType
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols, gap, as: Component = 'div', children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(gridVariants({ cols, gap }), className)}
        {...props}
      >
        {children}
      </Component>
    )
  }
)

Grid.displayName = 'Grid'

// GridItem 子组件
export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  colSpan?: 1 | 2 | 3 | 4 | 6 | 12 | 'full'
  rowSpan?: 1 | 2 | 3 | 4 | 6 | 'full'
}

export const GridItem = React.forwardRef<HTMLDivElement, GridItemProps>(
  ({ className, colSpan = 1, rowSpan = 1, children, ...props }, ref) => {
    const colSpanClass =
      colSpan === 'full'
        ? 'col-span-full'
        : colSpan === 1
          ? ''
          : `col-span-${colSpan}`

    const rowSpanClass =
      rowSpan === 'full'
        ? 'row-span-full'
        : rowSpan === 1
          ? ''
          : `row-span-${rowSpan}`

    return (
      <div ref={ref} className={cn(colSpanClass, rowSpanClass, className)} {...props}>
        {children}
      </div>
    )
  }
)

GridItem.displayName = 'GridItem'

