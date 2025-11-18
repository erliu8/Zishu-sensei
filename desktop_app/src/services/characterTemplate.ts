/**
 * 角色模板管理服务
 */

import { invoke } from '@tauri-apps/api/tauri'
import type {
  CharacterTemplate,
  CharacterPrompt,
  LLMConfig,
  CreateCharacterTemplateStep1,
  CreateCharacterTemplateStep2,
} from '@/types/characterTemplate'
import { CommandResponse } from './types'

/**
 * 角色模板存储键
 */
const STORAGE_KEY = 'character_templates'
const PROMPTS_STORAGE_KEY = 'character_prompts'

/**
 * 角色模板管理服务类
 */
export class CharacterTemplateService {
  /**
   * 获取所有角色模板
   */
  static async getTemplates(): Promise<CharacterTemplate[]> {
    // 优先从localStorage获取（因为保存时总是先保存到localStorage）
    const localTemplates = this.getTemplatesFromLocalStorage()
    
    // 尝试从后端获取并合并（可选）
    try {
      const response = await invoke<CommandResponse<CharacterTemplate[]>>(
        'get_character_templates'
      )
      if (response.success && response.data && response.data.length > 0) {
        // 如果后端有数据，可以选择合并或只用后端数据
        // 这里暂时优先使用本地数据
        console.log('后端返回模板数量:', response.data.length)
      }
    } catch (error) {
      console.log('后端获取模板失败，使用本地数据:', error)
    }
    
    return localTemplates
  }

