/**
 * 表情API客户端
 * @module features/character/api/expressionApi
 */

import type {
  Expression,
  ExpressionListResponse,
  ExpressionQueryParams,
  CreateExpressionDto,
  UpdateExpressionDto,
} from '../domain/expression';

/**
 * 表情API客户端
 */
export class ExpressionApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * 获取表情列表
   */
  async getExpressions(params: ExpressionQueryParams): Promise<ExpressionListResponse> {
    const queryString = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryString.append(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/expressions?${queryString.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch expressions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 根据角色ID获取表情列表
   */
  async getExpressionsByCharacter(characterId: string): Promise<Expression[]> {
    const response = await fetch(`${this.baseUrl}/characters/${characterId}/expressions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch character expressions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 获取单个表情详情
   */
  async getExpression(id: string): Promise<Expression> {
    const response = await fetch(`${this.baseUrl}/expressions/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch expression: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 创建表情
   */
  async createExpression(data: CreateExpressionDto): Promise<Expression> {
    const response = await fetch(`${this.baseUrl}/expressions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create expression');
    }

    return response.json();
  }

  /**
   * 更新表情
   */
  async updateExpression(id: string, data: UpdateExpressionDto): Promise<Expression> {
    const response = await fetch(`${this.baseUrl}/expressions/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to update expression');
    }

    return response.json();
  }

  /**
   * 删除表情
   */
  async deleteExpression(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/expressions/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete expression: ${response.statusText}`);
    }
  }

  /**
   * 批量删除表情
   */
  async deleteExpressions(ids: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/expressions/batch`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete expressions: ${response.statusText}`);
    }
  }

  /**
   * 切换表情启用状态
   */
  async toggleExpressionStatus(id: string, isActive: boolean): Promise<Expression> {
    return this.updateExpression(id, { isActive });
  }

  /**
   * 设置默认表情
   */
  async setDefaultExpression(characterId: string, expressionId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/characters/${characterId}/expressions/default`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expressionId }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to set default expression: ${response.statusText}`);
    }
  }

  /**
   * 复制表情
   */
  async duplicateExpression(id: string): Promise<Expression> {
    const response = await fetch(`${this.baseUrl}/expressions/${id}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to duplicate expression: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 批量更新表情顺序
   */
  async reorderExpressions(characterId: string, expressionIds: string[]): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/characters/${characterId}/expressions/reorder`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expressionIds }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to reorder expressions: ${response.statusText}`);
    }
  }

  /**
   * 上传表情文件（Live2D表情文件等）
   */
  async uploadExpressionFile(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/expressions/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload expression file: ${response.statusText}`);
    }

    return response.json();
  }
}

// 创建单例实例
export const expressionApi = new ExpressionApiClient();

