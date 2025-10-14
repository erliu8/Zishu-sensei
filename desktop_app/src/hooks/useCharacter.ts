import { useCallback, useState } from 'react'
import type { CharacterModel } from '@/types/character'

/**
 * 角色管理 Hook
 */
export const useCharacter = () => {
    const [characterList] = useState<CharacterModel[]>([
        { 
            id: 'hiyori', 
            name: 'Hiyori', 
            avatar: '🌸', 
            description: '温柔的Live2D助手',
            type: 'live2d',
            modelPath: '/live2d_models/hiyori/hiyori.model3.json',
            previewImage: '/live2d_models/hiyori/icon.jpg'
        },
    ])

    const [currentCharacter, setCurrentCharacter] = useState<CharacterModel | null>(characterList[0])

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
