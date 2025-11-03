/**
 * 按钮组件使用示例
 * 
 * 这个文件展示了如何使用Button和ButtonGroup组件
 */

import * as React from 'react'
import { Button, ButtonGroup } from './index'

// 示例组件
export const ButtonExamples: React.FC = () => {
    const [loading, setLoading] = React.useState(false)
    const [count, setCount] = React.useState(0)

    const handleAsyncAction = async () => {
        setLoading(true)
        // 模拟异步操作
        await new Promise(resolve => setTimeout(resolve, 2000))
        setLoading(false)
        setCount(prev => prev + 1)
    }

    return React.createElement('div', {
        className: 'p-8 space-y-8 bg-gray-50 dark:bg-gray-900 min-h-screen'
    }, [
        // 标题
        React.createElement('h1', {
            key: 'title',
            className: 'text-3xl font-bold text-gray-900 dark:text-white mb-8'
        }, '按钮组件示例'),

        // 基础按钮
        React.createElement('section', { key: 'basic', className: 'space-y-4' }, [
            React.createElement('h2', {
                key: 'basic-title',
                className: 'text-xl font-semibold text-gray-800 dark:text-gray-200'
            }, '基础按钮'),
            React.createElement('div', {
                key: 'basic-buttons',
                className: 'flex flex-wrap gap-4'
            }, [
                React.createElement(Button, {
                    key: 'primary',
                    variant: 'primary',
                    onClick: () => console.log('Primary clicked')
                }, 'Primary'),
                React.createElement(Button, {
                    key: 'secondary',
                    variant: 'secondary'
                }, 'Secondary'),
                React.createElement(Button, {
                    key: 'outline',
                    variant: 'outline'
                }, 'Outline'),
                React.createElement(Button, {
                    key: 'ghost',
                    variant: 'ghost'
                }, 'Ghost'),
                React.createElement(Button, {
                    key: 'success',
                    variant: 'success'
                }, 'Success'),
                React.createElement(Button, {
                    key: 'warning',
                    variant: 'warning'
                }, 'Warning'),
                React.createElement(Button, {
                    key: 'error',
                    variant: 'error'
                }, 'Error')
            ])
        ]),

        // 尺寸变体
        React.createElement('section', { key: 'sizes', className: 'space-y-4' }, [
            React.createElement('h2', {
                key: 'sizes-title',
                className: 'text-xl font-semibold text-gray-800 dark:text-gray-200'
            }, '尺寸变体'),
            React.createElement('div', {
                key: 'size-buttons',
                className: 'flex items-center gap-4'
            }, [
                React.createElement(Button, {
                    key: 'sm',
                    size: 'sm'
                }, 'Small'),
                React.createElement(Button, {
                    key: 'md',
                    size: 'md'
                }, 'Medium'),
                React.createElement(Button, {
                    key: 'lg',
                    size: 'lg'
                }, 'Large'),
                React.createElement(Button, {
                    key: 'xl',
                    size: 'xl'
                }, 'Extra Large')
            ])
        ]),

        // 带图标的按钮
        React.createElement('section', { key: 'icons', className: 'space-y-4' }, [
            React.createElement('h2', {
                key: 'icons-title',
                className: 'text-xl font-semibold text-gray-800 dark:text-gray-200'
            }, '带图标的按钮'),
            React.createElement('div', {
                key: 'icon-buttons',
                className: 'flex flex-wrap gap-4'
            }, [
                React.createElement(Button, {
                    key: 'left-icon',
                    icon: '📧'
                }, '发送邮件'),
                React.createElement(Button, {
                    key: 'right-icon',
                    iconRight: '→'
                }, '下一步'),
                React.createElement(Button, {
                    key: 'icon-only',
                    iconOnly: true,
                    icon: '❤️',
                    'aria-label': '喜欢'
                }),
                React.createElement(Button, {
                    key: 'round-icon',
                    iconOnly: true,
                    round: true,
                    icon: '⚙️',
                    'aria-label': '设置'
                })
            ])
        ]),

        // 状态按钮
        React.createElement('section', { key: 'states', className: 'space-y-4' }, [
            React.createElement('h2', {
                key: 'states-title',
                className: 'text-xl font-semibold text-gray-800 dark:text-gray-200'
            }, '按钮状态'),
            React.createElement('div', {
                key: 'state-buttons',
                className: 'flex flex-wrap gap-4'
            }, [
                React.createElement(Button, {
                    key: 'normal',
                    variant: 'primary'
                }, '正常状态'),
                React.createElement(Button, {
                    key: 'disabled',
                    variant: 'primary',
                    disabled: true
                }, '禁用状态'),
                React.createElement(Button, {
                    key: 'loading',
                    variant: 'primary',
                    loading: loading,
                    onClick: handleAsyncAction
                }, loading ? '加载中...' : `点击加载 (${count})`),
                React.createElement(Button, {
                    key: 'block',
                    variant: 'outline',
                    block: true,
                    className: 'mt-4'
                }, '块级按钮')
            ])
        ]),

        // 按钮组
        React.createElement('section', { key: 'groups', className: 'space-y-4' }, [
            React.createElement('h2', {
                key: 'groups-title',
                className: 'text-xl font-semibold text-gray-800 dark:text-gray-200'
            }, '按钮组'),
            React.createElement('div', {
                key: 'button-groups',
                className: 'space-y-4'
            }, [
                React.createElement(ButtonGroup, {
                    key: 'horizontal-group',
                    children: [
                    React.createElement(Button, {
                        key: 'left',
                        variant: 'outline'
                    }, '左侧'),
                    React.createElement(Button, {
                        key: 'center',
                        variant: 'outline'
                    }, '中间'),
                    React.createElement(Button, {
                        key: 'right',
                        variant: 'outline'
                    }, '右侧')
                ]}),
                React.createElement(ButtonGroup, {
                    key: 'vertical-group',
                    orientation: 'vertical',
                    children: [
                    React.createElement(Button, {
                        key: 'top',
                        variant: 'ghost'
                    }, '顶部'),
                    React.createElement(Button, {
                        key: 'middle',
                        variant: 'ghost'
                    }, '中间'),
                    React.createElement(Button, {
                        key: 'bottom',
                        variant: 'ghost'
                    }, '底部')
                ]})
            ])
        ])
    ])
}

export default ButtonExamples
