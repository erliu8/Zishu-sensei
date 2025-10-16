import React, { CSSProperties } from 'react'

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    style?: CSSProperties
    color?: 'primary' | 'secondary' | 'white' | 'gray'
}

/**
 * 加载动画组件
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    style,
    color = 'primary',
}) => {
    const sizeMap = {
        sm: 16,
        md: 24,
        lg: 32,
        xl: 48,
    }

    const colorMap = {
        primary: 'hsl(var(--color-primary))',
        secondary: 'hsl(var(--color-muted-foreground))',
        white: '#ffffff',
        gray: 'hsl(var(--color-muted-foreground))',
    }

    const spinnerSize = sizeMap[size]
    const spinnerColor = colorMap[color]

    return (
        <div
            style={{
                width: spinnerSize,
                height: spinnerSize,
                border: '2px solid',
                borderColor: spinnerColor,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                ...style,
            }}
            role="status"
            aria-label="加载中"
        >
            <span style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
            }}>加载中...</span>
        </div>
    )
}
