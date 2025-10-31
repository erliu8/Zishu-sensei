/**
 * 表情 API 客户端
 */

import type {
  Expression,
  CreateExpressionDto,
  UpdateExpressionDto,
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
 * 表情API客户端类
 */
export class ExpressionApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/expressions') {
    this.baseUrl = baseUrl;
  }

  /**
   * 获取角色的所有表情
   */
  async getExpressions(characterId: string): Promise<Expression[]> {
    const response = await fetch(
      `${this.baseUrl}/character/${characterId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch expressions: ${response.statusText}`);
    }

    const result: ApiResponse<Expression[]> = await response.json();
    return result.data;
  }

  /**
   * 获取单个表情
   */
  async getExpression(id: string): Promise<Expression> {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch expression: ${response.statusText}`);
    }

    const result: ApiResponse<Expression> = await response.json();
    return result.data;
  }

  /**
   * 创建表情
   */
  async createExpression(
    input: CreateExpressionDto
  ): Promise<Expression> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to create expression: ${response.statusText}`);
    }

    const result: ApiResponse<Expression> = await response.json();
    return result.data;
  }

  /**
   * 更新表情
   */
  async updateExpression(
    id: string,
    input: UpdateExpressionDto
  ): Promise<Expression> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to update expression: ${response.statusText}`);
    }

    const result: ApiResponse<Expression> = await response.json();
    return result.data;
  }

  /**
   * 删除表情
   */
  async deleteExpression(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete expression: ${response.statusText}`);
    }
  }

  /**
   * 批量创建表情
   */
  async batchCreateExpressions(
    inputs: CreateExpressionDto[]
  ): Promise<Expression[]> {
    const response = await fetch(`${this.baseUrl}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expressions: inputs }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to batch create expressions: ${response.statusText}`
      );
    }

    const result: ApiResponse<Expression[]> = await response.json();
    return result.data;
  }

  /**
   * 批量更新表情优先级
   */
  async updatePriorities(
    updates: Array<{ id: string; priority: number }>
  ): Promise<Expression[]> {
    const response = await fetch(`${this.baseUrl}/priorities`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ updates }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to update priorities: ${response.statusText}`
      );
    }

    const result: ApiResponse<Expression[]> = await response.json();
    return result.data;
  }

  /**
   * 切换表情启用状态
   */
  async toggleExpression(id: string): Promise<Expression> {
    const response = await fetch(`${this.baseUrl}/${id}/toggle`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(
        `Failed to toggle expression: ${response.statusText}`
      );
    }

    const result: ApiResponse<Expression> = await response.json();
    return result.data;
  }

  /**
   * 上传表情图片
   */
  async uploadExpressionImage(
    id: string,
    file: File
  ): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${this.baseUrl}/${id}/image`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to upload expression image: ${response.statusText}`
      );
    }

    const result: ApiResponse<{ imageUrl: string }> = await response.json();
    return result.data;
  }
}

// 导出单例
export const expressionApi = new ExpressionApiClient();

