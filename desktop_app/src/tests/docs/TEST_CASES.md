# 🧪 测试用例详细模板

## 📋 测试用例设计规范

### 测试用例结构

```typescript
/**
 * 测试套件: [功能模块名称]
 * 描述: [功能模块的详细描述]
 * 优先级: P0/P1/P2
 * 测试类型: 单元/集成/E2E
 * 预计执行时间: [分钟]
 */
describe('[功能模块名称]', () => {
  // 测试前置条件
  beforeEach(() => {
    // 设置测试环境
  })

  // 测试后清理
  afterEach(() => {
    // 清理测试数据
  })

  // 正常流程测试
  describe('正常流程', () => {
    it('应该 [具体预期行为]', async () => {
      // Arrange - 准备测试数据
      // Act - 执行测试操作  
      // Assert - 验证结果
    })
  })

  // 异常情况测试
  describe('异常情况', () => {
    it('应该在 [异常条件] 时 [预期行为]', async () => {
      // 异常情况测试
    })
  })

  // 边界条件测试
  describe('边界条件', () => {
    it('应该处理 [边界条件]', async () => {
      // 边界条件测试
    })
  })
})
```

---

## 🎭 前端测试用例

### Character 组件测试

```typescript
/**
 * 测试套件: Character 组件
 * 描述: Live2D 角色显示和交互功能
 * 优先级: P0
 * 测试类型: 单元 + 集成
 */
describe('Character 组件', () => {
  let mockCharacter: CharacterData
  let mockTauriApi: any

  beforeEach(() => {
    mockCharacter = {
      id: 'test-character',
      name: '测试角色',
      modelPath: '/test/model',
      animations: ['idle', 'happy', 'sad']
    }
    
    mockTauriApi = {
      invoke: vi.fn(),
      listen: vi.fn()
    }
    
    vi.mock('@tauri-apps/api/tauri', () => mockTauriApi)
  })

  describe('正常流程', () => {
    it('应该正确渲染角色模型', async () => {
      // Arrange
      render(<Character character={mockCharacter} />)
      
      // Act
      await waitFor(() => {
        expect(screen.getByTestId('character-container')).toBeInTheDocument()
      })
      
      // Assert
      expect(screen.getByText('测试角色')).toBeInTheDocument()
    })

    it('应该播放指定动画', async () => {
      // Arrange
      render(<Character character={mockCharacter} />)
      
      // Act
      await userEvent.click(screen.getByTestId('play-animation'))
      
      // Assert
      expect(mockTauriApi.invoke).toHaveBeenCalledWith('play_animation', {
        animation: 'happy'
      })
    })

    it('应该响应点击交互', async () => {
      // Arrange
      render(<Character character={mockCharacter} />)
      
      // Act
      await userEvent.click(screen.getByTestId('character-model'))
      
      // Assert
      expect(mockTauriApi.invoke).toHaveBeenCalledWith('trigger_interaction')
    })
  })

  describe('异常情况', () => {
    it('应该在模型加载失败时显示错误信息', async () => {
      // Arrange
      mockTauriApi.invoke.mockRejectedValue(new Error('模型加载失败'))
      
      // Act
      render(<Character character={mockCharacter} />)
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText('模型加载失败')).toBeInTheDocument()
      })
    })

    it('应该在动画播放失败时显示警告', async () => {
      // Arrange
      mockTauriApi.invoke.mockRejectedValue(new Error('动画播放失败'))
      render(<Character character={mockCharacter} />)
      
      // Act
      await userEvent.click(screen.getByTestId('play-animation'))
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText('动画播放失败')).toBeInTheDocument()
      })
    })
  })

  describe('边界条件', () => {
    it('应该处理空动画列表', async () => {
      // Arrange
      const characterWithNoAnimations = {
        ...mockCharacter,
        animations: []
      }
      
      // Act
      render(<Character character={characterWithNoAnimations} />)
      
      // Assert
      expect(screen.getByTestId('no-animations')).toBeInTheDocument()
    })

    it('应该处理无效的模型路径', async () => {
      // Arrange
      const characterWithInvalidPath = {
        ...mockCharacter,
        modelPath: ''
      }
      
      // Act
      render(<Character character={characterWithInvalidPath} />)
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText('模型路径无效')).toBeInTheDocument()
      })
    })
  })
})
```

### Chat 组件测试

