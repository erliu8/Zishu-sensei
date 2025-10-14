/**
 * WebGL诊断工具
 * 用于检测WebGL支持情况和具体问题
 */

export interface WebGLDiagnostics {
  isSupported: boolean
  version: string | null
  renderer: string | null
  vendor: string | null
  maxTextureSize: number | null
  maxVertexAttribs: number | null
  extensions: string[]
  errors: string[]
  contextLost: boolean
  canCreateContext: boolean
}

/**
 * 检测WebGL支持情况
 */
export function diagnoseWebGL(): WebGLDiagnostics {
  const diagnostics: WebGLDiagnostics = {
    isSupported: false,
    version: null,
    renderer: null,
    vendor: null,
    maxTextureSize: null,
    maxVertexAttribs: null,
    extensions: [],
    errors: [],
    contextLost: false,
    canCreateContext: false
  }

  try {
    // 创建临时canvas测试WebGL
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1

    // 尝试获取WebGL上下文
    let gl: WebGLRenderingContext | null = null
    
    try {
      gl = canvas.getContext('webgl') as WebGLRenderingContext || canvas.getContext('experimental-webgl') as WebGLRenderingContext
      diagnostics.canCreateContext = !!gl
    } catch (error) {
      diagnostics.errors.push(`无法创建WebGL上下文: ${error}`)
    }

    if (gl) {
      diagnostics.isSupported = true
      
      // 检查上下文是否丢失
      diagnostics.contextLost = gl.isContextLost()
      
      // 获取WebGL信息
      try {
        diagnostics.version = gl.getParameter(gl.VERSION)
        diagnostics.renderer = gl.getParameter(gl.RENDERER)
        diagnostics.vendor = gl.getParameter(gl.VENDOR)
        diagnostics.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
        diagnostics.maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS)
        
        // 获取支持的扩展
        const extensions = gl.getSupportedExtensions()
        if (extensions) {
          diagnostics.extensions = extensions
        }
      } catch (error) {
        diagnostics.errors.push(`获取WebGL参数失败: ${error}`)
      }

      // 检查WebGL错误
      const glError = gl.getError()
      if (glError !== gl.NO_ERROR) {
        diagnostics.errors.push(`WebGL错误: ${glError}`)
      }
    } else {
      diagnostics.errors.push('无法获取WebGL上下文')
    }

    // 清理
    canvas.remove()

  } catch (error) {
    diagnostics.errors.push(`WebGL诊断异常: ${error}`)
  }

  return diagnostics
}

/**
 * 打印WebGL诊断报告
 */
export function printWebGLDiagnostics(): void {
  const diagnostics = diagnoseWebGL()
  
  console.group('🔍 WebGL诊断报告')
  console.log('支持WebGL:', diagnostics.isSupported ? '✅' : '❌')
  console.log('可以创建上下文:', diagnostics.canCreateContext ? '✅' : '❌')
  console.log('上下文丢失:', diagnostics.contextLost ? '❌' : '✅')
  
  if (diagnostics.version) {
    console.log('WebGL版本:', diagnostics.version)
  }
  
  if (diagnostics.renderer) {
    console.log('渲染器:', diagnostics.renderer)
  }
  
  if (diagnostics.vendor) {
    console.log('厂商:', diagnostics.vendor)
  }
  
  if (diagnostics.maxTextureSize) {
    console.log('最大纹理尺寸:', diagnostics.maxTextureSize)
  }
  
  if (diagnostics.maxVertexAttribs) {
    console.log('最大顶点属性:', diagnostics.maxVertexAttribs)
  }
  
  if (diagnostics.extensions.length > 0) {
    console.log('支持的扩展:', diagnostics.extensions.length, '个')
    console.log('扩展列表:', diagnostics.extensions)
  }
  
  if (diagnostics.errors.length > 0) {
    console.group('❌ 错误信息')
    diagnostics.errors.forEach(error => console.error(error))
    console.groupEnd()
  }
  
  console.groupEnd()
}

/**
 * 尝试修复WebGL问题
 */
export function attemptWebGLFix(): boolean {
  try {
    // 清理可能的WebGL状态
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') as WebGLRenderingContext || canvas.getContext('experimental-webgl') as WebGLRenderingContext
    
    if (gl) {
      // 强制清理WebGL状态
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.flush()
      gl.finish()
      
      // 检查是否有错误
      const error = gl.getError()
      if (error !== gl.NO_ERROR) {
        console.warn('WebGL清理时发现错误:', error)
      }
      
      canvas.remove()
      return true
    }
    
    canvas.remove()
    return false
  } catch (error) {
    console.error('WebGL修复尝试失败:', error)
    return false
  }
}

/**
 * 检查Tauri环境下的WebGL特殊问题
 */
export function checkTauriWebGLIssues(): string[] {
  const issues: string[] = []
  
  // 检查是否在Tauri环境中
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    // 检查GPU加速是否被禁用
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') as WebGLRenderingContext
    
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        if (renderer && renderer.includes('SwiftShader')) {
          issues.push('检测到软件渲染器(SwiftShader)，GPU加速可能被禁用')
        }
      }
    } else {
      issues.push('在Tauri环境中无法创建WebGL上下文')
    }
    
    canvas.remove()
  }
  
  return issues
}
