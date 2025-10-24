/**
 * Mock 数据生成器
 * 提供各种测试数据的生成函数
 */

/**
 * 生成随机字符串
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * 生成随机数字
 */
export function randomNumber(min: number = 0, max: number = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成随机布尔值
 */
export function randomBoolean(): boolean {
  return Math.random() > 0.5;
}

/**
 * 从数组中随机选择一个元素
 */
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 生成随机日期
 */
export function randomDate(start?: Date, end?: Date): Date {
  const startDate = start || new Date(2020, 0, 1);
  const endDate = end || new Date();
  return new Date(
    startDate.getTime() +
      Math.random() * (endDate.getTime() - startDate.getTime())
  );
}

/**
 * 生成 UUID（简化版）
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 生成 Mock 用户数据
 */
export interface MockUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user' | 'moderator';
  isActive: boolean;
  createdAt: Date;
}

export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: generateUUID(),
    username: `user_${randomString(6)}`,
    email: `${randomString(8)}@example.com`,
    avatar: `https://i.pravatar.cc/150?u=${randomString(8)}`,
    role: randomChoice(['admin', 'user', 'moderator'] as const),
    isActive: randomBoolean(),
    createdAt: randomDate(),
    ...overrides,
  };
}

/**
 * 生成多个 Mock 用户
 */
export function createMockUsers(count: number): MockUser[] {
  return Array.from({ length: count }, () => createMockUser());
}

/**
 * 生成 Mock 内容数据
 */
export interface MockContent {
  id: string;
  title: string;
  content: string;
  author: MockUser;
  tags: string[];
  views: number;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

export function createMockContent(overrides?: Partial<MockContent>): MockContent {
  const createdAt = randomDate();
  return {
    id: generateUUID(),
    title: `标题 ${randomString(10)}`,
    content: `这是一段测试内容 ${randomString(50)}`,
    author: createMockUser(),
    tags: Array.from({ length: randomNumber(1, 5) }, () => randomString(5)),
    views: randomNumber(0, 10000),
    likes: randomNumber(0, 1000),
    createdAt,
    updatedAt: randomDate(createdAt, new Date()),
    ...overrides,
  };
}

/**
 * 生成多个 Mock 内容
 */
export function createMockContents(count: number): MockContent[] {
  return Array.from({ length: count }, () => createMockContent());
}

/**
 * 生成 Mock 评论数据
 */
export interface MockComment {
  id: string;
  content: string;
  author: MockUser;
  likes: number;
  replies?: MockComment[];
  createdAt: Date;
}

export function createMockComment(
  overrides?: Partial<MockComment>
): MockComment {
  return {
    id: generateUUID(),
    content: `评论内容 ${randomString(20)}`,
    author: createMockUser(),
    likes: randomNumber(0, 100),
    replies: [],
    createdAt: randomDate(),
    ...overrides,
  };
}

/**
 * 生成带回复的 Mock 评论
 */
export function createMockCommentWithReplies(
  replyCount: number = 3
): MockComment {
  return createMockComment({
    replies: Array.from({ length: replyCount }, () => createMockComment()),
  });
}

/**
 * 生成 Mock 通知数据
 */
export interface MockNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export function createMockNotification(
  overrides?: Partial<MockNotification>
): MockNotification {
  return {
    id: generateUUID(),
    type: randomChoice(['info', 'success', 'warning', 'error'] as const),
    title: `通知标题 ${randomString(5)}`,
    message: `通知消息 ${randomString(20)}`,
    isRead: randomBoolean(),
    createdAt: randomDate(),
    ...overrides,
  };
}

/**
 * 生成 Mock 分页数据
 */
export interface MockPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function createMockPaginatedResponse<T>(
  items: T[],
  page: number = 1,
  pageSize: number = 10
): MockPaginatedResponse<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const data = items.slice(startIndex, endIndex);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * 生成 Mock API 响应
 */
export interface MockApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

export function createMockApiSuccess<T>(data: T): MockApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function createMockApiError(
  code: string = 'UNKNOWN_ERROR',
  message: string = '发生错误'
): MockApiResponse<never> {
  return {
    success: false,
    error: { code, message },
    timestamp: new Date().toISOString(),
  };
}

/**
 * 生成 Mock 表单数据
 */
export interface MockFormData {
  [key: string]: string | number | boolean | File | null;
}

export function createMockFormData(
  fields: Record<string, 'string' | 'number' | 'boolean' | 'email' | 'date'>
): MockFormData {
  const formData: MockFormData = {};

  for (const [key, type] of Object.entries(fields)) {
    switch (type) {
      case 'string':
        formData[key] = randomString();
        break;
      case 'number':
        formData[key] = randomNumber();
        break;
      case 'boolean':
        formData[key] = randomBoolean();
        break;
      case 'email':
        formData[key] = `${randomString()}@example.com`;
        break;
      case 'date':
        formData[key] = randomDate().toISOString();
        break;
    }
  }

  return formData;
}

/**
 * 生成 Mock 文件列表
 */
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };

  // 添加数组索引访问
  files.forEach((file, index) => {
    (fileList as any)[index] = file;
  });

  return fileList as FileList;
}

/**
 * 延迟执行（用于模拟异步操作）
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建可控的 Promise
 */
export function createDeferredPromise<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

/**
 * 模拟 API 延迟
 */
export async function mockApiDelay(
  min: number = 100,
  max: number = 500
): Promise<void> {
  const delayTime = randomNumber(min, max);
  await delay(delayTime);
}

/**
 * 创建 Mock 错误
 */
export class MockApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'MockApiError';
  }
}

/**
 * 生成 Mock 统计数据
 */
export interface MockStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export function createMockStats(overrides?: Partial<MockStats>): MockStats {
  return {
    views: randomNumber(0, 10000),
    likes: randomNumber(0, 1000),
    comments: randomNumber(0, 500),
    shares: randomNumber(0, 200),
    ...overrides,
  };
}

