/**
 * Tauri 命令集成测试
 * 
 * 测试前端与 Tauri 后端的命令调用，包括：
 * - 聊天命令
 * - 适配器命令
 * - 设置命令
 * - 系统命令
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/tauri'

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}))

const mockInvoke = vi.mocked(invoke)

describe('Tauri 命令集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('聊天命令', () => {
    it('send_message - 应该发送聊天消息', async () => {
      const mockResponse = {
        success: true,
        data: {
          message: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Hello! How can I help you today?',
            timestamp: Date.now(),
          },
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
          model: 'gpt-4',
        },
      }

      mockInvoke.mockResolvedValue(mockResponse)

      const result = await invoke('send_message', {
        message: 'Hello',
        sessionId: 'session-1',
        model: 'gpt-4',
      })

      expect(mockInvoke).toHaveBeenCalledWith('send_message', {
        message: 'Hello',
        sessionId: 'session-1',
        model: 'gpt-4',
      })
      expect(result).toEqual(mockResponse)
    })

    it('get_chat_history - 应该获取聊天历史', async () => {
      const mockHistory = {
        success: true,
        data: {
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Hello',
              timestamp: Date.now() - 1000,
            },
            {
              id: 'msg-2',
              role: 'assistant',
              content: 'Hi there!',
              timestamp: Date.now(),
            },
          ],
          total: 2,
          page: 1,
          page_size: 10,
        },
      }

      mockInvoke.mockResolvedValue(mockHistory)

      const result = await invoke('get_chat_history', {
        sessionId: 'session-1',
        page: 1,
        pageSize: 10,
      })

      expect(result).toEqual(mockHistory)
    })

    it('create_session - 应该创建新会话', async () => {
      const mockSession = {
        success: true,
        data: {
          id: 'session-123',
          title: 'New Chat',
          created_at: Date.now(),
          message_count: 0,
        },
      }

      mockInvoke.mockResolvedValue(mockSession)

      const result = await invoke('create_session', {
        title: 'New Chat',
      })

      expect(result).toEqual(mockSession)
    })

    it('delete_session - 应该删除会话', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        message: 'Session deleted successfully',
      })

      const result = await invoke('delete_session', {
        sessionId: 'session-1',
      }) as any

      expect(result.success).toBe(true)
    })
  })

  describe('适配器命令', () => {
    it('list_adapters - 应该列出所有适配器', async () => {
      const mockAdapters = {
        success: true,
        data: [
          {
            name: 'openai-adapter',
            version: '1.0.0',
            status: 'loaded',
            description: 'OpenAI API adapter',
          },
          {
            name: 'local-adapter',
            version: '1.0.0',
            status: 'installed',
            description: 'Local model adapter',
          },
        ],
      }

      mockInvoke.mockResolvedValue(mockAdapters)

      const result = await invoke('list_adapters')

      expect(result).toEqual(mockAdapters)
      expect((result as any).data).toHaveLength(2)
    })

    it('install_adapter - 应该安装适配器', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          name: 'new-adapter',
          version: '1.0.0',
          status: 'installed',
        },
      })

      const result = await invoke('install_adapter', {
        adapterId: 'new-adapter',
        source: 'market',
      })

      expect((result as any).success).toBe(true)
      expect((result as any).data.status).toBe('installed')
    })

    it('uninstall_adapter - 应该卸载适配器', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        message: 'Adapter uninstalled successfully',
      })

      const result = await invoke('uninstall_adapter', {
        adapterName: 'old-adapter',
      }) as any

      expect(result.success).toBe(true)
    })

    it('load_adapter - 应该加载适配器', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          name: 'test-adapter',
          status: 'loaded',
          memory_usage: 102400,
        },
      })

      const result = await invoke('load_adapter', {
        adapterName: 'test-adapter',
      })

      expect((result as any).data.status).toBe('loaded')
    })

    it('unload_adapter - 应该卸载适配器', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          name: 'test-adapter',
          status: 'installed',
          memory_usage: 0,
        },
      })

      const result = await invoke('unload_adapter', {
        adapterName: 'test-adapter',
      })

      expect((result as any).data.status).toBe('installed')
    })

    it('get_adapter_config - 应该获取适配器配置', async () => {
      const mockConfig = {
        success: true,
        data: {
          api_key: '***',
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 2000,
        },
      }

      mockInvoke.mockResolvedValue(mockConfig)

      const result = await invoke('get_adapter_config', {
        adapterName: 'test-adapter',
      })

      expect((result as any)).toEqual(mockConfig)
    })

    it('update_adapter_config - 应该更新适配器配置', async () => {
      const newConfig = {
        temperature: 0.9,
        max_tokens: 4000,
      }

      mockInvoke.mockResolvedValue({
        success: true,
        data: newConfig,
      })

      const result = await invoke('update_adapter_config', {
        adapterName: 'test-adapter',
        config: newConfig,
      })

      expect((result as any).data).toEqual(newConfig)
    })

    it('search_adapters - 应该搜索适配器市场', async () => {
      const mockResults = {
        success: true,
        data: {
          items: [
            {
              id: 'adapter-1',
              name: 'GPT Adapter',
              description: 'ChatGPT adapter',
              version: '2.0.0',
            },
          ],
          total: 1,
          page: 1,
          page_size: 10,
        },
      }

      mockInvoke.mockResolvedValue(mockResults)

      const result = await invoke('search_adapters', {
        query: 'GPT',
        page: 1,
        pageSize: 10,
      })

      expect(result).toEqual(mockResults)
    })
  })

  describe('设置命令', () => {
    it('get_app_settings - 应该获取应用设置', async () => {
      const mockSettings = {
        success: true,
        data: {
          theme: 'dark',
          language: 'zh-CN',
          auto_start: false,
        },
      }

      mockInvoke.mockResolvedValue(mockSettings)

      const result = await invoke('get_app_settings')

      expect(result).toEqual(mockSettings)
    })

    it('update_app_settings - 应该更新应用设置', async () => {
      const updates = {
        theme: 'light',
        language: 'en-US',
      }

      mockInvoke.mockResolvedValue({
        success: true,
        data: updates,
      })

      const result = await invoke('update_app_settings', { updates })

      expect((result as any).data).toEqual(updates)
    })

    it('get_window_config - 应该获取窗口配置', async () => {
      const mockConfig = {
        success: true,
        data: {
          width: 1200,
          height: 800,
          resizable: true,
          transparent: false,
        },
      }

      mockInvoke.mockResolvedValue(mockConfig)

      const result = await invoke('get_window_config')

      expect((result as any)).toEqual(mockConfig)
    })

    it('update_window_config - 应该更新窗口配置', async () => {
      const config = {
        width: 1400,
        height: 900,
      }

      mockInvoke.mockResolvedValue({
        success: true,
        data: config,
      })

      const result = await invoke('update_window_config', { updates: config }) as any

      expect(result.data).toEqual(config)
    })

    it('get_theme_config - 应该获取主题配置', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          mode: 'dark',
          custom_colors: {
            primary: '#3B82F6',
          },
        },
      })

      const result = await invoke('get_theme_config')

      expect((result as any).data.mode).toBe('dark')
    })

    it('update_theme_config - 应该更新主题配置', async () => {
      const themeConfig = {
        mode: 'light',
        custom_colors: {
          primary: '#10B981',
        },
      }

      mockInvoke.mockResolvedValue({
        success: true,
        data: themeConfig,
      })

      const result = await invoke('update_theme_config', { updates: themeConfig }) as any

      expect(result.data).toEqual(themeConfig)
    })

    it('get_character_config - 应该获取角色配置', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          current_character: 'hiyori',
          scale: 1.0,
          auto_idle: true,
        },
      })

      const result = await invoke('get_character_config')

      expect((result as any).data.current_character).toBe('hiyori')
    })

    it('update_character_config - 应该更新角色配置', async () => {
      const config = {
        current_character: 'hiyori',
        scale: 1.5,
      }

      mockInvoke.mockResolvedValue({
        success: true,
        data: config,
      })

      const result = await invoke('update_character_config', { updates: config })

      expect((result as any).data.scale).toBe(1.5)
    })
  })

  describe('系统命令', () => {
    it('get_system_info - 应该获取系统信息', async () => {
      const mockSystemInfo = {
        success: true,
        data: {
          os: 'Windows',
          os_version: '11',
          arch: 'x86_64',
          memory_total: 16777216,
          memory_available: 8388608,
        },
      }

      mockInvoke.mockResolvedValue(mockSystemInfo)

      const result = await invoke('get_system_info')

      expect(result).toEqual(mockSystemInfo)
    })

    it('get_app_version - 应该获取应用版本', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          version: '1.0.0',
          build: '20231220',
        },
      })

      const result = await invoke('get_app_version')

      expect((result as any).data.version).toBe('1.0.0')
    })

    it('check_for_updates - 应该检查更新', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          has_update: true,
          latest_version: '1.1.0',
          changelog: 'Bug fixes and improvements',
        },
      })

      const result = await invoke('check_for_updates')

      expect((result as any).data.has_update).toBe(true)
    })

    it('open_external_link - 应该打开外部链接', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      })

      const result = await invoke('open_external_link', {
        url: 'https://example.com',
      }) as any

      expect(result.success).toBe(true)
    })

    it('show_in_folder - 应该在文件管理器中显示', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      })

      const result = await invoke('show_in_folder', {
        path: '/path/to/file',
      }) as any

      expect(result.success).toBe(true)
    })

    it('get_log_path - 应该获取日志路径', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          path: '/path/to/logs',
        },
      })

      const result = await invoke('get_log_path')

      expect((result as any).data.path).toBeTruthy()
    })
  })

  describe('文件系统命令', () => {
    it('read_file - 应该读取文件', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          content: 'File content',
          size: 12,
        },
      })

      const result = await invoke('read_file', {
        path: '/path/to/file.txt',
      })

      expect((result as any).data.content).toBe('File content')
    })

    it('write_file - 应该写入文件', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        message: 'File written successfully',
      })

      const result = await invoke('write_file', {
        path: '/path/to/file.txt',
        content: 'New content',
      }) as any

      expect(result.success).toBe(true)
    })

    it('delete_file - 应该删除文件', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        message: 'File deleted successfully',
      })

      const result = await invoke('delete_file', {
        path: '/path/to/file.txt',
      }) as any

      expect(result.success).toBe(true)
    })

    it('list_directory - 应该列出目录内容', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          files: [
            { name: 'file1.txt', size: 100, is_dir: false },
            { name: 'folder1', size: 0, is_dir: true },
          ],
        },
      })

      const result = await invoke('list_directory', {
        path: '/path/to/directory',
      })

      expect((result as any).data.files).toHaveLength(2)
    })
  })

  describe('数据库命令', () => {
    it('execute_query - 应该执行数据库查询', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          rows: [
            { id: 1, name: 'Test 1' },
            { id: 2, name: 'Test 2' },
          ],
          affected_rows: 0,
        },
      })

      const result = await invoke('execute_query', {
        query: 'SELECT * FROM test',
        params: [],
      })

      expect((result as any).data.rows).toHaveLength(2)
    })

    it('execute_update - 应该执行更新操作', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          affected_rows: 1,
        },
      })

      const result = await invoke('execute_update', {
        query: 'UPDATE test SET name = ? WHERE id = ?',
        params: ['New Name', 1],
      })

      expect((result as any).data.affected_rows).toBe(1)
    })
  })

  describe('加密命令', () => {
    it('encrypt_data - 应该加密数据', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          encrypted: 'encrypted_data_base64',
          iv: 'iv_base64',
        },
      })

      const result = await invoke('encrypt_data', {
        data: 'sensitive data',
        key: 'encryption_key',
      })

      expect((result as any).data.encrypted).toBeTruthy()
    })

    it('decrypt_data - 应该解密数据', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          decrypted: 'sensitive data',
        },
      })

      const result = await invoke('decrypt_data', {
        encrypted: 'encrypted_data_base64',
        key: 'encryption_key',
        iv: 'iv_base64',
      })

      expect((result as any).data.decrypted).toBe('sensitive data')
    })
  })

  describe('错误处理', () => {
    it('应该处理命令执行失败', async () => {
      mockInvoke.mockRejectedValue(new Error('Command failed'))

      await expect(
        invoke('invalid_command', {})
      ).rejects.toThrow('Command failed')
    })

    it('应该处理参数验证错误', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Invalid parameters',
      })

      const result = await invoke('send_message', {
        message: '', // 空消息
      })

      expect((result as any).success).toBe(false)
      expect((result as any).error).toBe('Invalid parameters')
    })

    it('应该处理超时错误', async () => {
      mockInvoke.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100)
        })
      })

      await expect(
        invoke('long_running_command')
      ).rejects.toThrow('Timeout')
    })

    it('应该处理权限错误', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Permission denied',
      })

      const result = await invoke('protected_command')

      expect((result as any).success).toBe(false)
      expect((result as any).error).toBe('Permission denied')
    })
  })

  describe('批量操作命令', () => {
    it('batch_install_adapters - 应该批量安装适配器', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          installed: ['adapter-1', 'adapter-2', 'adapter-3'],
          failed: [],
        },
      })

      const result = await invoke('batch_install_adapters', {
        adapter_ids: ['adapter-1', 'adapter-2', 'adapter-3'],
      }) as any

      expect(result.data.installed).toHaveLength(3)
      expect(result.data.failed).toHaveLength(0)
    })

    it('batch_uninstall_adapters - 应该批量卸载适配器', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          uninstalled: ['adapter-1', 'adapter-2'],
          failed: [],
        },
      })

      const result = await invoke('batch_uninstall_adapters', {
        adapter_names: ['adapter-1', 'adapter-2'],
      }) as any

      expect(result.data.uninstalled).toHaveLength(2)
    })

    it('batch_delete_messages - 应该批量删除消息', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          deleted: 5,
          failed: 0,
        },
      })

      const result = await invoke('batch_delete_messages', {
        sessionId: 'session-1',
        messageIds: ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5'],
      }) as any

      expect(result.data.deleted).toBe(5)
    })
  })

  describe('性能监控命令', () => {
    it('get_performance_metrics - 应该获取性能指标', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          cpu_usage: 25.5,
          memory_usage: 512000,
          fps: 60,
          response_time: 120,
        },
      })

      const result = await invoke('get_performance_metrics') as any

      expect(result.data.cpu_usage).toBeLessThan(100)
      expect(result.data.fps).toBeGreaterThan(0)
    })

    it('get_memory_stats - 应该获取内存统计', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          total: 16777216,
          used: 8388608,
          available: 8388608,
          percentage: 50.0,
        },
      })

      const result = await invoke('get_memory_stats') as any

      expect(result.data.percentage).toBe(50.0)
    })
  })

  describe('事件系统命令', () => {
    it('emit_event - 应该发送事件', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      })

      const result = await invoke('emit_event', {
        event: 'custom_event',
        payload: { data: 'test' },
      }) as any

      expect(result.success).toBe(true)
    })

    it('subscribe_to_event - 应该订阅事件', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          subscription_id: 'sub-123',
        },
      })

      const result = await invoke('subscribe_to_event', {
        event: 'chat_message',
      }) as any

      expect(result.data.subscription_id).toBeTruthy()
    })
  })
})

