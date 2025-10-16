import React from 'react'
import { Character } from '@/components/Character'
import type { CharacterModel } from '@/types/character'
import type { ContextMenuOption } from '@/types/ui'
import type { WindowMode } from '@/types/app'

interface PetWindowProps {
  character: CharacterModel
  onContextMenu: (event: React.MouseEvent, options: ContextMenuOption[]) => void
  onModeChange: (mode: WindowMode) => void
}

/**
 * 宠物窗口组件
 * 显示Live2D角色的主要容器
 */
export const PetWindow: React.FC<PetWindowProps> = ({
  character,
  onContextMenu,
  onModeChange,
}) => {
  const handleRightClick = (event: React.MouseEvent) => {
    console.log('🖱️ [PetWindow] 右键点击事件触发:', { button: event.button, clientX: event.clientX, clientY: event.clientY })
    event.preventDefault()
    
    const contextOptions: ContextMenuOption[] = [
      {
        id: 'chat',
        label: '打开聊天',
        icon: '💬',
        onClick: () => onModeChange('chat'),
      },
      {
        id: 'settings',
        label: '设置',
        icon: '⚙️',
        onClick: () => onModeChange('settings'),
      },
      {
        id: 'separator-1',
        label: '',
        type: 'separator',
      },
      {
        id: 'minimize',
        label: '最小化',
        icon: '➖',
        onClick: () => onModeChange('minimized'),
      },
    ]
    
    console.log('🖱️ [PetWindow] 调用 onContextMenu，选项数量:', contextOptions.length)
    onContextMenu(event, contextOptions)
  }

  return (
    <div 
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
      onContextMenu={handleRightClick}
    >
      <Character
        character={character}
        onInteraction={(type, data) => {
          console.log('角色交互:', type, data)
          // 处理角色交互
          if (type === 'click') {
            // 点击角色时可以触发特定动画或对话
          }
        }}
      />
    </div>
  )
}
