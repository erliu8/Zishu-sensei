/**
 * E2E 测试 Mock 数据工厂
 * 提供测试所需的模拟数据
 */

/**
 * 聊天消息工厂
 */
export const createMessage = (
  overrides?: Partial<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    status: 'sending' | 'sent' | 'failed';
    animation?: string;
    expression?: string;
    adapter_id?: string;
  }>
) => ({
  id: `msg-${Date.now()}-${Math.random()}`,
  role: 'user' as const,
  content: 'Test message',
  timestamp: Date.now(),
  status: 'sent' as const,
  ...overrides,
});

/**
 * 用户消息工厂
 */
export const createUserMessage = (content: string, overrides?: any) =>
  createMessage({
    role: 'user',
    content,
    ...overrides,
  });

/**
 * AI 消息工厂
 */
export const createAIMessage = (
  content: string,
  overrides?: any
) =>
  createMessage({
    role: 'assistant',
    content,
    ...overrides,
  });

/**
 * 会话工厂
 */
export const createConversation = (
  overrides?: Partial<{
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
    message_count: number;
    character_id: string;
  }>
) => ({
  id: `conv-${Date.now()}`,
  title: '新对话',
  created_at: Date.now(),
  updated_at: Date.now(),
  message_count: 0,
  character_id: 'hiyori',
  ...overrides,
});

/**
 * 角色工厂
 */
export const createCharacter = (
  overrides?: Partial<{
    id: string;
    name: string;
    description: string;
    model_path: string;
    avatar: string;
    personality: string;
    voice: string;
  }>
) => ({
  id: `char-${Date.now()}`,
  name: 'Test Character',
  description: '测试角色',
  model_path: '/models/test',
  avatar: '/avatars/test.png',
  personality: 'friendly',
  voice: 'default',
  ...overrides,
});

/**
 * Hiyori 角色
 */
export const HIYORI_CHARACTER = createCharacter({
  id: 'hiyori',
  name: 'Hiyori',
  description: '活泼可爱的女孩',
  model_path: '/models/hiyori',
  avatar: '/avatars/hiyori.png',
  personality: 'cheerful',
});

/**
 * Shizuku 角色
 */
export const SHIZUKU_CHARACTER = createCharacter({
  id: 'shizuku',
  name: 'Shizuku',
  description: '温柔体贴的少女',
  model_path: '/models/shizuku',
  avatar: '/avatars/shizuku.png',
  personality: 'gentle',
});

/**
 * Koharu 角色
 */
export const KOHARU_CHARACTER = createCharacter({
  id: 'koharu',
  name: 'Koharu',
  description: '知性优雅的学姐',
  model_path: '/models/koharu',
  avatar: '/avatars/koharu.png',
  personality: 'intellectual',
});

/**
 * 适配器工厂
 */
export const createAdapter = (
  overrides?: Partial<{
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    installed: boolean;
    enabled: boolean;
    status: 'stopped' | 'running' | 'error';
    config: Record<string, any>;
  }>
) => ({
  id: `adapter-${Date.now()}`,
  name: 'Test Adapter',
  description: '测试适配器',
  version: '1.0.0',
  author: 'Test Author',
  installed: false,
  enabled: false,
  status: 'stopped' as const,
  config: {},
  ...overrides,
});

/**
 * OpenAI 适配器
 */
export const OPENAI_ADAPTER = createAdapter({
  id: 'openai-adapter',
  name: 'OpenAI Adapter',
  description: 'OpenAI GPT 模型适配器',
  version: '1.0.0',
  author: 'Zishu Team',
  config: {
    api_key: '',
    model: 'gpt-4',
    temperature: 0.7,
    max_tokens: 2048,
  },
});

/**
 * Claude 适配器
 */
export const CLAUDE_ADAPTER = createAdapter({
  id: 'claude-adapter',
  name: 'Claude Adapter',
  description: 'Anthropic Claude 模型适配器',
  version: '1.2.0',
  author: 'Zishu Team',
  config: {
    api_key: '',
    model: 'claude-3-opus',
    temperature: 0.8,
  },
});

/**
 * 本地 LLM 适配器
 */
