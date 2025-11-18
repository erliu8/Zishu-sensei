/**
 * AI设置组件
 * 
 * 整合本地LLM模型管理和Prompt管理
 */

import React, { useState } from 'react'
import { Bot, FileText, Cloud } from 'lucide-react'

import { LocalLLMSettings } from '../LocalLLMSettings'
import { PromptSettings } from '../PromptSettings'
import { ThirdPartyAPISettings } from '../ThirdPartyAPISettings'

/**
 * 组件属性
 */
export interface AISettingsProps {
    className?: string
}

/**
 * AI设置组件
 */
export const AISettings: React.FC<AISettingsProps> = ({ className }) => {
    const [activeTab, setActiveTab] = useState<'llm' | 'api' | 'prompt'>('llm')

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
        }}>
            {/* 标签页导航 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                borderBottom: '1px solid hsl(var(--color-border))',
            }}>
                <button
                    onClick={() => setActiveTab('llm')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: activeTab === 'llm' 
                            ? 'hsl(var(--color-foreground))' 
                            : 'hsl(var(--color-muted-foreground))',
                        backgroundColor: activeTab === 'llm' 
                            ? 'hsl(var(--color-muted) / 0.3)' 
                            : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'llm' 
                            ? '2px solid hsl(var(--color-primary))' 
                            : '2px solid transparent',
                        borderRadius: '6px 6px 0 0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (activeTab !== 'llm') {
                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.1)'
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (activeTab !== 'llm') {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }
                    }}
                >
                    <Bot size={16} />
                    本地LLM模型
                </button>
                <button
                    onClick={() => setActiveTab('api')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: activeTab === 'api' 
                            ? 'hsl(var(--color-foreground))' 
                            : 'hsl(var(--color-muted-foreground))',
                        backgroundColor: activeTab === 'api' 
                            ? 'hsl(var(--color-muted) / 0.3)' 
                            : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'api' 
                            ? '2px solid hsl(var(--color-primary))' 
                            : '2px solid transparent',
                        borderRadius: '6px 6px 0 0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (activeTab !== 'api') {
                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.1)'
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (activeTab !== 'api') {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }
                    }}
                >
                    <Cloud size={16} />
                    第三方API
                </button>
                <button
                    onClick={() => setActiveTab('prompt')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: activeTab === 'prompt' 
                            ? 'hsl(var(--color-foreground))' 
                            : 'hsl(var(--color-muted-foreground))',
                        backgroundColor: activeTab === 'prompt' 
                            ? 'hsl(var(--color-muted) / 0.3)' 
                            : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'prompt' 
                            ? '2px solid hsl(var(--color-primary))' 
                            : '2px solid transparent',
                        borderRadius: '6px 6px 0 0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (activeTab !== 'prompt') {
                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.1)'
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (activeTab !== 'prompt') {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }
                    }}
                >
                    <FileText size={16} />
                    Prompt管理
                </button>
            </div>

            {/* 内容区域 */}
            <div style={{
                marginTop: '8px',
            }}>
                {activeTab === 'llm' && <LocalLLMSettings />}
                {activeTab === 'api' && <ThirdPartyAPISettings />}
                {activeTab === 'prompt' && <PromptSettings />}
            </div>
        </div>
    )
}

/**
 * 默认导出
 */
export default AISettings