```typescript
/**
 * 测试套件: Chat 组件
 * 描述: 聊天功能和消息管理
 * 优先级: P0
 * 测试类型: 单元 + 集成
 */
describe('Chat 组件', () => {
  let mockChatService: any
  let mockMessages: Message[]

  beforeEach(() => {
    mockMessages = [
      { id: '1', content: 'Hello', sender: 'user', timestamp: Date.now() },
      { id: '2', content: 'Hi there!', sender: 'assistant', timestamp: Date.now() }
    ]
    
    mockChatService = {
      sendMessage: vi.fn(),
      getMessages: vi.fn().mockResolvedValue(mockMessages),
      clearHistory: vi.fn()
    }
    
    vi.mock('../services/chatService', () => mockChatService)
  })

  describe('正常流程', () => {
    it('应该显示消息列表', async () => {
      // Arrange
      render(<Chat />)
      
      // Act
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument()
        expect(screen.getByText('Hi there!')).toBeInTheDocument()
      })
    })

    it('应该发送用户消息', async () => {
      // Arrange
      render(<Chat />)
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      // Act
      await userEvent.type(input, 'Test message')
      await userEvent.click(sendButton)
      
      // Assert
      expect(mockChatService.sendMessage).toHaveBeenCalledWith('Test message')
    })

    it('应该显示发送状态', async () => {
      // Arrange
      mockChatService.sendMessage.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )
      render(<Chat />)
      
      // Act
      await userEvent.type(screen.getByTestId('message-input'), 'Test')
      await userEvent.click(screen.getByTestId('send-button'))
      
      // Assert
      expect(screen.getByTestId('sending-indicator')).toBeInTheDocument()
    })
  })

  describe('异常情况', () => {
    it('应该在发送失败时显示错误信息', async () => {
      // Arrange
      mockChatService.sendMessage.mockRejectedValue(new Error('发送失败'))
      render(<Chat />)
      
      // Act
      await userEvent.type(screen.getByTestId('message-input'), 'Test')
      await userEvent.click(screen.getByTestId('send-button'))
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText('发送失败')).toBeInTheDocument()
      })
    })

    it('应该处理网络超时', async () => {
      // Arrange
      mockChatService.sendMessage.mockRejectedValue(new Error('网络超时'))
      render(<Chat />)
      
      // Act
      await userEvent.type(screen.getByTestId('message-input'), 'Test')
      await userEvent.click(screen.getByTestId('send-button'))
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText('网络超时，请重试')).toBeInTheDocument()
      })
    })
  })

  describe('边界条件', () => {
    it('应该处理空消息', async () => {
      // Arrange
      render(<Chat />)
      
      // Act
      await userEvent.click(screen.getByTestId('send-button'))
      
      // Assert
      expect(mockChatService.sendMessage).not.toHaveBeenCalled()
    })

    it('应该处理超长消息', async () => {
      // Arrange
      const longMessage = 'a'.repeat(1000)
      render(<Chat />)
      
      // Act
      await userEvent.type(screen.getByTestId('message-input'), longMessage)
      
      // Assert
      expect(screen.getByTestId('message-length-warning')).toBeInTheDocument()
    })
  })
})
```

---

## 🦀 后端测试用例

### Tauri 命令测试

```rust
/**
 * 测试套件: 系统命令
 * 描述: Tauri 系统相关命令测试
 * 优先级: P0
 * 测试类型: 单元
 */
#[cfg(test)]
mod system_commands_tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_get_system_info() {
        // Arrange
        let result = get_system_info().await;
        
        // Assert
        assert!(result.is_ok());
        let info = result.unwrap();
        assert!(!info.os.is_empty());
        assert!(!info.arch.is_empty());
    }

    #[tokio::test]
    async fn test_get_window_state() {
        // Arrange
        let result = get_window_state().await;
        
        // Assert
        assert!(result.is_ok());
        let state = result.unwrap();
        assert!(state.width > 0);
        assert!(state.height > 0);
    }

    #[tokio::test]
    async fn test_set_window_always_on_top() {
        // Arrange
        let result = set_window_always_on_top(true).await;
        
        // Assert
        assert!(result.is_ok());
    }
}

/**
 * 测试套件: 配置管理
 * 描述: 应用配置的保存和加载
 * 优先级: P0
 * 测试类型: 单元 + 集成
 */
#[cfg(test)]
mod config_tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_save_config() {
        // Arrange
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");
        let config = AppConfig {
            theme: "dark".to_string(),
            language: "zh-CN".to_string(),
            auto_start: true,
        };
        
        // Act
        let result = save_config(&config_path, &config).await;
        
        // Assert
        assert!(result.is_ok());
        assert!(config_path.exists());
    }

    #[tokio::test]
    async fn test_load_config() {
        // Arrange
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");
        let original_config = AppConfig {
            theme: "light".to_string(),
            language: "en-US".to_string(),
            auto_start: false,
        };
        save_config(&config_path, &original_config).await.unwrap();
        
        // Act
        let result = load_config(&config_path).await;
        
        // Assert
        assert!(result.is_ok());
        let loaded_config = result.unwrap();
        assert_eq!(loaded_config.theme, "light");
        assert_eq!(loaded_config.language, "en-US");
        assert_eq!(loaded_config.auto_start, false);
    }

    #[tokio::test]
    async fn test_load_config_file_not_found() {
        // Arrange
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("nonexistent.json");
        
        // Act
        let result = load_config(&config_path).await;
        
        // Assert
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_load_config_invalid_json() {
        // Arrange
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("invalid.json");
        std::fs::write(&config_path, "invalid json").unwrap();
        
        // Act
        let result = load_config(&config_path).await;
        
        // Assert
        assert!(result.is_err());
    }
}
```

