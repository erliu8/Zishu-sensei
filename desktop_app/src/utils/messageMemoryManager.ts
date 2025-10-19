/**
 * 消息列表内存管理器
 * 提供大量消息的内存优化、分页加载和虚拟滚动支持
 */

import memoryService from '../services/memoryService';

/**
 * 消息项接口（简化版）
 */
export interface MessageItem {
  id: string;
  content: string;
  timestamp: number;
  userId?: string;
  role?: 'user' | 'assistant' | 'system';
  attachments?: any[];
  [key: string]: any;
}

/**
 * 消息内存配置
 */
export interface MessageMemoryConfig {
  /** 单页消息数量 */
  pageSize: number;
  /** 最大缓存页数 */
  maxCachedPages: number;
  /** 虚拟滚动窗口大小 */
  virtualWindowSize: number;
  /** 是否启用压缩 */
  compressionEnabled: boolean;
  /** 消息过期时间（秒） */
  messageExpireTime: number;
}

/**
 * 消息页
 */
interface MessagePage {
  pageIndex: number;
  messages: MessageItem[];
  loadedAt: number;
  lastAccessed: number;
  memorySize: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: MessageMemoryConfig = {
  pageSize: 50,
  maxCachedPages: 10,
  virtualWindowSize: 20,
  compressionEnabled: false,
  messageExpireTime: 1800, // 30分钟
};

/**
 * 消息内存管理器类
 */
export class MessageMemoryManager {
  private static instance: MessageMemoryManager;
  private config: MessageMemoryConfig;
  private pages: Map<number, MessagePage>;
  private totalMessages: number;
  private currentMemoryUsage: number;
  private cleanupTimer: number | null;

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.pages = new Map();
    this.totalMessages = 0;
    this.currentMemoryUsage = 0;
    this.cleanupTimer = null;
    this.initialize();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): MessageMemoryManager {
    if (!MessageMemoryManager.instance) {
      MessageMemoryManager.instance = new MessageMemoryManager();
    }
    return MessageMemoryManager.instance;
  }

  /**
   * 初始化
   */
  private async initialize() {
    try {
      // 注册内存池
      await memoryService.registerMemoryPool('message_cache', this.config.maxCachedPages);

      // 启动定期清理
      this.startPeriodicCleanup();

      console.log('消息内存管理器初始化完成');
    } catch (error) {
      console.error('消息内存管理器初始化失败:', error);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MessageMemoryConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.enforceMemoryLimits();
  }

  /**
   * 获取当前配置
   */
  getConfig(): MessageMemoryConfig {
    return { ...this.config };
  }

  /**
   * 设置总消息数
   */
  setTotalMessages(count: number) {
    this.totalMessages = count;
  }

  /**
   * 获取总消息数
   */
  getTotalMessages(): number {
    return this.totalMessages;
  }

  /**
   * 获取总页数
   */
  getTotalPages(): number {
    return Math.ceil(this.totalMessages / this.config.pageSize);
  }

  /**
   * 加载消息页
   */
  async loadPage(pageIndex: number, messages: MessageItem[]): Promise<boolean> {
    try {
      // 计算内存大小（粗略估算）
      const memorySize = this.estimateMemorySize(messages);

      // 检查是否需要清理旧页面
      if (this.pages.size >= this.config.maxCachedPages && !this.pages.has(pageIndex)) {
        await this.evictOldestPage();
      }

      // 创建页面
      const page: MessagePage = {
        pageIndex,
        messages,
        loadedAt: Date.now(),
        lastAccessed: Date.now(),
        memorySize,
      };

      this.pages.set(pageIndex, page);
      this.currentMemoryUsage += memorySize;

      // 更新内存池统计
      await memoryService.updateMemoryPoolStats('message_cache', this.pages.size, this.currentMemoryUsage);

      console.log(`加载消息页 ${pageIndex}，当前缓存 ${this.pages.size} 页`);
      return true;
    } catch (error) {
      console.error('加载消息页失败:', error);
      return false;
    }
  }

  /**
   * 获取消息页
   */
  getPage(pageIndex: number): MessageItem[] | null {
    const page = this.pages.get(pageIndex);
    if (page) {
      page.lastAccessed = Date.now();
      return page.messages;
    }
    return null;
  }

  /**
   * 获取消息范围
   */
  getMessageRange(startIndex: number, endIndex: number): MessageItem[] {
    const messages: MessageItem[] = [];
    const startPage = Math.floor(startIndex / this.config.pageSize);
    const endPage = Math.floor(endIndex / this.config.pageSize);

    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      const page = this.getPage(pageIndex);
      if (page) {
        const pageStartIndex = pageIndex * this.config.pageSize;
        const relativeStart = Math.max(0, startIndex - pageStartIndex);
        const relativeEnd = Math.min(this.config.pageSize, endIndex - pageStartIndex);
        messages.push(...page.slice(relativeStart, relativeEnd));
      }
    }

    return messages;
  }

  /**
   * 淘汰最旧的页面
   */
  private async evictOldestPage(): Promise<void> {
    let oldestPage: MessagePage | null = null;
    let oldestTime = Infinity;

    for (const page of this.pages.values()) {
      if (page.lastAccessed < oldestTime) {
        oldestTime = page.lastAccessed;
        oldestPage = page;
      }
    }

    if (oldestPage) {
      await this.unloadPage(oldestPage.pageIndex);
    }
  }

