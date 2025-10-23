/**
 * 人格 API 客户端
 */

import type {
  Personality,
  CreatePersonalityInput,
  UpdatePersonalityInput,
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
 * 人格API客户端类
 */
export class PersonalityApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/personalities') {
    this.baseUrl = baseUrl;
  }

  /**
   * 获取角色的人格配置
   */
  async getPersonality(characterId: string): Promise<Personality> {
    const response = await fetch(
      `${this.baseUrl}/character/${characterId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch personality: ${response.statusText}`);
    }

    const result: ApiResponse<Personality> = await response.json();
    return result.data;
  }

  /**
   * 创建人格配置
   */
  async createPersonality(
    input: CreatePersonalityInput
  ): Promise<Personality> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to create personality: ${response.statusText}`);
    }

    const result: ApiResponse<Personality> = await response.json();
    return result.data;
  }

  /**
   * 更新人格配置
   */
  async updatePersonality(
    id: string,
    input: UpdatePersonalityInput
  ): Promise<Personality> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to update personality: ${response.statusText}`);
    }

    const result: ApiResponse<Personality> = await response.json();
    return result.data;
  }

  /**
   * 删除人格配置
   */
  async deletePersonality(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete personality: ${response.statusText}`);
    }
  }

  /**
   * 获取MBTI类型的推荐配置
   */
  async getMBTIRecommendation(mbtiType: string): Promise<Partial<Personality>> {
    const response = await fetch(
      `${this.baseUrl}/recommendations/mbti/${mbtiType}`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch MBTI recommendation: ${response.statusText}`
      );
    }

    const result: ApiResponse<Partial<Personality>> = await response.json();
    return result.data;
  }

  /**
   * 分析人格相似度
   */
  async analyzeSimilarity(
    personalityId: string,
    targetPersonalityId: string
  ): Promise<{ similarity: number; details: Record<string, any> }> {
    const response = await fetch(
      `${this.baseUrl}/${personalityId}/similarity/${targetPersonalityId}`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to analyze similarity: ${response.statusText}`
      );
    }

    const result: ApiResponse<{
      similarity: number;
      details: Record<string, any>;
    }> = await response.json();
    return result.data;
  }
}

// 导出单例
export const personalityApi = new PersonalityApiClient();