### AI 服务测试

```rust
/**
 * 测试套件: AI 服务
 * 描述: AI API 调用和响应处理
 * 优先级: P0
 * 测试类型: 单元 + 集成
 */
#[cfg(test)]
mod ai_service_tests {
    use super::*;
    use mockito::{mock, server_url};

    #[tokio::test]
    async fn test_send_message_success() {
        // Arrange
        let mock_response = mock("POST", "/api/chat")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"response": "Hello! How can I help you?"}"#)
            .create();

        let ai_service = AiService::new(&server_url());
        
        // Act
        let result = ai_service.send_message("Hello").await;
        
        // Assert
        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.content, "Hello! How can I help you?");
        
        mock_response.assert();
    }

    #[tokio::test]
    async fn test_send_message_api_error() {
        // Arrange
        let mock_response = mock("POST", "/api/chat")
            .with_status(500)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error": "Internal Server Error"}"#)
            .create();

        let ai_service = AiService::new(&server_url());
        
        // Act
        let result = ai_service.send_message("Hello").await;
        
        // Assert
        assert!(result.is_err());
        
        mock_response.assert();
    }

    #[tokio::test]
    async fn test_send_message_network_timeout() {
        // Arrange
        let ai_service = AiService::new("http://timeout-server");
        ai_service.set_timeout(Duration::from_millis(100));
        
        // Act
        let result = ai_service.send_message("Hello").await;
        
        // Assert
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("timeout"));
    }

    #[tokio::test]
    async fn test_send_message_rate_limit() {
        // Arrange
        let mock_response = mock("POST", "/api/chat")
            .with_status(429)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error": "Rate limit exceeded"}"#)
            .create();

        let ai_service = AiService::new(&server_url());
        
        // Act
        let result = ai_service.send_message("Hello").await;
        
        // Assert
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("rate limit"));
        
        mock_response.assert();
    }
}
```

---

## 🔗 集成测试用例

### 前后端通信测试

```typescript
/**
 * 测试套件: 前后端通信
 * 描述: Tauri IPC 通信测试
 * 优先级: P0
 * 测试类型: 集成
 */
describe('前后端通信', () => {
  let mockTauriApi: any

  beforeEach(() => {
    mockTauriApi = {
      invoke: vi.fn(),
      listen: vi.fn(),
      emit: vi.fn()
    }
    
    vi.mock('@tauri-apps/api/tauri', () => mockTauriApi)
  })

  describe('命令调用', () => {
    it('应该成功调用后端命令', async () => {
      // Arrange
      mockTauriApi.invoke.mockResolvedValue({ success: true })
      
      // Act
      const result = await invokeCommand('get_system_info')
      
      // Assert
      expect(result.success).toBe(true)
      expect(mockTauriApi.invoke).toHaveBeenCalledWith('get_system_info')
    })

    it('应该处理命令调用失败', async () => {
      // Arrange
      mockTauriApi.invoke.mockRejectedValue(new Error('Command failed'))
      
      // Act & Assert
      await expect(invokeCommand('invalid_command')).rejects.toThrow('Command failed')
    })
  })

  describe('事件监听', () => {
    it('应该监听后端事件', async () => {
      // Arrange
      const mockUnlisten = vi.fn()
      mockTauriApi.listen.mockResolvedValue(mockUnlisten)
      
      // Act
      const unlisten = await listenToEvent('system_update')
      
      // Assert
      expect(mockTauriApi.listen).toHaveBeenCalledWith('system_update', expect.any(Function))
      expect(unlisten).toBe(mockUnlisten)
    })

    it('应该处理事件监听错误', async () => {
      // Arrange
      mockTauriApi.listen.mockRejectedValue(new Error('Listen failed'))
      
      // Act & Assert
      await expect(listenToEvent('invalid_event')).rejects.toThrow('Listen failed')
    })
  })
})
```

---

## 🌐 E2E 测试用例

### 完整用户流程测试

