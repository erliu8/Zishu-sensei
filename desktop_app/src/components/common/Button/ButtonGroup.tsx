import * as React from 'react'
import { type ReactElement } from 'react'
import type { ButtonProps } from './index'

interface ButtonGroupProps {
    /** 子按钮元素 */
    children: ReactElement<ButtonProps> | ReactElement<ButtonProps>[]
    /** 按钮组方向 */
    orientation?: 'horizontal' | 'vertical'
    /** 是否为块级元素 */
    block?: boolean
    /** 自定义类名 */
    className?: string
}

// 工具函数：组合类名
const combineClasses = (...classes: (string | undefined | false)[]): string => {
    return classes.filter(Boolean).join(' ')
}

/**
 * 按钮组组件
 * 
 * 用于将多个按钮组合在一起，提供统一的样式和布局
 */
export const ButtonGroup: React.FC<ButtonGroupProps> = ({
    children,
    orientation = 'horizontal',
    block = false,
    className
}) => {
    const childrenArray = React.Children.toArray(children) as ReactElement<ButtonProps>[]

    return React.createElement('div', {
        className: combineClasses(
            'inline-flex',
            orientation === 'horizontal' && 'flex-row',
            orientation === 'vertical' && 'flex-col',
            block && 'w-full',
            className
        ),
        role: 'group'
    }, childrenArray.map((child, index) => {
        const isFirst = index === 0
        const isLast = index === childrenArray.length - 1
        const isMiddle = !isFirst && !isLast

        return React.cloneElement(child, {
            ...child.props,
            key: child.key || index,
            className: combineClasses(
                child.props.className,
                // 水平方向
                orientation === 'horizontal' && !isLast && 'rounded-r-none border-r-0',
                orientation === 'horizontal' && !isFirst && 'rounded-l-none',
                orientation === 'horizontal' && isMiddle && 'rounded-none border-r-0',

                // 垂直方向
                orientation === 'vertical' && !isLast && 'rounded-b-none border-b-0',
                orientation === 'vertical' && !isFirst && 'rounded-t-none',
                orientation === 'vertical' && isMiddle && 'rounded-none border-b-0',

                // 块级
                block && 'flex-1'
            )
        })
    }))
}

export default ButtonGroup