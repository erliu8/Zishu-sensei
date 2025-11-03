import clsx from 'clsx'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnimationConfig, Position, Size } from '../../../types/ui'

// 角色接口定义
interface Character {
    id: string
    name: string
    avatar: string
    description: string
    mood?: 'happy' | 'sad' | 'excited' | 'sleepy' | 'angry' | 'confused'
    status?: 'idle' | 'talking' | 'thinking' | 'sleeping' | 'working'
    level?: number
    experience?: number
}

// 宠物窗口属性接口
interface PetWindowProps {
    /** 当前角色 */
    character: Character | null
    /** 窗口位置 */
    position?: Position
    /** 窗口大小 */
    size?: Size
    /** 是否可拖拽 */
    draggable?: boolean
    /** 是否显示状态信息 */
    showStatus?: boolean
    /** 是否显示交互提示 */
    showHints?: boolean
    /** 动画配置 */
    animationConfig?: AnimationConfig
    /** 右键菜单事件 */
    onContextMenu: (event: React.MouseEvent) => void
    /** 模式切换事件 */
    onModeChange: (mode: string) => void
    /** 拖拽事件 */
    onDrag?: (position: Position) => void
    /** 点击事件 */
    onClick?: () => void
    /** 悬停事件 */
    onHover?: (isHovering: boolean) => void
}

// 动画变体定义
const petVariants: Variants = {
    idle: {
        scale: 1,
        rotate: 0,
        y: 0,
        transition: {
            duration: 2,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut"
        }
    },
    hover: {
        scale: 1.05,
        y: -5,
        transition: {
            duration: 0.3,
            ease: "easeOut"
        }
    },
    talking: {
        scale: [1, 1.02, 1],
        rotate: [-1, 1, -1],
        transition: {
            duration: 0.5,
            repeat: Infinity,
            ease: "easeInOut"
        }
    },
    sleeping: {
        scale: 0.95,
        opacity: 0.8,
        y: 10,
        transition: {
            duration: 3,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut"
        }
    },
    excited: {
        scale: [1, 1.1, 1],
        y: [-5, -15, -5],
        rotate: [-5, 5, -5],
        transition: {
            duration: 0.6,
            repeat: Infinity,
            ease: "easeInOut"
        }
    }
}

const containerVariants: Variants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.5,
            ease: "easeOut"
        }
    },
    exit: {
        opacity: 0,
        scale: 0.8,
        transition: {
            duration: 0.3,
            ease: "easeIn"
        }
    }
}

const statusBarVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            ease: "easeOut"
        }
    }
}

const hintVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.2,
            ease: "easeOut"
        }
    }
}

/**
 * 宠物窗口组件
 * 
 * 特性：
 * - 多种角色状态和心情显示
 * - 丰富的动画效果
 * - 拖拽支持
 * - 状态信息显示
 * - 交互提示
 * - 响应式设计
 * - 无障碍支持
 */