```typescript
/**
 * 测试套件: 完整用户流程
 * 描述: 端到端用户交互测试
 * 优先级: P0
 * 测试类型: E2E
 */
describe('完整用户流程', () => {
  beforeEach(async () => {
    // 启动应用
    await page.goto('http://localhost:1424')
    await page.waitForLoadState('networkidle')
  })

  describe('应用启动流程', () => {
    it('应该成功启动并显示主界面', async () => {
      // Assert
      await expect(page.getByTestId('main-container')).toBeVisible()
      await expect(page.getByTestId('character-container')).toBeVisible()
      await expect(page.getByTestId('chat-container')).toBeVisible()
    })

    it('应该加载默认角色', async () => {
      // Assert
      await expect(page.getByTestId('character-name')).toContainText('Zishu Sensei')
      await expect(page.getByTestId('character-model')).toBeVisible()
    })
  })

  describe('聊天功能流程', () => {
    it('应该完成完整的聊天流程', async () => {
      // Act
      await page.getByTestId('message-input').fill('Hello, how are you?')
      await page.getByTestId('send-button').click()
      
      // Assert
      await expect(page.getByTestId('message-list')).toContainText('Hello, how are you?')
      await expect(page.getByTestId('sending-indicator')).toBeVisible()
      
      // 等待 AI 响应
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })
      await expect(page.getByTestId('ai-message')).toBeVisible()
    })

    it('应该保存聊天历史', async () => {
      // Arrange
      await page.getByTestId('message-input').fill('Test message')
      await page.getByTestId('send-button').click()
      await page.waitForSelector('[data-testid="ai-message"]')
      
      // Act
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Assert
      await expect(page.getByTestId('message-list')).toContainText('Test message')
    })
  })

  describe('设置功能流程', () => {
    it('应该能够修改设置并保存', async () => {
      // Act
      await page.getByTestId('settings-button').click()
      await page.getByTestId('theme-selector').selectOption('dark')
      await page.getByTestId('language-selector').selectOption('en-US')
      await page.getByTestId('save-settings').click()
      
      // Assert
      await expect(page.getByTestId('success-message')).toContainText('设置已保存')
      
      // 验证设置生效
      await page.reload()
      await expect(page.getByTestId('theme-dark')).toBeVisible()
    })
  })

  describe('错误处理流程', () => {
    it('应该处理网络错误', async () => {
      // Arrange
      await page.route('**/api/chat', route => route.abort())
      
      // Act
      await page.getByTestId('message-input').fill('Test message')
      await page.getByTestId('send-button').click()
      
      // Assert
      await expect(page.getByTestId('error-message')).toContainText('网络错误')
    })

    it('应该处理应用崩溃恢复', async () => {
      // Arrange
      await page.getByTestId('crash-button').click()
      
      // Act
      await page.waitForSelector('[data-testid="crash-recovery"]')
      await page.getByTestId('recover-button').click()
      
      // Assert
      await expect(page.getByTestId('main-container')).toBeVisible()
    })
  })
})
```

---

## 📊 测试数据管理

### 测试数据工厂

```typescript
// 测试数据工厂
export class TestDataFactory {
  static createCharacter(overrides: Partial<CharacterData> = {}): CharacterData {
    return {
      id: 'test-character',
      name: '测试角色',
      modelPath: '/test/model',
      animations: ['idle', 'happy', 'sad'],
      ...overrides
    }
  }

  static createMessage(overrides: Partial<Message> = {}): Message {
    return {
      id: `msg-${Date.now()}`,
      content: '测试消息',
      sender: 'user',
      timestamp: Date.now(),
      ...overrides
    }
  }

  static createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
    return {
      theme: 'light',
      language: 'zh-CN',
      autoStart: false,
      ...overrides
    }
  }
}

// Mock 数据生成器
export class MockDataGenerator {
  static generateMessages(count: number): Message[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `msg-${index}`,
      content: `测试消息 ${index}`,
      sender: index % 2 === 0 ? 'user' : 'assistant',
      timestamp: Date.now() - (count - index) * 1000
    }))
  }

  static generateCharacters(count: number): CharacterData[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `char-${index}`,
      name: `角色 ${index}`,
      modelPath: `/models/char-${index}`,
      animations: ['idle', 'happy', 'sad', 'angry']
    }))
  }
}
```

---

## 🎯 测试执行检查清单

### 测试前准备
- [ ] 测试环境已配置
- [ ] 测试数据已准备
- [ ] Mock 服务已启动
- [ ] 测试依赖已安装

### 测试执行
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] E2E 测试通过
- [ ] 性能测试通过

### 测试后验证
- [ ] 覆盖率达标
- [ ] 测试报告生成
- [ ] 缺陷已记录
- [ ] 测试环境清理

---

**文档版本**: v1.0  
**最后更新**: 2024年12月  
**维护者**: 测试团队
