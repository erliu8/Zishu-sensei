/**
 * 本地LLM模型设置组件
 * 
 * 功能特性：
 * - 📤 上传本地LLM模型文件
 * - 📋 查看已上传的模型列表
 * - ✅ 验证模型文件
 * - 🗑️ 删除模型
 * - 📊 显示模型信息（大小、类型等）
 */

import React, { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Upload, Trash2, CheckCircle, FileText, HardDrive, Link2 } from 'lucide-react'

// API服务
import LocalLLMAPI from '@/services/api/localLLM'
import type { LocalLLMModel } from '@/types/localLLM'
import { formatFileSize, formatParameterCount } from '@/types/localLLM'

/**
 * 组件属性
 */
export interface LocalLLMSettingsProps {
    className?: string
}

/**
 * 本地LLM设置组件
 */
export const LocalLLMSettings: React.FC<LocalLLMSettingsProps> = () => {
    // ==================== 状态管理 ====================
    const [models, setModels] = useState<LocalLLMModel[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [showUploadDialog, setShowUploadDialog] = useState(false)
    const [uploadMode, setUploadMode] = useState<'upload' | 'register'>('upload')
    const [uploadForm, setUploadForm] = useState({
        name: '',
        description: '',
    })

    // ==================== 加载模型列表 ====================
    const loadModels = useCallback(async () => {
        setIsLoading(true)
        try {
            const modelList = await LocalLLMAPI.getModels()
            // 确保modelList是数组，即使API返回null或undefined
            setModels(Array.isArray(modelList) ? modelList : [])
        } catch (error) {
            console.error('加载模型列表失败:', error)
            // 出错时设置为空数组，显示"还没有上传任何模型"
            setModels([])
            toast.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadModels()
    }, [loadModels])

    // ==================== 上传/注册模型 ====================
    const handleUpload = useCallback(async () => {
        if (!uploadForm.name.trim()) {
            toast.error('请输入模型名称')
            return
        }

        setIsUploading(true)
        const toastId = toast.loading(
            uploadMode === 'upload' ? '正在上传模型...' : '正在注册模型路径...'
        )

        try {
            if (uploadMode === 'upload') {
                await LocalLLMAPI.selectAndUpload(
                    uploadForm.name,
                    uploadForm.description || undefined
                )
                toast.success('模型上传成功', { id: toastId })
            } else {
                await LocalLLMAPI.selectAndRegister(
                    uploadForm.name,
                    uploadForm.description || undefined
                )
                toast.success('模型路径注册成功', { id: toastId })
            }
            
            setShowUploadDialog(false)
            setUploadForm({ name: '', description: '' })
            setUploadMode('upload')
            await loadModels()
        } catch (error) {
            console.error('操作失败:', error)
            toast.error(
                `${uploadMode === 'upload' ? '上传' : '注册'}失败: ${error instanceof Error ? error.message : '未知错误'}`,
                { id: toastId }
            )
        } finally {
            setIsUploading(false)
        }
    }, [uploadForm, uploadMode, loadModels])

    // ==================== 删除模型 ====================
    const handleDelete = useCallback(async (modelId: string, modelName: string) => {
        if (!window.confirm(`确定要删除模型 "${modelName}" 吗？此操作无法撤销。`)) {
            return
        }

        const toastId = toast.loading('正在删除模型...')

        try {
            await LocalLLMAPI.deleteModel({
                model_id: modelId,
                delete_files: true,
            })
            
            toast.success('模型删除成功', { id: toastId })
            await loadModels()
        } catch (error) {
            console.error('删除模型失败:', error)
            toast.error(
                `删除失败: ${error instanceof Error ? error.message : '未知错误'}`,
                { id: toastId }
            )
        }
    }, [loadModels])

    // ==================== 验证模型 ====================
    const handleVerify = useCallback(async (modelId: string) => {
        const toastId = toast.loading('正在验证模型...')

        try {
            const result = await LocalLLMAPI.verifyModel({ model_id: modelId })
            
            if (result.valid) {
                toast.success('模型验证通过', { id: toastId })
            } else {
                toast.error(`验证失败: ${result.message}`, { id: toastId })
            }
        } catch (error) {
            console.error('验证模型失败:', error)
            toast.error(
                `验证失败: ${error instanceof Error ? error.message : '未知错误'}`,
                { id: toastId }
            )
        }
    }, [])

    // ==================== 渲染 ====================
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
        }}>
            {/* 标题和操作栏 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
            }}>
                <div>
                    <h3 style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        color: 'hsl(var(--color-foreground))',
                        marginBottom: '4px',
                    }}>
                        本地LLM模型管理
                    </h3>
                    <p style={{
                        fontSize: '12px',
                        color: 'hsl(var(--color-muted-foreground))',
                    }}>
                        上传和管理本地LLM模型文件
                    </p>
                </div>
                <button
                    onClick={() => setShowUploadDialog(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'white',
                        backgroundColor: 'hsl(var(--color-primary))',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-primary) / 0.9)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-primary))'
                    }}
                >
                    <Upload size={16} />
                    上传模型
                </button>
            </div>

            {/* 模型列表 */}
            {isLoading ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px 0',
                }}>
                    <div style={{
                        textAlign: 'center',
                    }}>
                        <div style={{
                            display: 'inline-block',
                            width: '24px',
                            height: '24px',
                            border: '3px solid hsl(var(--color-muted))',
                            borderTopColor: 'hsl(var(--color-primary))',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            marginBottom: '12px',
                        }} />
                        <p style={{
                            fontSize: '14px',
                            color: 'hsl(var(--color-muted-foreground))',
                        }}>正在加载模型列表...</p>
                    </div>
                </div>
            ) : models.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    border: '2px dashed hsl(var(--color-border))',
                    borderRadius: '8px',
                    backgroundColor: 'hsl(var(--color-muted) / 0.1)',
                }}>
                    <HardDrive size={40} style={{
                        margin: '0 auto 12px',
                        color: 'hsl(var(--color-muted-foreground))',
                    }} />
                    <p style={{
                        fontSize: '14px',
                        color: 'hsl(var(--color-foreground))',
                        marginBottom: '8px',
                    }}>还没有上传任何模型</p>
                    <p style={{
                        fontSize: '12px',
                        color: 'hsl(var(--color-muted-foreground))',
                    }}>
                        点击"上传模型"按钮开始使用本地LLM
                    </p>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}>
                    {models.map((model) => (
                        <div
                            key={model.id}
                            style={{
                                backgroundColor: 'hsl(var(--color-background))',
                                border: '1px solid hsl(var(--color-border))',
                                borderRadius: '8px',
                                padding: '16px',
                                transition: 'box-shadow 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 2px 8px hsl(var(--color-muted) / 0.2)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: '16px',
                            }}>
                                <div style={{
                                    flex: 1,
                                    minWidth: 0,
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '8px',
                                        flexWrap: 'wrap',
                                    }}>
                                        <FileText size={18} style={{
                                            color: 'hsl(var(--color-primary))',
                                            flexShrink: 0,
                                        }} />
                                        <h4 style={{
                                            fontSize: '15px',
                                            fontWeight: 600,
                                            color: 'hsl(var(--color-foreground))',
                                            margin: 0,
                                        }}>
                                            {model.name}
                                        </h4>
                                        {model.is_loaded && (
                                            <span style={{
                                                padding: '2px 8px',
                                                fontSize: '11px',
                                                backgroundColor: 'hsl(142 76% 36% / 0.2)',
                                                color: 'hsl(142 76% 36%)',
                                                borderRadius: '4px',
                                            }}>
                                                已加载
                                            </span>
                                        )}
                                    </div>
                                    
                                    {model.description && (
                                        <p style={{
                                            fontSize: '13px',
                                            color: 'hsl(var(--color-muted-foreground))',
                                            marginBottom: '12px',
                                            lineHeight: '1.5',
                                        }}>
                                            {model.description}
                                        </p>
                                    )}

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                        gap: '12px',
                                        fontSize: '13px',
                                    }}>
                                        {model.metadata?.is_reference && (
                                            <div>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    fontSize: '11px',
                                                    backgroundColor: 'hsl(217 91% 60% / 0.2)',
                                                    color: 'hsl(217 91% 60%)',
                                                    borderRadius: '4px',
                                                }}>
                                                    路径引用
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <span style={{
                                                color: 'hsl(var(--color-muted-foreground))',
                                            }}>类型: </span>
                                            <span style={{
                                                color: 'hsl(var(--color-foreground))',
                                            }}>
                                                {model.model_type}
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{
                                                color: 'hsl(var(--color-muted-foreground))',
                                            }}>大小: </span>
                                            <span style={{
                                                color: 'hsl(var(--color-foreground))',
                                            }}>
                                                {formatFileSize(model.size_bytes)}
                                            </span>
                                        </div>
                                        {model.parameter_count && (
                                            <div>
                                                <span style={{
                                                    color: 'hsl(var(--color-muted-foreground))',
                                                }}>参数量: </span>
                                                <span style={{
                                                    color: 'hsl(var(--color-foreground))',
                                                }}>
                                                    {formatParameterCount(model.parameter_count)}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <span style={{
                                                color: 'hsl(var(--color-muted-foreground))',
                                            }}>格式: </span>
                                            <span style={{
                                                color: 'hsl(var(--color-foreground))',
                                            }}>
                                                {model.supported_formats.join(', ')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    flexShrink: 0,
                                }}>
                                    <button
                                        onClick={() => handleVerify(model.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '6px 12px',
                                            fontSize: '13px',
                                            color: 'hsl(var(--color-foreground))',
                                            backgroundColor: 'hsl(var(--color-muted) / 0.3)',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s',
                                        }}
                                        title="验证模型"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.5)'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.3)'
                                        }}
                                    >
                                        <CheckCircle size={14} />
                                        验证
                                    </button>
                                    <button
                                        onClick={() => handleDelete(model.id, model.name)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '6px 12px',
                                            fontSize: '13px',
                                            color: 'hsl(0 72% 51%)',
                                            backgroundColor: 'hsl(0 72% 51% / 0.1)',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s',
                                        }}
                                        title="删除模型"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.2)'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.1)'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                        删除
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 上传对话框 */}
            <AnimatePresence>
                {showUploadDialog && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                        }}
                        onClick={() => {
                            // 允许在注册过程中关闭对话框（虽然无法取消后端请求）
                            if (!isUploading) {
                                setShowUploadDialog(false);
                            }
                        }}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: 'hsl(var(--color-background))',
                                borderRadius: '8px',
                                padding: '24px',
                                width: '100%',
                                maxWidth: '480px',
                                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
                            }}
                        >
                            <h3 style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                color: 'hsl(var(--color-foreground))',
                                marginBottom: '20px',
                            }}>
                                {uploadMode === 'upload' ? '上传本地LLM模型' : '注册模型路径'}
                            </h3>

                            {/* 模式选择 */}
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                marginBottom: '20px',
                                padding: '4px',
                                backgroundColor: 'hsl(var(--color-muted) / 0.2)',
                                borderRadius: '6px',
                            }}>
                                <button
                                    onClick={() => setUploadMode('upload')}
                                    disabled={isUploading}
                                    style={{
                                        flex: 1,
                                        padding: '8px 16px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        color: uploadMode === 'upload' 
                                            ? 'hsl(var(--color-foreground))' 
                                            : 'hsl(var(--color-muted-foreground))',
                                        backgroundColor: uploadMode === 'upload' 
                                            ? 'hsl(var(--color-background))' 
                                            : 'transparent',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: isUploading ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: uploadMode === 'upload' 
                                            ? '0 1px 3px rgba(0, 0, 0, 0.1)' 
                                            : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                    }}
                                >
                                    <Upload size={14} />
                                    上传（复制文件）
                                </button>
                                <button
                                    onClick={() => setUploadMode('register')}
                                    disabled={isUploading}
                                    style={{
                                        flex: 1,
                                        padding: '8px 16px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        color: uploadMode === 'register' 
                                            ? 'hsl(var(--color-foreground))' 
                                            : 'hsl(var(--color-muted-foreground))',
                                        backgroundColor: uploadMode === 'register' 
                                            ? 'hsl(var(--color-background))' 
                                            : 'transparent',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: isUploading ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: uploadMode === 'register' 
                                            ? '0 1px 3px rgba(0, 0, 0, 0.1)' 
                                            : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                    }}
                                >
                                    <Link2 size={14} />
                                    引用路径（不复制）
                                </button>
                            </div>

                            {/* 模式说明 */}
                            <div style={{
                                padding: '12px',
                                marginBottom: '16px',
                                fontSize: '12px',
                                color: 'hsl(var(--color-muted-foreground))',
                                backgroundColor: 'hsl(var(--color-muted) / 0.1)',
                                borderRadius: '6px',
                                lineHeight: '1.5',
                            }}>
                                {uploadMode === 'upload' ? (
                                    <>
                                        <strong>上传模式：</strong>将模型文件复制到应用数据目录，便于管理和备份。
                                        适合需要应用统一管理的场景。
                                    </>
                                ) : (
                                    <>
                                        <strong>路径引用模式：</strong>直接引用现有模型路径，不复制文件，节省空间和时间。
                                        适合已有模型文件，希望直接使用的场景。
                                    </>
                                )}
                            </div>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'hsl(var(--color-foreground))',
                                        marginBottom: '8px',
                                    }}>
                                        模型名称 *
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadForm.name}
                                        onChange={(e) =>
                                            setUploadForm({ ...uploadForm, name: e.target.value })
                                        }
                                        placeholder="例如: llama-2-7b-chat"
                                        disabled={isUploading}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            border: '1px solid hsl(var(--color-border))',
                                            borderRadius: '6px',
                                            backgroundColor: 'hsl(var(--color-background))',
                                            color: 'hsl(var(--color-foreground))',
                                            outline: 'none',
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-primary))'
                                            e.currentTarget.style.boxShadow = '0 0 0 2px hsl(var(--color-primary) / 0.2)'
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-border))'
                                            e.currentTarget.style.boxShadow = 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'hsl(var(--color-foreground))',
                                        marginBottom: '8px',
                                    }}>
                                        模型描述（可选）
                                    </label>
                                    <textarea
                                        value={uploadForm.description}
                                        onChange={(e) =>
                                            setUploadForm({ ...uploadForm, description: e.target.value })
                                        }
                                        placeholder="描述这个模型的用途和特点..."
                                        rows={3}
                                        disabled={isUploading}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            border: '1px solid hsl(var(--color-border))',
                                            borderRadius: '6px',
                                            backgroundColor: 'hsl(var(--color-background))',
                                            color: 'hsl(var(--color-foreground))',
                                            outline: 'none',
                                            resize: 'none',
                                            fontFamily: 'inherit',
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-primary))'
                                            e.currentTarget.style.boxShadow = '0 0 0 2px hsl(var(--color-primary) / 0.2)'
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-border))'
                                            e.currentTarget.style.boxShadow = 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                marginTop: '24px',
                            }}>
                                <button
                                    onClick={() => {
                                        // 允许在注册过程中关闭对话框
                                        // 注意：这不会取消后端请求，但可以让用户关闭对话框
                                        if (isUploading) {
                                            if (window.confirm('注册正在进行中，关闭对话框不会取消注册操作。是否仍要关闭？')) {
                                                setIsUploading(false);
                                                setShowUploadDialog(false);
                                            }
                                        } else {
                                            setShowUploadDialog(false);
                                        }
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '14px',
                                        color: 'hsl(var(--color-foreground))',
                                        backgroundColor: 'hsl(var(--color-muted) / 0.3)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        opacity: 1,
                                        transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.5)'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.3)'
                                    }}
                                >
                                    {isUploading ? '强制关闭' : '取消'}
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading || !uploadForm.name.trim()}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 16px',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'white',
                                        backgroundColor: 'hsl(var(--color-primary))',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: (isUploading || !uploadForm.name.trim()) ? 'not-allowed' : 'pointer',
                                        opacity: (isUploading || !uploadForm.name.trim()) ? 0.5 : 1,
                                        transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isUploading && uploadForm.name.trim()) {
                                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-primary) / 0.9)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-primary))'
                                    }}
                                >
                                    {isUploading ? (
                                        <>
                                            <div style={{
                                                width: '14px',
                                                height: '14px',
                                                border: '2px solid white',
                                                borderTopColor: 'transparent',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite',
                                            }} />
                                            {uploadMode === 'upload' ? '上传中...' : '注册中...'}
                                        </>
                                    ) : (
                                        <>
                                            {uploadMode === 'upload' ? (
                                                <>
                                                    <Upload size={16} />
                                                    选择文件并上传
                                                </>
                                            ) : (
                                                <>
                                                    <Link2 size={16} />
                                                    选择路径并注册
                                                </>
                                            )}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * 默认导出
 */
export default LocalLLMSettings