export const PetWindow: React.FC<PetWindowProps> = ({
    character,
    position,
    size = { width: 200, height: 200 },
    draggable = true,
    showStatus = true,
    showHints = true,
    onContextMenu,
    onModeChange,
    onDrag,
    onClick,
    onHover,
}) => {
    const [isHovering, setIsHovering] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [currentAnimation, setCurrentAnimation] = useState<string>('idle')
    const [showStatusBar, setShowStatusBar] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // 根据角色状态设置动画
    useEffect(() => {
        if (!character) {
            setCurrentAnimation('idle')
            return
        }

        switch (character.status) {
            case 'talking':
                setCurrentAnimation('talking')
                break
            case 'sleeping':
                setCurrentAnimation('sleeping')
                break
            case 'thinking':
                setCurrentAnimation('idle')
                break
            default:
                if (character.mood === 'excited') {
                    setCurrentAnimation('excited')
                } else {
                    setCurrentAnimation('idle')
                }
        }
    }, [character?.status, character?.mood])

    // 处理悬停事件
    const handleMouseEnter = useCallback(() => {
        setIsHovering(true)
        setShowStatusBar(true)
        onHover?.(true)
    }, [onHover])

    const handleMouseLeave = useCallback(() => {
        setIsHovering(false)
        setShowStatusBar(false)
        onHover?.(false)
    }, [onHover])

    // 处理点击事件
    const handleClick = useCallback(() => {
        onClick?.()
    }, [onClick])

    // 处理双击事件
    const handleDoubleClick = useCallback(() => {
        onModeChange('chat')
    }, [onModeChange])

    // 获取角色显示内容
    const getCharacterDisplay = () => {
        if (!character) {
            return {
                avatar: '🤖',
                name: '加载中...',
                statusColor: 'text-gray-500'
            }
        }

        let statusColor = 'text-blue-500'
        switch (character.mood) {
            case 'happy':
                statusColor = 'text-green-500'
                break
            case 'sad':
                statusColor = 'text-blue-400'
                break
            case 'excited':
                statusColor = 'text-yellow-500'
                break
            case 'sleepy':
                statusColor = 'text-purple-400'
                break
            case 'angry':
                statusColor = 'text-red-500'
                break
            case 'confused':
                statusColor = 'text-orange-400'
                break
        }

        return {
            avatar: character.avatar,
            name: character.name,
            statusColor
        }
    }

    const { avatar, name, statusColor } = getCharacterDisplay()

    // 获取状态文本
    const getStatusText = () => {
        if (!character) return ''

        const statusTexts = {
            idle: '待机中',
            talking: '对话中',
            thinking: '思考中',
            sleeping: '休息中',
            working: '工作中'
        }

        return statusTexts[character.status || 'idle']
    }

    // 获取心情图标
    const getMoodIcon = () => {
        if (!character?.mood) return ''

        const moodIcons = {
            happy: '😊',
            sad: '😢',
            excited: '🤩',
            sleepy: '😴',
            angry: '😠',
            confused: '🤔'
        }

        return moodIcons[character.mood]
    }

    return (
        <motion.div
            ref={containerRef}
            className={clsx(
                'relative select-none',
                'bg-transparent',
                {
                    'cursor-grab': draggable && !isDragging,
                    'cursor-grabbing': draggable && isDragging,
                    'cursor-pointer': !draggable,
                }
            )}
            style={{
                width: `${size.width}px`,
                height: `${size.height}px`,
                ...position && { left: `${position.x}px`, top: `${position.y}px` }
            } as React.CSSProperties}
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onContextMenu={onContextMenu}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            drag={draggable}
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(_, info) => {
                setIsDragging(false)
                if (onDrag && position) {
                    onDrag({
                        x: position.x + info.offset.x,
                        y: position.y + info.offset.y
                    })
                }
            }}
            whileHover={!isDragging ? "hover" : undefined}
            role="button"
            tabIndex={0}
            aria-label={`宠物 ${name}`}
            aria-description={character ? `状态: ${getStatusText()}, 心情: ${character.mood || '普通'}` : '加载中'}
        >
            {/* 主要宠物显示区域 */}
            <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                    className="text-center"
                    variants={petVariants}
                    animate={currentAnimation}
                >
                    {/* 宠物头像 */}
                    <div className={clsx(
                        'text-8xl mb-2 relative',
                        'drop-shadow-lg'
                    )}>
                        {avatar}

                        {/* 心情图标 */}
                        <AnimatePresence>
                            {character?.mood && (
                                <motion.div
                                    className="absolute -top-2 -right-2 text-2xl"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {getMoodIcon()}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* 角色名称 */}
                    <motion.div
                        className={clsx(
                            'text-sm font-medium px-3 py-1 rounded-full',
                            'bg-white/80 dark:bg-gray-800/80',
                            'backdrop-blur-sm border border-white/20',
                            'shadow-lg',
                            statusColor
                        )}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        {name}
                    </motion.div>
                </motion.div>
            </div>

            {/* 状态栏 */}
            <AnimatePresence>
                {showStatus && showStatusBar && character && (
                    <motion.div
                        className={clsx(
                            'absolute top-2 left-2 right-2',
                            'bg-black/60 dark:bg-white/10',
                            'backdrop-blur-sm rounded-lg px-3 py-2',
                            'text-xs text-white dark:text-gray-200'
                        )}
                        variants={statusBarVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                    >
                        <div className="flex items-center justify-between">
                            <span>{getStatusText()}</span>
                            {character.level && (
                                <span className="text-yellow-400">Lv.{character.level}</span>
                            )}
                        </div>

                        {/* 经验条 */}
                        {character.experience !== undefined && (
                            <div className="mt-1 h-1 bg-gray-600 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${character.experience}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 交互提示 */}
            <AnimatePresence>
                {showHints && isHovering && !isDragging && (
                    <motion.div
                        className={clsx(
                            'absolute bottom-2 left-1/2 transform -translate-x-1/2',
                            'text-xs text-gray-600 dark:text-gray-300',
                            'bg-white/90 dark:bg-gray-800/90',
                            'backdrop-blur-sm px-3 py-1 rounded-full',
                            'border border-gray-200/50 dark:border-gray-600/50',
                            'shadow-lg whitespace-nowrap'
                        )}
                        variants={hintVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                    >
                        右键菜单 | 双击对话 {draggable && '| 拖拽移动'}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 点击涟漪效果 */}
            <AnimatePresence>
                {isHovering && (
                    <motion.div
                        className="absolute inset-0 rounded-full border-2 border-blue-400/30"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{
                            scale: 1.2,
                            opacity: [0, 0.5, 0],
                        }}
                        exit={{ scale: 1.4, opacity: 0 }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeOut"
                        }}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    )
}
