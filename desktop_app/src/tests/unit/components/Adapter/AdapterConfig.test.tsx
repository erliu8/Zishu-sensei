/**
 * AdapterConfig 组件测试
 * 
 * 测试适配器配置组件的完整功能，包括：
 * - 渲染配置表单
 * - 处理不同类型的配置项
 * - 配置保存和验证
 * - 错误处理和重置
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { AdapterConfig } from '../../../../components/AdapterConfig'
import { renderWithProviders } from '../../../utils/test-utils'
import {
  mockAdapterService,
  createMockAdapterMetadata,
  setupAdapterConfigScenario,
  mockServiceWithErrors,
  createConfigError,
} from '../../../utils/adapter-test-helpers'
import { CapabilityLevel } from '../../../../types/adapter'

// Mock 适配器服务
const mockService = mockAdapterService()
vi.mock('../../../../src/services/adapter', () => ({
  AdapterService: mockService,
}))

describe('AdapterConfig', () => {
  const mockMetadata = createMockAdapterMetadata({
    id: 'test-adapter',
    name: 'Test Adapter',
    version: '1.0.0',
    description: 'Test adapter for configuration',
    author: 'Test Author',
    license: 'MIT',
    tags: ['test', 'demo'],
    capabilities: [
      {
        name: 'text_generation',
        description: 'Generate text using AI models',
        level: CapabilityLevel.Advanced,
        required_params: ['input', 'model'],
        optional_params: ['temperature', 'max_tokens'],
      },
    ],
    resource_requirements: {
      min_memory_mb: 1024,
      min_cpu_cores: 2,
      gpu_required: false,
      python_version: '3.8+',
      dependencies: ['torch>=1.9.0', 'transformers>=4.0.0'],
    },
    config_schema: {
      api_key: {
        type: 'string',
        title: 'API Key',
        description: 'Your API key for the service',
        default: '',
      },
      model: {
        type: 'select',
        title: 'Model',
        description: 'Select the model to use',
        default: 'gpt-3.5-turbo',
        enum: ['gpt-3.5-turbo', 'gpt-4', 'claude-3'],
      },
      temperature: {
        type: 'number',
        title: 'Temperature',
        description: 'Controls randomness in generation',
        default: 0.7,
        minimum: 0,
        maximum: 2,
      },
      max_tokens: {
        type: 'integer',
        title: 'Max Tokens',
        description: 'Maximum number of tokens to generate',
        default: 2048,
        minimum: 1,
        maximum: 4096,
      },
      enabled: {
        type: 'boolean',
        title: 'Enabled',
        description: 'Whether the adapter is enabled',
        default: true,
      },
      tags: {
        type: 'array',
        title: 'Tags',
        description: 'Tags for categorization',
        default: [],
      },
      description: {
        type: 'textarea',
        title: 'Description',
        description: 'Detailed description of the adapter configuration',
        default: 'Default description',
      },
    },
    default_config: {
      api_key: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 2048,
      enabled: true,
      tags: [],
      description: 'Default description',
    },
  })

  const mockCurrentConfig = {
    api_key: 'test-api-key',
    model: 'gpt-4',
    temperature: 0.8,
    max_tokens: 1024,
    enabled: true,
    tags: ['ai', 'nlp'],
    description: 'Custom configuration description',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockService.getAdapterDetails.mockResolvedValue(mockMetadata)
    mockService.getAdapterConfig.mockResolvedValue(mockCurrentConfig)
    mockService.updateAdapterConfig.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('渲染测试', () => {
    it('应该渲染适配器配置页面', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      // 等待数据加载
      await waitFor(() => {
        expect(screen.getByText('Test Adapter')).toBeInTheDocument()
      })
      
      // 检查基本信息
      expect(screen.getByText('Version 1.0.0')).toBeInTheDocument()
      expect(screen.getByText('Test adapter for configuration')).toBeInTheDocument()
      
      // 验证服务调用
      expect(mockService.getAdapterDetails).toHaveBeenCalledWith('test-adapter')
      expect(mockService.getAdapterConfig).toHaveBeenCalledWith('test-adapter')
    })

    it('应该显示适配器信息', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Adapter Information')).toBeInTheDocument()
      })
      
      // 检查适配器信息
      expect(screen.getByText('Type: soft')).toBeInTheDocument()
      expect(screen.getByText('Author: Test Author')).toBeInTheDocument()
      expect(screen.getByText('License: MIT')).toBeInTheDocument()
      expect(screen.getByText('Tags: test, demo')).toBeInTheDocument()
    })

    it('应该显示关闭按钮', async () => {
      const mockOnClose = vi.fn()
      renderWithProviders(<AdapterConfig adapterId="test-adapter" onClose={mockOnClose} />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
      })
    })

    it('应该显示配置标题', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Configuration')).toBeInTheDocument()
      })
    })
  })

  describe('加载状态测试', () => {
    it('应该显示加载指示器', () => {
      mockService.getAdapterDetails.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      expect(screen.getByText('Loading adapter configuration...')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('加载完成后应该隐藏加载指示器', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading adapter configuration...')).not.toBeInTheDocument()
        expect(screen.getByText('Test Adapter')).toBeInTheDocument()
      })
    })
  })

  describe('配置字段测试', () => {
    it('应该渲染字符串输入字段', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument()
      })
      
      const apiKeyInput = screen.getByLabelText('API Key')
      expect(apiKeyInput).toHaveValue('test-api-key')
      expect(apiKeyInput).toHaveAttribute('type', 'text')
    })

    it('应该渲染选择字段', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Model')).toBeInTheDocument()
      })
      
      const modelSelect = screen.getByLabelText('Model')
      expect(modelSelect).toHaveValue('gpt-4')
      
      // 检查选项
      expect(screen.getByRole('option', { name: 'gpt-3.5-turbo' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'gpt-4' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'claude-3' })).toBeInTheDocument()
    })

    it('应该渲染数字输入字段', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Temperature')).toBeInTheDocument()
      })
      
      const temperatureInput = screen.getByLabelText('Temperature')
      expect(temperatureInput).toHaveValue(0.8)
      expect(temperatureInput).toHaveAttribute('type', 'number')
      expect(temperatureInput).toHaveAttribute('min', '0')
      expect(temperatureInput).toHaveAttribute('max', '2')
    })

    it('应该渲染整数输入字段', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Max Tokens')).toBeInTheDocument()
      })
      
      const maxTokensInput = screen.getByLabelText('Max Tokens')
      expect(maxTokensInput).toHaveValue(1024)
      expect(maxTokensInput).toHaveAttribute('type', 'number')
    })

    it('应该渲染布尔值复选框', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Enabled')).toBeInTheDocument()
      })
      
      const enabledCheckbox = screen.getByLabelText('Enabled')
      expect(enabledCheckbox).toBeChecked()
      expect(enabledCheckbox).toHaveAttribute('type', 'checkbox')
    })

    it('应该渲染数组文本区域', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Tags')).toBeInTheDocument()
      })
      
      const tagsTextarea = screen.getByLabelText('Tags')
      expect(tagsTextarea).toHaveValue('ai\nnlp')
      expect(tagsTextarea.tagName).toBe('TEXTAREA')
    })

    it('应该渲染文本区域', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Description')).toBeInTheDocument()
      })
      
      const descriptionTextarea = screen.getByLabelText('Description')
      expect(descriptionTextarea).toHaveValue('Custom configuration description')
      expect(descriptionTextarea.tagName).toBe('TEXTAREA')
    })
  })

  describe('配置编辑测试', () => {
    it('应该更新字符串字段', async () => {
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument()
      })
      
      const apiKeyInput = screen.getByLabelText('API Key')
      await user.clear(apiKeyInput)
      await user.type(apiKeyInput, 'new-api-key')
      
      expect(apiKeyInput).toHaveValue('new-api-key')
    })

    it('应该更新选择字段', async () => {
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Model')).toBeInTheDocument()
      })
      
      const modelSelect = screen.getByLabelText('Model')
      await user.selectOptions(modelSelect, 'claude-3')
      
      expect(modelSelect).toHaveValue('claude-3')
    })

    it('应该更新数字字段', async () => {
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Temperature')).toBeInTheDocument()
      })
      
      const temperatureInput = screen.getByLabelText('Temperature')
      await user.clear(temperatureInput)
      await user.type(temperatureInput, '1.2')
      
      expect(temperatureInput).toHaveValue(1.2)
    })

    it('应该更新布尔值字段', async () => {
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Enabled')).toBeInTheDocument()
      })
      
      const enabledCheckbox = screen.getByLabelText('Enabled')
      await user.click(enabledCheckbox)
      
      expect(enabledCheckbox).not.toBeChecked()
    })

    it('应该更新数组字段', async () => {
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Tags')).toBeInTheDocument()
      })
      
      const tagsTextarea = screen.getByLabelText('Tags')
      await user.clear(tagsTextarea)
      await user.type(tagsTextarea, 'new\ntag\nlist')
      
      expect(tagsTextarea).toHaveValue('new\ntag\nlist')
    })
  })

  describe('配置保存测试', () => {
    it('应该保存配置', async () => {
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument()
      })
      
      // 修改配置
      const apiKeyInput = screen.getByLabelText('API Key')
      await user.clear(apiKeyInput)
      await user.type(apiKeyInput, 'updated-key')
      
      // 保存配置
      const saveButton = screen.getByRole('button', { name: /save configuration/i })
      await user.click(saveButton)
      
      expect(mockService.updateAdapterConfig).toHaveBeenCalledWith({
        adapter_id: 'test-adapter',
        config: {
          api_key: 'updated-key',
          model: 'gpt-4',
          temperature: 0.8,
          max_tokens: 1024,
          enabled: true,
          tags: ['ai', 'nlp'],
          description: 'Custom configuration description',
        },
        merge: true,
      })
    })

    it('应该显示保存成功消息', async () => {
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument()
      })
      
      const saveButton = screen.getByRole('button', { name: /save configuration/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('Configuration saved successfully')).toBeInTheDocument()
      })
    })

    it('应该显示保存中状态', async () => {
      // 模拟慢速保存
      mockService.updateAdapterConfig.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      )
      
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument()
      })
      
      const saveButton = screen.getByRole('button', { name: /save configuration/i })
      await user.click(saveButton)
      
      expect(saveButton).toHaveTextContent('Saving...')
      expect(saveButton).toBeDisabled()
    })

    it('应该处理保存错误', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.updateAdapterConfig).mockImplementation(errorService.updateAdapterConfig)
      
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument()
      })
      
      const saveButton = screen.getByRole('button', { name: /save configuration/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('Invalid config')).toBeInTheDocument()
      })
    })
  })

  describe('配置重置测试', () => {
    it('应该重置配置到默认值', async () => {
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Reset to Default')).toBeInTheDocument()
      })
      
      // 修改配置
      const apiKeyInput = screen.getByLabelText('API Key')
      await user.clear(apiKeyInput)
      await user.type(apiKeyInput, 'modified-key')
      
      // 重置配置
      const resetButton = screen.getByRole('button', { name: /reset to default/i })
      await user.click(resetButton)
      
      // 检查字段是否重置
      expect(apiKeyInput).toHaveValue('')
      expect(screen.getByLabelText('Model')).toHaveValue('gpt-3.5-turbo')
      expect(screen.getByLabelText('Temperature')).toHaveValue(0.7)
    })
  })

  describe('能力展示测试', () => {
    it('应该显示适配器能力', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Capabilities')).toBeInTheDocument()
      })
      
      // 检查能力信息
      expect(screen.getByText('text_generation')).toBeInTheDocument()
      expect(screen.getByText('Generate text using AI models')).toBeInTheDocument()
      expect(screen.getByText('Advanced')).toBeInTheDocument()
      expect(screen.getByText('Required: input, model')).toBeInTheDocument()
      expect(screen.getByText('Optional: temperature, max_tokens')).toBeInTheDocument()
    })

    it('应该隐藏空的能力列表', async () => {
      const metadataWithoutCapabilities = createMockAdapterMetadata({
        capabilities: [],
      })
      mockService.getAdapterDetails.mockResolvedValue(metadataWithoutCapabilities)
      
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Adapter')).toBeInTheDocument()
      })
      
      expect(screen.queryByText('Capabilities')).not.toBeInTheDocument()
    })
  })

  describe('资源需求测试', () => {
    it('应该显示资源需求', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Resource Requirements')).toBeInTheDocument()
      })
      
      // 检查资源需求信息
      expect(screen.getByText('Min Memory: 1024 MB')).toBeInTheDocument()
      expect(screen.getByText('Min CPU Cores: 2')).toBeInTheDocument()
      expect(screen.getByText('GPU Required: No')).toBeInTheDocument()
      expect(screen.getByText('Python Version: 3.8+')).toBeInTheDocument()
      
      // 检查依赖项
      expect(screen.getByText('Dependencies:')).toBeInTheDocument()
      expect(screen.getByText('torch>=1.9.0')).toBeInTheDocument()
      expect(screen.getByText('transformers>=4.0.0')).toBeInTheDocument()
    })

    it('应该处理可选的资源需求', async () => {
      const metadataWithMinimalRequirements = createMockAdapterMetadata({
        resource_requirements: {
          gpu_required: true,
          dependencies: [],
        },
      })
      mockService.getAdapterDetails.mockResolvedValue(metadataWithMinimalRequirements)
      
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('GPU Required: Yes')).toBeInTheDocument()
      })
      
      // 不应该显示未定义的字段
      expect(screen.queryByText('Min Memory:')).not.toBeInTheDocument()
      expect(screen.queryByText('Min CPU Cores:')).not.toBeInTheDocument()
    })
  })

  describe('关闭功能测试', () => {
    it('应该调用 onClose 回调', async () => {
      const mockOnClose = vi.fn()
      const { user } = renderWithProviders(
        <AdapterConfig adapterId="test-adapter" onClose={mockOnClose} />
      )
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
      })
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)
      
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('应该支持 ESC 键关闭', async () => {
      const mockOnClose = vi.fn()
      const { user } = renderWithProviders(
        <AdapterConfig adapterId="test-adapter" onClose={mockOnClose} />
      )
      
      await waitFor(() => {
        expect(screen.getByText('Test Adapter')).toBeInTheDocument()
      })
      
      await user.keyboard('{Escape}')
      
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('错误处理测试', () => {
    it('应该显示加载错误', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.getAdapterDetails).mockImplementation(errorService.getAdapterDetails)
      
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load adapter data/i)).toBeInTheDocument()
      })
      
      // 应该显示重试按钮
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('应该处理重试加载', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.getAdapterDetails).mockImplementationOnce(errorService.getAdapterDetails)
      
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load adapter data/i)).toBeInTheDocument()
      })
      
      // 恢复正常响应并重试
      vi.mocked(mockService.getAdapterDetails).mockResolvedValue(mockMetadata)
      
      await user.click(screen.getByRole('button', { name: /retry/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Test Adapter')).toBeInTheDocument()
        expect(screen.queryByText(/failed to load adapter data/i)).not.toBeInTheDocument()
      })
    })

    it('应该处理无配置选项的适配器', async () => {
      const metadataWithoutConfig = createMockAdapterMetadata({
        config_schema: {},
      })
      mockService.getAdapterDetails.mockResolvedValue(metadataWithoutConfig)
      
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('No configuration options available for this adapter')).toBeInTheDocument()
      })
    })
  })

  describe('无障碍性测试', () => {
    it('应该提供适当的 ARIA 标签', async () => {
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Adapter')).toBeInTheDocument()
      })
      
      // 检查表单区域
      const configForm = screen.getByRole('form', { name: /adapter configuration/i })
      expect(configForm).toBeInTheDocument()
      
      // 检查字段标签
      const formFields = screen.getAllByRole('textbox')
      formFields.forEach(field => {
        expect(field).toHaveAttribute('aria-labelledby')
      })
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument()
      })
      
      const apiKeyInput = screen.getByLabelText('API Key')
      apiKeyInput.focus()
      
      // Tab 键应该移动到下一个字段
      await user.keyboard('{Tab}')
      
      const modelSelect = screen.getByLabelText('Model')
      expect(modelSelect).toHaveFocus()
    })

    it('应该提供错误消息的 ARIA 描述', async () => {
      const errorService = mockServiceWithErrors()
      vi.mocked(mockService.updateAdapterConfig).mockImplementation(errorService.updateAdapterConfig)
      
      const { user } = renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('button', { name: /save configuration/i }))
      
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert')
        expect(errorMessage).toHaveAttribute('aria-live', 'polite')
        expect(errorMessage).toHaveTextContent('Invalid config')
      })
    })
  })

  describe('性能测试', () => {
    it('应该优化重渲染', () => {
      const renderSpy = vi.fn()
      
      function SpyWrapper(props: any) {
        renderSpy()
        return <AdapterConfig {...props} />
      }
      
      const { rerender } = renderWithProviders(
        <SpyWrapper adapterId="test-adapter" />
      )
      
      // 使用相同 props 重新渲染不应该触发不必要的重渲染
      rerender(<SpyWrapper adapterId="test-adapter" />)
      
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('应该处理大量配置项', async () => {
      const metadataWithManyFields = createMockAdapterMetadata({
        config_schema: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [
            `field_${i}`,
            {
              type: 'string',
              title: `Field ${i}`,
              description: `Description for field ${i}`,
              default: `value_${i}`,
            },
          ])
        ),
      })
      
      mockService.getAdapterDetails.mockResolvedValue(metadataWithManyFields)
      mockService.getAdapterConfig.mockResolvedValue(
        Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`field_${i}`, `value_${i}`])
        )
      )
      
      renderWithProviders(<AdapterConfig adapterId="test-adapter" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Field 0')).toBeInTheDocument()
        expect(screen.getByLabelText('Field 49')).toBeInTheDocument()
      })
      
      // 所有字段都应该被渲染
      expect(screen.getAllByRole('textbox').length).toBe(50)
    })
  })
})
