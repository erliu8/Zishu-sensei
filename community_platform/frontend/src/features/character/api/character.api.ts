/**
 * 角色 API 客户端
 */

import type { PaginatedResponse } from '@/infrastructure/api/types';
import type {
  Character,
  CreateCharacterInput,
  UpdateCharacterInput,
  PublishCharacterInput,
  CharacterFilters,
} from '../domain';
import { TokenService } from '@/features/auth/services/token.service';

/**
 * API 错误类
 */
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 解析 API 错误响应
 */
async function parseApiError(response: Response): Promise<ApiError> {
  let errorMessage = `请求失败 (${response.status})`;
  let errorDetails: any = null;

  try {
    const errorData = await response.json();
    
    // 尝试提取错误消息
    if (errorData.message) {
      errorMessage = errorData.message;
    } else if (errorData.detail) {
      errorMessage = errorData.detail;
    } else if (errorData.error) {
      errorMessage = typeof errorData.error === 'string' 
        ? errorData.error 
        : errorData.error.message || errorMessage;
    }
    
    errorDetails = errorData;
  } catch (e) {
    // 如果无法解析 JSON，使用状态文本
    errorMessage = response.statusText || errorMessage;
  }

  // 根据状态码提供更友好的错误消息
  switch (response.status) {
    case 400:
      errorMessage = errorMessage || '请求参数错误，请检查输入';
      break;
    case 401:
      errorMessage = '未登录或登录已过期，请重新登录';
      break;
    case 403:
      errorMessage = '没有权限执行此操作';
      break;
    case 404:
      errorMessage = '请求的资源不存在';
      break;
    case 409:
      errorMessage = errorMessage || '资源冲突，可能是名称已被使用';
      break;
    case 422:
      errorMessage = errorMessage || '数据验证失败，请检查输入';
      break;
    case 429:
      errorMessage = '请求过于频繁，请稍后再试';
      break;
    case 500:
      errorMessage = '服务器内部错误，请稍后重试';
      break;
    case 502:
    case 503:
    case 504:
      errorMessage = '服务暂时不可用，请稍后重试';
      break;
  }

  return new ApiError(errorMessage, response.status, errorDetails);
}

/**
 * 处理网络错误
 */
function handleNetworkError(error: any): never {
  if (error.name === 'AbortError') {
    throw new ApiError('请求超时，请检查网络连接后重试');
  }
  
  if (error.message && error.message.includes('Failed to fetch')) {
    throw new ApiError('网络连接失败，请检查您的网络连接');
  }
  
  throw error;
}

/**
 * 角色API客户端类
 */
export class CharacterApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = '/api/characters', timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * 发送带超时的 fetch 请求
   */
  private async fetchWithTimeout(
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // 获取认证 token 并添加到请求头
    const token = TokenService.getAccessToken();
    const headers = new Headers(options?.headers || {});
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      return handleNetworkError(error);
    }
  }

  /**
   * 获取角色列表（带分页和筛选）
   */
  async getCharacters(
    filters?: CharacterFilters
  ): Promise<PaginatedResponse<Character>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.tags) params.append('tags', filters.tags.join(','));
    if (filters?.status) params.append('status', filters.status);
    if (filters?.visibility) params.append('visibility', filters.visibility);
    if (filters?.creatorId) params.append('creatorId', filters.creatorId);
    if (filters?.adapterTypes)
      params.append('adapterTypes', filters.adapterTypes.join(','));
    if (filters?.publishedOnly !== undefined)
      params.append('published', String(filters.publishedOnly));
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));

    const response = await this.fetchWithTimeout(`${this.baseUrl}?${params.toString()}`);

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    // 处理两种可能的响应格式：直接返回数据或包装在data字段中
    return result.data || result;
  }

  /**
   * 获取单个角色详情
   */
  async getCharacter(id: number): Promise<Character> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    // 处理两种可能的响应格式：直接返回数据或包装在data字段中
    return result.data || result;
  }

  /**
   * 创建角色
   */
  async createCharacter(input: CreateCharacterInput): Promise<Character> {
    const response = await this.fetchWithTimeout(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    // 处理两种可能的响应格式：直接返回数据或包装在data字段中
    return result.data || result;
  }

  /**
   * 更新角色
   */
  async updateCharacter(
    id: number,
    input: UpdateCharacterInput
  ): Promise<Character> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    return result.data || result;
  }

  /**
   * 删除角色
   */
  async deleteCharacter(id: number): Promise<void> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }
  }

  /**
   * 发布角色
   */
  async publishCharacter(
    id: number,
    input?: PublishCharacterInput
  ): Promise<Character> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/${id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input || {}),
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    return result.data || result;
  }

  /**
   * 取消发布角色
   */
  async unpublishCharacter(id: number): Promise<Character> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/${id}/unpublish`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    return result.data || result;
  }

  /**
   * 归档角色
   */
  async archiveCharacter(id: number): Promise<Character> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/${id}/archive`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    return result.data || result;
  }

  /**
   * 克隆角色
   */
  async cloneCharacter(id: number): Promise<Character> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/${id}/clone`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    return result.data || result;
  }

  /**
   * 获取我的角色列表
   */
  async getMyCharacters(filters?: CharacterFilters): Promise<PaginatedResponse<Character>> {
    return this.getCharacters({ ...filters, creatorId: 'me' });
  }

  /**
   * 获取推荐角色
   */
  async getFeaturedCharacters(limit: number = 10): Promise<Character[]> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/featured?limit=${limit}`);

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    return result.data || result;
  }

  /**
   * 获取热门角色
   */
  async getTrendingCharacters(limit: number = 10): Promise<Character[]> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/trending?limit=${limit}`);

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const result = await response.json();
    return result.data || result;
  }
}

// 导出单例
export const characterApi = new CharacterApiClient();