  /**
   * 从本地存储获取模板
   */
  private static getTemplatesFromLocalStorage(): CharacterTemplate[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('从本地存储读取模板失败:', error)
      return []
    }
  }

  /**
   * 保存模板到本地存储
   */
  private static saveTemplatesToLocalStorage(templates: CharacterTemplate[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
    } catch (error) {
      console.error('保存模板到本地存储失败:', error)
    }
  }

  /**
   * 创建新的角色模板
   */
  static async createTemplate(
    step1Data: CreateCharacterTemplateStep1,
    llmConfig: LLMConfig
  ): Promise<CharacterTemplate> {
    try {
      // 处理prompt
      let prompt: CharacterPrompt
      if (typeof step1Data.prompt === 'string') {
        // 使用已有的prompt
        const existingPrompt = await this.getPromptById(step1Data.prompt)
        if (!existingPrompt) {
          throw new Error('选择的Prompt不存在')
        }
        prompt = existingPrompt
      } else {
        // 创建新的prompt
        prompt = await this.createPrompt(step1Data.prompt)
      }

      // 创建模板对象
      const template: CharacterTemplate = {
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: step1Data.name,
        description: step1Data.description,
        live2dModelId: step1Data.live2dModelId,
        prompt,
        llmConfig,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          isAdapterRegistered: false,
        },
      }

      // 注册适配器（失败不影响模板创建）
      try {
        await this.registerAdapter(template)
        console.log('✅ 适配器注册成功:', template.metadata?.adapterId)
      } catch (error) {
        console.error('⚠️ 适配器注册失败，但仍会保存模板:', error)
        // 即使适配器注册失败，也继续保存模板
        template.metadata = {
          ...template.metadata,
          isAdapterRegistered: false,
          adapterError: error instanceof Error ? error.message : '注册失败',
        }
      }

      // 保存模板
      const templates = await this.getTemplates()
      templates.push(template)
      console.log('保存模板前，当前模板数量:', templates.length)
      
      this.saveTemplatesToLocalStorage(templates)
      console.log('✅ 模板已保存到localStorage:', template.name, 'ID:', template.id)
      
      // 验证保存
      const saved = this.getTemplatesFromLocalStorage()
      console.log('验证：localStorage中的模板数量:', saved.length)

      // 尝试同步到后端
      try {
        await invoke('save_character_template', { template })
        console.log('✅ 模板已同步到后端')
      } catch (error) {
        console.warn('⚠️ 同步模板到后端失败:', error)
      }

      return template
    } catch (error) {
      console.error('创建角色模板失败:', error)
      throw error
    }
  }

  /**
   * 更新角色模板
   */
  static async updateTemplate(
    templateId: string,
    updates: Partial<CharacterTemplate>
  ): Promise<CharacterTemplate> {
    try {
      const templates = await this.getTemplates()
      const index = templates.findIndex(t => t.id === templateId)
      
      if (index === -1) {
        throw new Error('模板不存在')
      }

      const updatedTemplate = {
        ...templates[index],
        ...updates,
        updatedAt: Date.now(),
      }

      templates[index] = updatedTemplate
      this.saveTemplatesToLocalStorage(templates)

      // 如果LLM配置改变，需要重新注册适配器
      if (updates.llmConfig) {
        await this.registerAdapter(updatedTemplate)
      }

      // 尝试同步到后端
      try {
        await invoke('update_character_template', { templateId, updates })
      } catch (error) {
        console.warn('同步更新到后端失败:', error)
      }

      return updatedTemplate
    } catch (error) {
      console.error('更新角色模板失败:', error)
      throw error
    }
  }

  /**
   * 删除角色模板
   */
  static async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const templates = await this.getTemplates()
      const template = templates.find(t => t.id === templateId)
      
      if (!template) {
        throw new Error('模板不存在')
      }

      // 如果有注册的适配器，尝试卸载
      if (template.metadata?.adapterId) {
        try {
          await invoke('unload_adapter', { adapterId: template.metadata.adapterId })
        } catch (error) {
          console.warn('卸载适配器失败:', error)
        }
      }

      const filteredTemplates = templates.filter(t => t.id !== templateId)
      this.saveTemplatesToLocalStorage(filteredTemplates)

      // 尝试同步到后端
      try {
        await invoke('delete_character_template', { templateId })
      } catch (error) {
        console.warn('同步删除到后端失败:', error)
      }

      return true
    } catch (error) {
      console.error('删除角色模板失败:', error)
      throw error
    }
  }

  /**
   * 注册适配器（直接调用HTTP API）
   */
  private static async registerAdapter(template: CharacterTemplate): Promise<void> {
    try {
      const backendUrl = 'http://localhost:8000'
      
      // 根据LLM配置类型决定注册方式
      if (template.llmConfig.type === 'api') {
        // API配置 → 使用第三方API注册端点
        const apiConfig = template.llmConfig as any
        
        const response = await fetch(`${backendUrl}/api/adapters/third-party/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: apiConfig.provider,
            api_key: apiConfig.apiKey || '',
            model: apiConfig.modelName,
            api_base: apiConfig.apiEndpoint || undefined,
            temperature: 0.7,
            max_tokens: 2000,
            timeout: 30,
          }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: '未知错误' }))
          throw new Error(error.detail || '注册API适配器失败')
        }

        const data = await response.json()
        
        // 更新模板的适配器信息
        template.metadata = {
          ...template.metadata,
          adapterId: data.data.adapter_id,
          adapterType: 'soft',
          isAdapterRegistered: true,
        }
      } else {
        // 本地LLM配置 → 注册为智能硬适配器
        const localConfig = template.llmConfig as any
        
        const response = await fetch(`${backendUrl}/api/models/register-llm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: template.name,
            model_path: localConfig.modelPath,
            description: template.description || `角色模板: ${template.name}`,
            model_type: 'auto',
            system_prompt: template.prompt.systemPrompt,
            prompt_template: template.prompt.userPromptTemplate || null,
            tags: ['character_template', 'local_llm'],
            metadata: {
              template_id: template.id,
              live2d_model_id: template.live2dModelId,
            },
          }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: '未知错误' }))
          throw new Error(error.detail || error.message || '注册本地LLM适配器失败')
        }

        const data = await response.json()
        
        // 更新模板的适配器信息
        template.metadata = {
          ...template.metadata,
          adapterId: data.adapter_id,
          adapterType: 'hard',
          isAdapterRegistered: true,
        }
      }
    } catch (error) {
      console.error('注册适配器失败:', error)
      throw new Error(`注册适配器失败: ${error instanceof Error ? error.message : '请确保后端服务运行正常'}`)
    }
  }

  /**
   * 切换到指定的角色模板
   */
  static async switchToTemplate(templateId: string): Promise<boolean> {
    try {
      const template = await this.getTemplateById(templateId)
      if (!template) {
        throw new Error('模板不存在')
      }

      // 加载适配器
      if (template.metadata?.adapterId) {
        await invoke('load_adapter', { adapterId: template.metadata.adapterId })
      }

      // 切换Live2D模型
      // 这里应该调用角色管理服务来切换模型
      // await CharacterService.switchCharacter(template.live2dModelId)

      return true
    } catch (error) {
      console.error('切换角色模板失败:', error)
      throw error
    }
  }

  /**
   * 根据ID获取模板
   */
  static async getTemplateById(templateId: string): Promise<CharacterTemplate | null> {
    const templates = await this.getTemplates()
    return templates.find(t => t.id === templateId) || null
  }

  // ==================== Prompt管理 ====================

  /**
   * 获取所有Prompt列表（从数据库）
   */
  static async getPrompts(): Promise<CharacterPrompt[]> {
    try {
      const response = await invoke<CommandResponse<any[]>>('get_prompts')
      
      if (response.success && response.data) {
        // 转换数据库格式到前端格式
        return response.data.map(p => ({
          id: p.id,
          name: p.name,
          systemPrompt: p.content,
          description: p.description,
          createdAt: p.created_at * 1000, // 转换为毫秒
          updatedAt: p.updated_at * 1000,
        }))
      }
      
      return []
    } catch (error) {
      console.error('获取Prompt列表失败:', error)
      return []
    }
  }

  /**
   * 根据ID获取Prompt
   */
  static async getPromptById(promptId: string): Promise<CharacterPrompt | null> {
    const prompts = await this.getPrompts()
    return prompts.find(p => p.id === promptId) || null
  }

  /**
   * 创建新的Prompt
   */
  static async createPrompt(prompt: Omit<CharacterPrompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<CharacterPrompt> {
    try {
      const newPrompt: CharacterPrompt = {
        ...prompt,
        id: `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const stored = localStorage.getItem(PROMPTS_STORAGE_KEY)
      const prompts = stored ? JSON.parse(stored) : []
      prompts.push(newPrompt)
      localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts))

      return newPrompt
    } catch (error) {
      console.error('创建Prompt失败:', error)
      throw error
    }
  }

  /**
   * 更新Prompt
   */
  static async updatePrompt(
    promptId: string,
    updates: Partial<CharacterPrompt>
  ): Promise<CharacterPrompt> {
    try {
      const stored = localStorage.getItem(PROMPTS_STORAGE_KEY)
      const prompts = stored ? JSON.parse(stored) : []
      const index = prompts.findIndex((p: CharacterPrompt) => p.id === promptId)

      if (index === -1) {
        throw new Error('Prompt不存在')
      }

      const updatedPrompt = {
        ...prompts[index],
        ...updates,
        updatedAt: Date.now(),
      }

      prompts[index] = updatedPrompt
      localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts))

      return updatedPrompt
    } catch (error) {
      console.error('更新Prompt失败:', error)
      throw error
    }
  }

  /**
   * 删除Prompt
   */
  static async deletePrompt(promptId: string): Promise<boolean> {
    try {
      // 检查是否有模板使用这个Prompt
      const templates = await this.getTemplates()
      const isUsed = templates.some(t => t.prompt.id === promptId)
      
      if (isUsed) {
        throw new Error('该Prompt正在被模板使用，无法删除')
      }

      const stored = localStorage.getItem(PROMPTS_STORAGE_KEY)
      const prompts = stored ? JSON.parse(stored) : []
      const filteredPrompts = prompts.filter((p: CharacterPrompt) => p.id !== promptId)
      localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(filteredPrompts))

      return true
    } catch (error) {
      console.error('删除Prompt失败:', error)
      throw error
    }
  }
}

export default CharacterTemplateService
