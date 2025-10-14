/**
 * Live2D 初始化脚本
 * 确保 Live2D Cubism Core 在应用启动前正确加载
 */

// PixiJS BatchRenderer 着色器修复已移至 Live2DModelLoader 中进行
// 在创建 Application 实例时进行修复，确保时机正确

// 全局 Live2D 初始化状态
(window as any).__LIVE2D_INIT_STATE__ = {
  cubismCoreLoaded: false,
  cubismCoreVersion: null,
  initError: null,
  initPromise: null
}

/**
 * 检查 Live2D Cubism Core 是否已加载
 */
function checkLive2DCubismCore(): boolean {
  const w = window as any
  const state = w.__LIVE2D_INIT_STATE__
  
  // 检查 Cubism4
  if (w.Live2DCubismCore) {
    state.cubismCoreLoaded = true
    state.cubismCoreVersion = 'cubism4'
    console.log('✅ Live2D Cubism4 Core 已加载')
    return true
  }
  
  console.log('⏳ Live2D Cubism Core 尚未加载')
  return false
}

/**
 * 初始化 Live2D Cubism Core
 */
function initializeLive2DCubismCore(): Promise<void> {
  const state = (window as any).__LIVE2D_INIT_STATE__
  
  // 如果已经在初始化，返回现有的 Promise
  if (state.initPromise) {
    return state.initPromise
  }
  
  // 如果已经加载，直接返回
  if (checkLive2DCubismCore()) {
    return Promise.resolve()
  }
  
  console.log('🚀 开始初始化 Live2D Cubism Core...')
  
  state.initPromise = new Promise((resolve, reject) => {
    let checkAttempts = 0
    const maxAttempts = 50 // 最多等待 5 秒
    
    const checkInterval = setInterval(() => {
      checkAttempts++
      
      if (checkLive2DCubismCore()) {
        clearInterval(checkInterval)
        console.log('✅ Live2D Cubism Core 初始化完成')
        resolve(void 0)
      } else if (checkAttempts >= maxAttempts) {
        clearInterval(checkInterval)
        const error = new Error('Live2D Cubism Core 加载超时')
        state.initError = error
        console.error('❌ Live2D Cubism Core 初始化失败:', error)
        reject(error)
      }
    }, 100)
  })
  
  return state.initPromise
}

// 在 DOM 加载完成后开始初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeLive2DCubismCore, 100)
  })
} else {
  setTimeout(initializeLive2DCubismCore, 100)
}

// 导出给其他模块使用
export { checkLive2DCubismCore, initializeLive2DCubismCore }
