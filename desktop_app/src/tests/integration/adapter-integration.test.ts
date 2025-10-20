/**
 * 适配器集成测试
 * 
 * 测试适配器相关的集成功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { server } from '../setup'
import { rest } from 'msw'

describe('适配器集成测试', () => {
  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 重置 MSW 处理器
    server.resetHandlers()
  })

  describe('适配器列表获取', () => {
    it('应该能够获取适配器列表', async () => {
      const response = await fetch('/api/adapters')
      const data = await response.json()
      
      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('应该能够处理获取失败的情况', async () => {
      // 覆盖 handler 以返回错误
      server.use(
        rest.get('/api/adapters', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              error: '服务器错误',
            })
          )
        })
      )

      const response = await fetch('/api/adapters')
      const data = await response.json()
      
      expect(response.ok).toBe(false)
      expect(data.success).toBe(false)
      expect(data.error).toBe('服务器错误')
    })
  })

  describe('单个适配器获取', () => {
    it('应该能够获取单个适配器信息', async () => {
      const adapterId = 'test-adapter-1'
      const response = await fetch(`/api/adapters/${adapterId}`)
      const data = await response.json()
      
      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.data.name).toBe(adapterId)
    })

    it('应该处理适配器不存在的情况', async () => {
      const response = await fetch('/api/adapters/non-existent')
      const data = await response.json()
      
      expect(response.ok).toBe(false)
      expect(data.success).toBe(false)
      expect(data.error).toContain('未找到')
    })
  })

  describe('适配器元数据获取', () => {
    it('应该能够获取适配器元数据', async () => {
      const adapterId = 'test-adapter-1'
      const response = await fetch(`/api/adapters/${adapterId}/metadata`)
      const data = await response.json()
      
      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.data.id).toBe(adapterId)
      expect(data.data.capabilities).toBeDefined()
    })

    it('应该处理元数据不存在的情况', async () => {
      const response = await fetch('/api/adapters/non-existent/metadata')
      const data = await response.json()
      
      expect(response.ok).toBe(false)
      expect(data.success).toBe(false)
    })
  })

  describe('适配器加载', () => {
    it('应该能够加载适配器', async () => {
      const adapterId = 'test-adapter-1'
      const response = await fetch(`/api/adapters/${adapterId}/load`, {
        method: 'POST',
      })
      const data = await response.json()
      
      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('loaded')
    })

    it('应该处理加载失败的情况', async () => {
      server.use(
        rest.post('/api/adapters/:id/load', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              error: '加载失败',
            })
          )
        })
      )

      const response = await fetch('/api/adapters/test/load', {
        method: 'POST',
      })
      const data = await response.json()
      
      expect(response.ok).toBe(false)
      expect(data.success).toBe(false)
      expect(data.error).toBe('加载失败')
    })
  })

  describe('适配器卸载', () => {
    it('应该能够卸载适配器', async () => {
      const adapterId = 'test-adapter-1'
      const response = await fetch(`/api/adapters/${adapterId}/unload`, {
        method: 'POST',
      })
      const data = await response.json()
      
      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('unloaded')
    })
  })

  describe('适配器工作流', () => {
    it('应该能够完成完整的适配器工作流', async () => {
      // 1. 获取适配器列表
      let response = await fetch('/api/adapters')
      let data = await response.json()
      expect(data.success).toBe(true)
      const adapterId = data.data[0].name

      // 2. 获取适配器详情
      response = await fetch(`/api/adapters/${adapterId}`)
      data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.name).toBe(adapterId)

      // 3. 获取适配器元数据
      response = await fetch(`/api/adapters/${adapterId}/metadata`)
      data = await response.json()
      expect(data.success).toBe(true)

      // 4. 加载适配器
      response = await fetch(`/api/adapters/${adapterId}/load`, {
        method: 'POST',
      })
      data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('loaded')

      // 5. 卸载适配器
      response = await fetch(`/api/adapters/${adapterId}/unload`, {
        method: 'POST',
      })
      data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('unloaded')
    })
  })
})

describe('系统信息集成测试', () => {
  it('应该能够获取系统信息', async () => {
    const response = await fetch('/api/system/info')
    const data = await response.json()
    
    expect(response.ok).toBe(true)
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(data.data.os_name).toBeDefined()
    expect(data.data.cpu).toBeDefined()
    expect(data.data.memory).toBeDefined()
  })

  it('系统信息应该包含所有必要字段', async () => {
    const response = await fetch('/api/system/info')
    const data = await response.json()
    const systemInfo = data.data
    
    expect(systemInfo.os_name).toBeDefined()
    expect(systemInfo.os_version).toBeDefined()
    expect(systemInfo.arch).toBeDefined()
    expect(systemInfo.cpu).toBeDefined()
    expect(systemInfo.memory).toBeDefined()
    expect(systemInfo.disks).toBeDefined()
    expect(Array.isArray(systemInfo.disks)).toBe(true)
  })
})

describe('聊天集成测试', () => {
  it('应该能够发送聊天消息', async () => {
    const response = await fetch('/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello',
      }),
    })
    const data = await response.json()
    
    expect(response.ok).toBe(true)
    expect(data.success).toBe(true)
    expect(data.data.message).toContain('Hello')
  })

  it('应该处理空消息', async () => {
    server.use(
      rest.post('/api/chat/send', async (req, res, ctx) => {
        const body = await req.json()
        if (!body.message || body.message.trim() === '') {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              error: '消息不能为空',
            })
          )
        }
        return res(ctx.json({ success: true, data: {} }))
      })
    )

    const response = await fetch('/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '',
      }),
    })
    const data = await response.json()
    
    expect(response.ok).toBe(false)
    expect(data.success).toBe(false)
  })
})

describe('桌面信息集成测试', () => {
  it('应该能够获取桌面信息', async () => {
    const response = await fetch('/api/desktop/info')
    const data = await response.json()
    
    expect(response.ok).toBe(true)
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(data.data.screen_width).toBeGreaterThan(0)
    expect(data.data.screen_height).toBeGreaterThan(0)
    expect(Array.isArray(data.data.displays)).toBe(true)
  })

  it('显示器信息应该包含必要字段', async () => {
    const response = await fetch('/api/desktop/info')
    const data = await response.json()
    const display = data.data.displays[0]
    
    expect(display.index).toBeDefined()
    expect(display.name).toBeDefined()
    expect(display.width).toBeGreaterThan(0)
    expect(display.height).toBeGreaterThan(0)
    expect(display.refresh_rate).toBeGreaterThan(0)
  })
})

describe('错误处理集成测试', () => {
  it('应该正确处理 404 错误', async () => {
    const response = await fetch('/api/non-existent-endpoint')
    expect(response.ok).toBe(false)
  })

  it('应该正确处理 500 错误', async () => {
    const response = await fetch('/api/error')
    const data = await response.json()
    
    expect(response.ok).toBe(false)
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  it('错误响应应该包含时间戳', async () => {
    const response = await fetch('/api/error')
    const data = await response.json()
    
    expect(data.timestamp).toBeDefined()
    expect(typeof data.timestamp).toBe('number')
  })
})

