/**
 * 音效系统基础使用示例
 * @module services/sound/examples/BasicExample
 */

import { useSound, useUISound, useCharacterSound, useChatSound } from '@/hooks/useSound'

/**
 * 示例1: 基础音效播放
 */
export function BasicSoundExample() {
  const clickSound = useSound('ui_click')

  const handleClick = () => {
    clickSound.play()
  }

  return (
    <button onClick={handleClick} disabled={clickSound.isPlaying}>
      {clickSound.isPlaying ? '播放中...' : '点击播放音效'}
    </button>
  )
}

/**
 * 示例2: 使用 UI 音效快捷 Hook
 */
export function UIButtonExample() {
  const { playClick, playHover, playSuccess } = useUISound()

  return (
    <div>
      <button onClick={playClick} onMouseEnter={playHover}>
        普通按钮
      </button>
      <button
        onClick={() => {
          playClick()
          setTimeout(playSuccess, 300)
        }}
      >
        提交按钮
      </button>
    </div>
  )
}

/**
 * 示例3: 角色交互音效
 */
export function CharacterInteractionExample() {
  const { playTap, playHappy, playSurprised } = useCharacterSound()

  const handleCharacterClick = (emotion: 'happy' | 'surprised') => {
    playTap() // 先播放点击音效

    // 根据情绪播放对应音效
    setTimeout(() => {
      if (emotion === 'happy') playHappy()
      else if (emotion === 'surprised') playSurprised()
    }, 200)
  }

  return (
    <div>
      <div onClick={() => handleCharacterClick('happy')}>让角色开心</div>
      <div onClick={() => handleCharacterClick('surprised')}>让角色惊讶</div>
    </div>
  )
}

/**
 * 示例4: 聊天音效
 */
export function ChatExample() {
  const { playSend, playReceive } = useChatSound()

  const sendMessage = () => {
    playSend()
    // 发送消息逻辑...
  }

  const onReceiveMessage = () => {
    playReceive()
    // 接收消息逻辑...
  }

  return (
    <div>
      <button onClick={sendMessage}>发送消息</button>
      <button onClick={onReceiveMessage}>模拟接收消息</button>
    </div>
  )
}

/**
 * 示例5: 高级音效控制 - 淡入淡出
 */
export function AdvancedControlExample() {
  const bgmSound = useSound('bgm_main')

  const playWithFadeIn = () => {
    bgmSound.play({
      volume: 0.4,
      loop: true,
      fadeIn: 2000, // 2秒淡入
    })
  }

  const stopWithFadeOut = () => {
    bgmSound.stop({
      fadeOut: 2000, // 2秒淡出
    })
  }

  return (
    <div>
      <button onClick={playWithFadeIn}>播放背景音乐（淡入）</button>
      <button onClick={() => bgmSound.pause()}>暂停</button>
      <button onClick={() => bgmSound.resume()}>继续</button>
      <button onClick={stopWithFadeOut}>停止（淡出）</button>
      <div>状态: {bgmSound.isPlaying ? '播放中' : '已停止'}</div>
    </div>
  )
}

/**
 * 示例6: 音效管理器使用
 */
export function SoundManagerExample() {
  const soundManager = useSoundManager()

  return (
    <div>
      <h3>音效控制面板</h3>
      <div>
        <label>
          全局音量:
          <input
            type="range"
            min="0"
            max="100"
            onChange={(e) => soundManager.setVolume(Number(e.target.value) / 100)}
          />
        </label>
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            onChange={(e) => soundManager.setMuted(e.target.checked)}
          />
          全局静音
        </label>
      </div>
      <button onClick={() => soundManager.stopAll()}>停止所有音效</button>

      {soundManager.stats && (
        <div>
          <h4>统计信息</h4>
          <p>总音效数: {soundManager.stats.totalSounds}</p>
          <p>已加载: {soundManager.stats.loadedSounds}</p>
          <p>正在播放: {soundManager.stats.playingSounds}</p>
        </div>
      )}
    </div>
  )
}

/**
 * 示例7: 音效分组控制
 */
export function GroupControlExample() {
  const soundManager = useSoundManager()

  return (
    <div>
      <h3>分组音量控制</h3>
      <div>
        <label>
          UI音效音量:
          <input
            type="range"
            min="0"
            max="100"
            onChange={(e) => soundManager.setGroupVolume('ui', Number(e.target.value) / 100)}
          />
        </label>
      </div>
      <div>
        <label>
          角色音效音量:
          <input
            type="range"
            min="0"
            max="100"
            onChange={(e) =>
              soundManager.setGroupVolume('character', Number(e.target.value) / 100)
            }
          />
        </label>
      </div>
      <div>
        <label>
          <input type="checkbox" onChange={(e) => soundManager.setGroupMuted('bgm', e.target.checked)} />
          静音背景音乐
        </label>
      </div>
    </div>
  )
}

/**
 * 完整示例应用
 */
export function CompleteSoundExample() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>音效系统示例</h1>

      <section>
        <h2>基础音效</h2>
        <BasicSoundExample />
      </section>

      <section>
        <h2>UI 交互音效</h2>
        <UIButtonExample />
      </section>

      <section>
        <h2>角色音效</h2>
        <CharacterInteractionExample />
      </section>

      <section>
        <h2>聊天音效</h2>
        <ChatExample />
      </section>

      <section>
        <h2>高级控制</h2>
        <AdvancedControlExample />
      </section>

      <section>
        <h2>音效管理</h2>
        <SoundManagerExample />
      </section>

      <section>
        <h2>分组控制</h2>
        <GroupControlExample />
      </section>
    </div>
  )
}

// 在 App.tsx 中使用示例
import { SoundInitializer } from '../SoundInitializer'
import { useSoundManager } from '@/hooks/useSound'

export function AppWithSound() {
  return (
    <SoundInitializer
      config={{
        globalVolume: 0.7,
        debug: true,
      }}
      onReady={() => console.log('音效系统已就绪')}
    >
      <CompleteSoundExample />
    </SoundInitializer>
  )
}

