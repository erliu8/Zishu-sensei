/**
 * E2E 测试数据固件
 */

/**
 * 测试用户数据
 */
export const testUsers = {
  admin: {
    email: 'admin@example.com',
    password: 'Admin123456!',
    username: 'admin',
    displayName: 'Administrator',
  },
  regularUser: {
    email: 'user@example.com',
    password: 'User123456!',
    username: 'testuser',
    displayName: 'Test User',
  },
  newUser: {
    email: 'newuser@example.com',
    password: 'NewUser123456!',
    username: 'newuser',
    displayName: 'New Test User',
  },
};

/**
 * 测试内容数据
 */
export const testContents = {
  article: {
    title: '测试文章标题',
    description: '这是一篇测试文章的描述',
    content: '这是测试文章的正文内容，包含了详细的信息和说明。',
    category: 'article',
    tags: ['测试', '示例', 'E2E'],
  },
  tutorial: {
    title: '日语学习教程',
    description: '这是一个日语学习的教程',
    content: '# 日语基础\n\n这是日语学习的基础内容。\n\n## 五十音图\n\n详细的五十音图说明...',
    category: 'tutorial',
    tags: ['日语', '教程', '学习'],
  },
  quiz: {
    title: '日语测验题',
    description: '测试你的日语水平',
    content: '这是一个日语水平测验，包含多个问题。',
    category: 'quiz',
    tags: ['测验', '日语', '练习'],
  },
};

/**
 * 测试评论数据
 */
export const testComments = [
  '这个内容很有帮助！',
  '感谢分享，学到了很多',
  '非常棒的教程，期待更多',
  '有一些地方需要改进',
  '完美！正是我需要的',
];

/**
 * 测试搜索关键词
 */
export const testSearchQueries = [
  '日语',
  '学习',
  '教程',
  '测验',
  '语法',
];

/**
 * 无效的登录凭证
 */
export const invalidCredentials = [
  {
    email: 'invalid@example.com',
    password: 'wrongpassword',
    expectedError: '邮箱或密码错误',
  },
  {
    email: 'notexist@example.com',
    password: 'password123',
    expectedError: '用户不存在',
  },
  {
    email: 'user@example.com',
    password: 'wrongpass',
    expectedError: '密码错误',
  },
];

/**
 * 无效的注册数据
 */
export const invalidRegistrations = [
  {
    username: 'ab', // 太短
    email: 'test@example.com',
    password: 'Test123456!',
    expectedError: '用户名至少需要3个字符',
  },
  {
    username: 'testuser',
    email: 'invalid-email', // 无效邮箱
    password: 'Test123456!',
    expectedError: '请输入有效的邮箱地址',
  },
  {
    username: 'testuser',
    email: 'test@example.com',
    password: '123', // 密码太弱
    expectedError: '密码至少需要8个字符',
  },
];

/**
 * 测试 API 响应数据
 */
export const mockApiResponses = {
  successLogin: {
    user: {
      id: '123',
      email: 'user@example.com',
      username: 'testuser',
      displayName: 'Test User',
    },
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 3600000,
  },
  errorLogin: {
    error: 'Invalid credentials',
    message: '邮箱或密码错误',
  },
  successRegister: {
    message: '注册成功',
    user: {
      id: '124',
      email: 'newuser@example.com',
      username: 'newuser',
    },
  },
  errorRegisterEmailExists: {
    error: 'Email already exists',
    message: '邮箱已被注册',
  },
};

/**
 * 测试环境配置
 */
export const testConfig = {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  timeout: {
    short: 5000,
    medium: 10000,
    long: 30000,
  },
  retry: {
    max: 3,
    delay: 1000,
  },
};