export const LOCAL_LLM_ADAPTER = createAdapter({
  id: 'local-llm-adapter',
  name: 'Local LLM Adapter',
  description: '本地大语言模型适配器',
  version: '2.0.0',
  author: 'Community',
  installed: true,
  config: {
    model_path: '/models/llm',
    context_length: 4096,
    gpu_layers: 32,
  },
});

/**
 * 设置工厂
 */
export const createSettings = (
  overrides?: Partial<{
    theme: 'light' | 'dark' | 'auto';
    language: string;
    auto_start: boolean;
    minimize_to_tray: boolean;
    character: {
      scale: number;
      position: { x: number; y: number };
      opacity: number;
    };
    chat: {
      font_size: number;
      send_on_enter: boolean;
      show_timestamp: boolean;
    };
  }>
) => ({
  theme: 'auto' as const,
  language: 'zh-CN',
  auto_start: false,
  minimize_to_tray: true,
  character: {
    scale: 1.0,
    position: { x: 0, y: 0 },
    opacity: 1.0,
  },
  chat: {
    font_size: 14,
    send_on_enter: true,
    show_timestamp: true,
  },
  ...overrides,
});

/**
 * 系统信息工厂
 */
export const createSystemInfo = (
  overrides?: Partial<{
    os: string;
    os_version: string;
    arch: string;
    cpu_count: number;
    total_memory: number;
    app_version: string;
  }>
) => ({
  os: 'Linux',
  os_version: '6.8.0',
  arch: 'x86_64',
  cpu_count: 8,
  total_memory: 16 * 1024 * 1024 * 1024, // 16GB
  app_version: '1.0.0',
  ...overrides,
});

/**
 * 错误工厂
 */
export const createError = (
  message: string,
  overrides?: Partial<{
    code: string;
    details: string;
    timestamp: number;
  }>
) => ({
  error: message,
  code: 'UNKNOWN_ERROR',
  details: '',
  timestamp: Date.now(),
  ...overrides,
});

/**
 * 网络错误
 */
export const NETWORK_ERROR = createError('Network request failed', {
  code: 'NETWORK_ERROR',
  details: 'Unable to connect to server',
});

/**
 * 超时错误
 */
export const TIMEOUT_ERROR = createError('Request timeout', {
  code: 'TIMEOUT_ERROR',
  details: 'Request took too long to complete',
});

/**
 * 权限错误
 */
export const PERMISSION_ERROR = createError('Permission denied', {
  code: 'PERMISSION_ERROR',
  details: 'Insufficient permissions to perform this action',
});

/**
 * 模型加载错误
 */
export const MODEL_LOAD_ERROR = createError('Failed to load model', {
  code: 'MODEL_LOAD_ERROR',
  details: 'Model file not found or corrupted',
});

/**
 * 批量创建消息
 */
export const createMessages = (count: number, type?: 'user' | 'assistant' | 'mixed') => {
  const messages = [];
  
  for (let i = 0; i < count; i++) {
    let role: 'user' | 'assistant';
    
    if (type === 'mixed') {
      role = i % 2 === 0 ? 'user' : 'assistant';
    } else {
      role = type || 'user';
    }
    
    messages.push(
      createMessage({
        role,
        content: `${role === 'user' ? '用户' : 'AI'} 消息 ${i + 1}`,
        timestamp: Date.now() - (count - i) * 1000,
      })
    );
  }
  
  return messages;
};

/**
 * 批量创建适配器
 */
export const createAdapters = (count: number) => {
  const adapters = [];
  
  for (let i = 0; i < count; i++) {
    adapters.push(
      createAdapter({
        id: `adapter-${i}`,
        name: `Test Adapter ${i + 1}`,
        description: `测试适配器 ${i + 1}`,
        version: `${Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 10)}.0`,
      })
    );
  }
  
  return adapters;
};

/**
 * 批量创建角色
 */
export const createCharacters = (count: number) => {
  const characters = [];
  const personalities = ['cheerful', 'gentle', 'intellectual', 'mysterious', 'energetic'];
  
  for (let i = 0; i < count; i++) {
    characters.push(
      createCharacter({
        id: `character-${i}`,
        name: `Character ${i + 1}`,
        description: `测试角色 ${i + 1}`,
        personality: personalities[i % personalities.length],
      })
    );
  }
  
  return characters;
};

