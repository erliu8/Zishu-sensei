import React from 'react'

interface Character {
    id: string
    name: string
    avatar: string
    description: string
}

interface CharacterProps {
    character: Character | null
    onInteraction: (type: string, data: any) => void
}

/**
 * 角色组件
 */
export const Character: React.FC<CharacterProps> = ({
    character,
    onInteraction,
}) => {
    if (!character) return null

    return (
        <div
            className="absolute inset-0 pointer-events-none"
            onClick={() => onInteraction('click', { character })}
        >
            {/* 这里将来会集成 Live2D 渲染 */}
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-6xl animate-pulse">
                    {character.avatar}
                </div>
            </div>
        </div>
    )
}