  /**
   * 卸载页面
   */
  async unloadPage(pageIndex: number): Promise<boolean> {
    try {
      const page = this.pages.get(pageIndex);
      if (!page) {
        return false;
      }

      this.pages.delete(pageIndex);
      this.currentMemoryUsage -= page.memorySize;

      // 更新内存池统计
      await memoryService.updateMemoryPoolStats('message_cache', this.pages.size, this.currentMemoryUsage);

      console.log(`卸载消息页 ${pageIndex}`);
      return true;
    } catch (error) {
      console.error('卸载消息页失败:', error);
      return false;
    }
  }

  /**
   * 预加载相邻页面
   */
  async preloadAdjacentPages(currentPageIndex: number, loader: (pageIndex: number) => Promise<MessageItem[]>) {
    const totalPages = this.getTotalPages();
    const pagesToPreload: number[] = [];

    // 预加载前一页
    if (currentPageIndex > 0 && !this.pages.has(currentPageIndex - 1)) {
      pagesToPreload.push(currentPageIndex - 1);
    }

    // 预加载后一页
    if (currentPageIndex < totalPages - 1 && !this.pages.has(currentPageIndex + 1)) {
      pagesToPreload.push(currentPageIndex + 1);
    }

    // 异步加载
    for (const pageIndex of pagesToPreload) {
      try {
        const messages = await loader(pageIndex);
        await this.loadPage(pageIndex, messages);
      } catch (error) {
        console.error(`预加载页面 ${pageIndex} 失败:`, error);
      }
    }
  }

  /**
   * 估算消息内存大小
   */
  private estimateMemorySize(messages: MessageItem[]): number {
    let totalSize = 0;

    for (const message of messages) {
      // 基础大小
      totalSize += 200; // 对象开销

      // 内容大小
      if (message.content) {
        totalSize += message.content.length * 2; // UTF-16 字符占用2字节
      }

      // 附件大小
      if (message.attachments && Array.isArray(message.attachments)) {
        totalSize += message.attachments.length * 1000; // 粗略估算每个附件1KB
      }
    }

    return totalSize;
  }

  /**
   * 启动定期清理
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer !== null) {
      return;
    }

    this.cleanupTimer = window.setInterval(() => {
      this.cleanupExpiredPages();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 停止定期清理
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupTimer !== null) {
      window.clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 清理过期页面
   */
  private async cleanupExpiredPages(): Promise<void> {
    const now = Date.now();
    const expireThreshold = this.config.messageExpireTime * 1000;
    const pagesToRemove: number[] = [];

    for (const [pageIndex, page] of this.pages.entries()) {
      if (now - page.lastAccessed > expireThreshold) {
        pagesToRemove.push(pageIndex);
      }
    }

    for (const pageIndex of pagesToRemove) {
      await this.unloadPage(pageIndex);
    }

    if (pagesToRemove.length > 0) {
      console.log(`清理 ${pagesToRemove.length} 个过期消息页`);
    }
  }

  /**
   * 强制内存限制
   */
  private async enforceMemoryLimits(): Promise<void> {
    while (this.pages.size > this.config.maxCachedPages) {
      await this.evictOldestPage();
    }
  }

  /**
   * 获取内存统计
   */
  getMemoryStats(): {
    cachedPages: number;
    totalMemoryUsage: number;
    averagePageSize: number;
    cacheHitRate?: number;
  } {
    const averagePageSize = this.pages.size > 0 ? this.currentMemoryUsage / this.pages.size : 0;

    return {
      cachedPages: this.pages.size,
      totalMemoryUsage: this.currentMemoryUsage,
      averagePageSize,
    };
  }

  /**
   * 获取虚拟滚动参数
   */
  getVirtualScrollParams(scrollTop: number, containerHeight: number, itemHeight: number) {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const overscan = this.config.virtualWindowSize;

    return {
      startIndex: Math.max(0, startIndex - overscan),
      endIndex: Math.min(this.totalMessages, startIndex + visibleCount + overscan),
      visibleStartIndex: startIndex,
      visibleEndIndex: startIndex + visibleCount,
    };
  }

  /**
   * 清理所有缓存
   */
  async clearCache(): Promise<void> {
    try {
      const pageIndices = Array.from(this.pages.keys());
      for (const pageIndex of pageIndices) {
        await this.unloadPage(pageIndex);
      }

      this.stopPeriodicCleanup();

      console.log('消息缓存已清理');
    } catch (error) {
      console.error('清理消息缓存失败:', error);
    }
  }

  /**
   * 添加单条消息（用于实时消息）
   */
  async addMessage(message: MessageItem): Promise<void> {
    this.totalMessages++;

    // 将消息添加到最后一页
    const lastPageIndex = this.getTotalPages() - 1;
    const lastPage = this.pages.get(lastPageIndex);

    if (lastPage) {
      lastPage.messages.push(message);
      lastPage.memorySize += this.estimateMemorySize([message]);
      this.currentMemoryUsage += this.estimateMemorySize([message]);

      // 如果页面满了，创建新页
      if (lastPage.messages.length >= this.config.pageSize) {
        // 通知需要加载新页
        console.log('当前页面已满，需要加载新页');
      }

      await memoryService.updateMemoryPoolStats('message_cache', this.pages.size, this.currentMemoryUsage);
    }
  }

  /**
   * 删除消息
   */
  async removeMessage(messageId: string): Promise<boolean> {
    for (const page of this.pages.values()) {
      const index = page.messages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        const removed = page.messages.splice(index, 1)[0];
        page.memorySize -= this.estimateMemorySize([removed]);
        this.currentMemoryUsage -= this.estimateMemorySize([removed]);
        this.totalMessages--;

        await memoryService.updateMemoryPoolStats('message_cache', this.pages.size, this.currentMemoryUsage);
        return true;
      }
    }

    return false;
  }
}

// 导出单例实例
export const messageMemoryManager = MessageMemoryManager.getInstance();
export default messageMemoryManager;