/**
 * 创建聊天历史
 */
export const createChatHistory = (messageCount: number, characterId = 'hiyori') => ({
  conversation_id: `conv-${Date.now()}`,
  character_id: characterId,
  messages: createMessages(messageCount, 'mixed'),
  created_at: Date.now() - messageCount * 1000,
  updated_at: Date.now(),
});

/**
 * 创建适配器配置
 */
export const createAdapterConfig = (adapterId: string, config: Record<string, any> = {}) => ({
  adapter_id: adapterId,
  config: {
    enabled: true,
    auto_start: false,
    ...config,
  },
  updated_at: Date.now(),
});

/**
 * 创建角色配置
 */
export const createCharacterConfig = (characterId: string, overrides: any = {}) => ({
  current_character: characterId,
  display: {
    scale: 1.0,
    position: { x: 0, y: 0 },
    opacity: 1.0,
  },
  animation: {
    auto_idle: true,
    idle_interval: 5000,
  },
  ...overrides,
});

/**
 * 创建主题配置
 */
export const createThemeConfig = (theme: 'light' | 'dark' | 'auto' = 'auto') => ({
  theme,
  custom_colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    background: theme === 'dark' ? '#1f2937' : '#ffffff',
    text: theme === 'dark' ? '#f3f4f6' : '#111827',
  },
  updated_at: Date.now(),
});

/**
 * 创建窗口配置
 */
export const createWindowConfig = (overrides: any = {}) => ({
  width: 1280,
  height: 720,
  x: 100,
  y: 100,
  maximized: false,
  fullscreen: false,
  always_on_top: false,
  ...overrides,
});

/**
 * 创建成功响应
 */
export const createSuccessResponse = <T>(data: T) => ({
  success: true,
  data,
  timestamp: Date.now(),
});

/**
 * 创建失败响应
 */
export const createErrorResponse = (error: string, code = 'ERROR') => ({
  success: false,
  error,
  code,
  timestamp: Date.now(),
});

/**
 * 创建分页数据
 */
export const createPaginatedResponse = <T>(
  items: T[],
  page = 1,
  pageSize = 20
) => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  total: items.length,
  page,
  page_size: pageSize,
  total_pages: Math.ceil(items.length / pageSize),
});

/**
 * 延迟响应辅助函数
 */
export const delayResponse = <T>(data: T, delay: number): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
};

/**
 * 随机成功/失败
 */
export const randomResponse = <T>(
  successData: T,
  errorMessage: string,
  successRate = 0.8
) => {
  return Math.random() < successRate
    ? createSuccessResponse(successData)
    : createErrorResponse(errorMessage);
};

/**
 * 模拟进度更新
 */
export const simulateProgress = (
  onProgress: (progress: number) => void,
  duration: number,
  steps = 10
) => {
  const interval = duration / steps;
  let current = 0;
  
  return new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      current += 100 / steps;
      onProgress(Math.min(current, 100));
      
      if (current >= 100) {
        clearInterval(timer);
        resolve();
      }
    }, interval);
  });
};

/**
 * 预设的完整测试数据集
 */
export const TEST_DATA = {
  characters: [HIYORI_CHARACTER, SHIZUKU_CHARACTER, KOHARU_CHARACTER],
  adapters: [OPENAI_ADAPTER, CLAUDE_ADAPTER, LOCAL_LLM_ADAPTER],
  messages: createMessages(50, 'mixed'),
  conversations: [
    createConversation({ id: 'conv-1', title: '日常对话' }),
    createConversation({ id: 'conv-2', title: '学习讨论' }),
    createConversation({ id: 'conv-3', title: '技术问题' }),
  ],
  settings: createSettings(),
  systemInfo: createSystemInfo(),
};

/**
 * 预设的错误数据
 */
export const TEST_ERRORS = {
  network: NETWORK_ERROR,
  timeout: TIMEOUT_ERROR,
  permission: PERMISSION_ERROR,
  modelLoad: MODEL_LOAD_ERROR,
};

