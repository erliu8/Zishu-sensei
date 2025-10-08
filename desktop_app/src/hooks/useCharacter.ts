import { useCallback, useState } from 'react'

interface Character {
    id: string
    name: string
    avatar: string
    description: string
}

/**
 * 角色管理 Hook
 */
export const useCharacter = () => {
    const [characterList] = useState<Character[]>([
        { id: 'shizuku', name: '雫', avatar: '🎭', description: '可爱的桌面宠物' },
        { id: 'hiyori', name: '日和', avatar: '🌸', description: '温柔的助手' },
    ])

    const [currentCharacter, setCurrentCharacter] = useState<Character | null>(characterList[0])

    const switchCharacter = useCallback((characterId: string) => {
        const character = characterList.find(c => c.id === characterId)
        if (character) {
            setCurrentCharacter(character)
        }
    }, [characterList])

    return {
        characterList,
        currentCharacter,
        switchCharacter,
    }
}
