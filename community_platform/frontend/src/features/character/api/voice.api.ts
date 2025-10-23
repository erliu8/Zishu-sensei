/**
 * 语音 API 客户端
 */

import type {
  Voice,
  CreateVoiceInput,
  UpdateVoiceInput,
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
 * 可用语音选项
 */
export interface AvailableVoice {
  voiceId: string;
  name: string;
  gender: string;
  languageCode: string;
  engine: string;
  sampleUrl?: string;
}

/**
 * 语音API客户端类
 */
export class VoiceApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/voices') {
    this.baseUrl = baseUrl;
  }

  /**
   * 获取角色的所有语音配置
   */
  async getVoices(characterId: string): Promise<Voice[]> {
    const response = await fetch(
      `${this.baseUrl}/character/${characterId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.statusText}`);
    }

    const result: ApiResponse<Voice[]> = await response.json();
    return result.data;
  }

  /**
   * 获取单个语音配置
   */
  async getVoice(id: string): Promise<Voice> {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch voice: ${response.statusText}`);
    }

    const result: ApiResponse<Voice> = await response.json();
    return result.data;
  }

  /**
   * 创建语音配置
   */
  async createVoice(input: CreateVoiceInput): Promise<Voice> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to create voice: ${response.statusText}`);
    }

    const result: ApiResponse<Voice> = await response.json();
    return result.data;
  }

  /**
   * 更新语音配置
   */
  async updateVoice(id: string, input: UpdateVoiceInput): Promise<Voice> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to update voice: ${response.statusText}`);
    }

    const result: ApiResponse<Voice> = await response.json();
    return result.data;
  }

  /**
   * 删除语音配置
   */
  async deleteVoice(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete voice: ${response.statusText}`);
    }
  }

  /**
   * 设置默认语音
   */
  async setDefaultVoice(id: string): Promise<Voice> {
    const response = await fetch(`${this.baseUrl}/${id}/set-default`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to set default voice: ${response.statusText}`);
    }

    const result: ApiResponse<Voice> = await response.json();
    return result.data;
  }

  /**
   * 获取可用的TTS语音列表
   */
  async getAvailableVoices(
    engine: string,
    languageCode?: string
  ): Promise<AvailableVoice[]> {
    const params = new URLSearchParams({ engine });
    if (languageCode) params.append('languageCode', languageCode);

    const response = await fetch(
      `${this.baseUrl}/available?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch available voices: ${response.statusText}`
      );
    }

    const result: ApiResponse<AvailableVoice[]> = await response.json();
    return result.data;
  }

  /**
   * 生成语音样本
   */
  async generateSample(
    voiceId: string,
    text: string,
    engine: string
  ): Promise<{ audioUrl: string }> {
    const response = await fetch(`${this.baseUrl}/sample`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voiceId, text, engine }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate sample: ${response.statusText}`);
    }

    const result: ApiResponse<{ audioUrl: string }> = await response.json();
    return result.data;
  }

  /**
   * 测试语音配置
   */
  async testVoice(
    id: string,
    testText?: string
  ): Promise<{ audioUrl: string }> {
    const response = await fetch(`${this.baseUrl}/${id}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: testText || '这是一段测试语音。' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to test voice: ${response.statusText}`);
    }

    const result: ApiResponse<{ audioUrl: string }> = await response.json();
    return result.data;
  }

  /**
   * 上传语音样本
   */
  async uploadSample(id: string, file: File): Promise<{ sampleUrl: string }> {
    const formData = new FormData();
    formData.append('sample', file);

    const response = await fetch(`${this.baseUrl}/${id}/sample`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload sample: ${response.statusText}`);
    }

    const result: ApiResponse<{ sampleUrl: string }> = await response.json();
    return result.data;
  }
}

// 导出单例
export const voiceApi = new VoiceApiClient();

