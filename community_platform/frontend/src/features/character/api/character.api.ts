/**
 * 角色 API 客户端
 */

import type {
  Character,
  CreateCharacterInput,
  UpdateCharacterInput,
  PublishCharacterInput,
  CharacterFilters,
} from '../domain';

/**
 * API 响应基础类型
 */
interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

/**
 * 分页响应类型
 */
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 角色API客户端类
 */
export class CharacterApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/characters') {
    this.baseUrl = baseUrl;
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
      params.append('publishedOnly', String(filters.publishedOnly));
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch characters: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 获取单个角色详情
   */
  async getCharacter(id: string): Promise<Character> {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch character: ${response.statusText}`);
    }

    const result: ApiResponse<Character> = await response.json();
    return result.data;
  }

  /**
   * 创建角色
   */
  async createCharacter(input: CreateCharacterInput): Promise<Character> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to create character: ${response.statusText}`);
    }

    const result: ApiResponse<Character> = await response.json();
    return result.data;
  }

  /**
   * 更新角色
   */
  async updateCharacter(
    id: string,
    input: UpdateCharacterInput
  ): Promise<Character> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to update character: ${response.statusText}`);
    }

    const result: ApiResponse<Character> = await response.json();
    return result.data;
  }

  /**
   * 删除角色
   */
  async deleteCharacter(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete character: ${response.statusText}`);
    }
  }

  /**
   * 发布角色
   */
  async publishCharacter(
    id: string,
    input?: PublishCharacterInput
  ): Promise<Character> {
    const response = await fetch(`${this.baseUrl}/${id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input || {}),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish character: ${response.statusText}`);
    }

    const result: ApiResponse<Character> = await response.json();
    return result.data;
  }

  /**
   * 取消发布角色
   */
  async unpublishCharacter(id: string): Promise<Character> {
    const response = await fetch(`${this.baseUrl}/${id}/unpublish`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to unpublish character: ${response.statusText}`);
    }

    const result: ApiResponse<Character> = await response.json();
    return result.data;
  }

  /**
   * 归档角色
   */
  async archiveCharacter(id: string): Promise<Character> {
    const response = await fetch(`${this.baseUrl}/${id}/archive`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to archive character: ${response.statusText}`);
    }

    const result: ApiResponse<Character> = await response.json();
    return result.data;
  }

  /**
   * 克隆角色
   */
  async cloneCharacter(id: string): Promise<Character> {
    const response = await fetch(`${this.baseUrl}/${id}/clone`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to clone character: ${response.statusText}`);
    }

    const result: ApiResponse<Character> = await response.json();
    return result.data;
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
    const response = await fetch(`${this.baseUrl}/featured?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch featured characters: ${response.statusText}`);
    }

    const result: ApiResponse<Character[]> = await response.json();
    return result.data;
  }

  /**
   * 获取热门角色
   */
  async getTrendingCharacters(limit: number = 10): Promise<Character[]> {
    const response = await fetch(`${this.baseUrl}/trending?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch trending characters: ${response.statusText}`);
    }

    const result: ApiResponse<Character[]> = await response.json();
    return result.data;
  }
}

// 导出单例
export const characterApi = new CharacterApiClient();

