/**
 * CharacterTransition 组件
 * 实现角色切换的过渡动画效果
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './CharacterTransition.css'

export type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom' | 'flip' | 'dissolve'

interface CharacterTransitionProps {
    children: React.ReactNode
    characterId: string
    transitionType?: TransitionType
    duration?: number
    onTransitionComplete?: () => void
}

/**
 * 获取动画变体配置
 */
const getTransitionVariants = (type: TransitionType, duration: number) => {
    const baseDuration = duration / 1000 // 转换为秒

    switch (type) {
        case 'fade':
            return {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 },
                transition: { duration: baseDuration, ease: 'easeInOut' }
            }
        
        case 'slide-left':
            return {
                initial: { x: '100%', opacity: 0 },
                animate: { x: 0, opacity: 1 },
                exit: { x: '-100%', opacity: 0 },
                transition: { duration: baseDuration, ease: 'easeInOut' }
            }
        
        case 'slide-right':
            return {
                initial: { x: '-100%', opacity: 0 },
                animate: { x: 0, opacity: 1 },
                exit: { x: '100%', opacity: 0 },
                transition: { duration: baseDuration, ease: 'easeInOut' }
            }
        
        case 'zoom':
            return {
                initial: { scale: 0, opacity: 0 },
                animate: { scale: 1, opacity: 1 },
                exit: { scale: 0, opacity: 0 },
                transition: { 
                    duration: baseDuration, 
                    ease: [0.43, 0.13, 0.23, 0.96] // cubic-bezier
                }
            }
        
        case 'flip':
            return {
                initial: { rotateY: 90, opacity: 0 },
                animate: { rotateY: 0, opacity: 1 },
                exit: { rotateY: -90, opacity: 0 },
                transition: { duration: baseDuration, ease: 'easeInOut' }
            }
        
        case 'dissolve':
            return {
                initial: { scale: 1.2, opacity: 0, filter: 'blur(10px)' },
                animate: { scale: 1, opacity: 1, filter: 'blur(0px)' },
                exit: { scale: 0.8, opacity: 0, filter: 'blur(10px)' },
                transition: { duration: baseDuration, ease: 'easeInOut' }
            }
        
        default:
            return {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 },
                transition: { duration: baseDuration }
            }
    }
}

/**
 * CharacterTransition - 角色切换过渡动画
 */
export const CharacterTransition: React.FC<CharacterTransitionProps> = ({
    children,
    characterId,
    transitionType = 'fade',
    duration = 600,
    onTransitionComplete,
}) => {
    const [isTransitioning, setIsTransitioning] = useState(false)
    const variants = getTransitionVariants(transitionType, duration)

    useEffect(() => {
        setIsTransitioning(true)
        const timer = setTimeout(() => {
            setIsTransitioning(false)
            onTransitionComplete?.()
        }, duration)

        return () => clearTimeout(timer)
    }, [characterId, duration, onTransitionComplete])

    return (
        <div className="character-transition-container">
            <AnimatePresence mode="wait">
                <motion.div
                    key={characterId}
                    className={`character-transition-wrapper ${isTransitioning ? 'transitioning' : ''}`}
                    initial={variants.initial}
                    animate={variants.animate}
                    exit={variants.exit}
                    transition={variants.transition}
                    style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                    }}
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

/**
 * 带加载状态的角色过渡组件
 */
interface CharacterTransitionWithLoadingProps extends CharacterTransitionProps {
    isLoading?: boolean
    loadingText?: string
}

export const CharacterTransitionWithLoading: React.FC<CharacterTransitionWithLoadingProps> = ({
    children,
    characterId,
    transitionType = 'fade',
    duration = 600,
    onTransitionComplete,
    isLoading = false,
    loadingText = '加载中...',
}) => {
    if (isLoading) {
        return (
            <div className="character-loading-overlay">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="loading-content"
                >
                    <div className="loading-spinner" />
                    <span className="loading-text">{loadingText}</span>
                </motion.div>
            </div>
        )
    }

    return (
        <CharacterTransition
            characterId={characterId}
            transitionType={transitionType}
            duration={duration}
            onTransitionComplete={onTransitionComplete}
        >
            {children}
        </CharacterTransition>
    )
}

/**
 * 自定义 Hook - 管理角色切换状态
 */
export const useCharacterTransition = (initialCharacterId: string) => {
    const [currentCharacterId, setCurrentCharacterId] = useState(initialCharacterId)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [transitionType, setTransitionType] = useState<TransitionType>('fade')

    const switchCharacter = useCallback((
        newCharacterId: string,
        newTransitionType?: TransitionType
    ) => {
        if (newCharacterId === currentCharacterId) return

        setIsTransitioning(true)
        if (newTransitionType) {
            setTransitionType(newTransitionType)
        }
        setCurrentCharacterId(newCharacterId)
    }, [currentCharacterId])

    const handleTransitionComplete = useCallback(() => {
        setIsTransitioning(false)
    }, [])

    return {
        currentCharacterId,
        isTransitioning,
        transitionType,
        switchCharacter,
        handleTransitionComplete,
    }
}

