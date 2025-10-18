/**
 * API 集成测试
 * 
 * 验证适配器类型定义和桌面操作API的正确性
 * 
 * @module tests/api-integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type {
  AdapterInfo,
  AdapterMetadata,
  AdapterInstallRequest,
  AdapterExecutionRequest,
  AdapterStatus,
  AdapterType,
  CapabilityLevel,
  PaginatedResponse,
  CommandResponse,
} from '../types/adapter';

import type {
  DesktopInfo,
  WindowInfo,
  SystemResources,
  WorkflowDefinition,
  WorkflowStatus,
  TaskInfo,
} from '../services/api/desktop';

import type {
  SystemInfo,
  AppVersionInfo,
  UpdateInfo,
} from '../services/api/system';

// ================================
// 适配器类型测试
// ================================

describe('适配器类型定义', () => {
  it('应该正确创建 AdapterInfo 对象', () => {
    const adapterInfo: AdapterInfo = {
      name: 'test-adapter',
      path: '/path/to/adapter',
      size: 1024000,
      version: '1.0.0',
      description: '测试适配器',
      status: AdapterStatus.Loaded,
      load_time: new Date().toISOString(),
      memory_usage: 512000,
      config: {
        enabled: true,
        timeout: 30000,
      },
    };

    expect(adapterInfo.name).toBe('test-adapter');
    expect(adapterInfo.status).toBe(AdapterStatus.Loaded);
    expect(adapterInfo.config.enabled).toBe(true);
  });

  it('应该正确创建 AdapterMetadata 对象', () => {
    const adapterMetadata: AdapterMetadata = {
      id: 'test-adapter',
      name: '测试适配器',
      version: '1.0.0',
      adapter_type: AdapterType.Soft,
      description: '这是一个测试适配器',
      author: '测试作者',
      license: 'MIT',
      tags: ['test', 'demo'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      capabilities: [
        {
          name: '文本处理',
          description: '处理文本内容',
          level: CapabilityLevel.Basic,
          required_params: ['text'],
          optional_params: ['format'],
        },
      ],
      compatibility: {
        base_models: ['gpt-3.5-turbo'],
        frameworks: { 'transformers': '4.0+' },
        operating_systems: ['linux', 'windows', 'macos'],
        python_versions: ['3.8+'],
      },
      resource_requirements: {
        min_memory_mb: 512,
        min_cpu_cores: 2,
        gpu_required: false,
        dependencies: ['torch', 'transformers'],
      },
      config_schema: {
        timeout: {
          type: 'number',
          default: 30000,
          description: '超时时间',
        },
      },
      default_config: {
        timeout: 30000,
        enabled: true,
      },
      file_size_bytes: 1024000,
      parameter_count: 1000000,
    };

    expect(adapterMetadata.id).toBe('test-adapter');
    expect(adapterMetadata.adapter_type).toBe(AdapterType.Soft);
    expect(adapterMetadata.capabilities).toHaveLength(1);
    expect(adapterMetadata.capabilities[0].level).toBe(CapabilityLevel.Basic);
  });

  it('应该正确创建 AdapterInstallRequest 对象', () => {
    const installRequest: AdapterInstallRequest = {
      adapter_id: 'test-adapter',
      source: 'market',
      force: false,
      options: {
        auto_load: true,
        config: {
          timeout: 30000,
        },
      },
    };

    expect(installRequest.adapter_id).toBe('test-adapter');
    expect(installRequest.source).toBe('market');
    expect(installRequest.force).toBe(false);
  });

  it('应该正确创建 AdapterExecutionRequest 对象', () => {
    const executionRequest: AdapterExecutionRequest = {
      adapter_id: 'test-adapter',
      action: 'process_text',
      params: {
        text: 'Hello, World!',
        format: 'markdown',
      },
      timeout: 30,
    };

    expect(executionRequest.adapter_id).toBe('test-adapter');
    expect(executionRequest.action).toBe('process_text');
    expect(executionRequest.params.text).toBe('Hello, World!');
  });

  it('应该正确创建 PaginatedResponse 对象', () => {
    const paginatedResponse: PaginatedResponse<AdapterInfo> = {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    };

    expect(paginatedResponse.page).toBe(1);
    expect(paginatedResponse.page_size).toBe(10);
    expect(paginatedResponse.has_next).toBe(false);
  });

  it('应该正确创建 CommandResponse 对象', () => {
    const commandResponse: CommandResponse<AdapterInfo> = {
      success: true,
      data: {
        name: 'test-adapter',
        status: AdapterStatus.Loaded,
        config: {},
      },
      timestamp: Date.now(),
    };

    expect(commandResponse.success).toBe(true);
    expect(commandResponse.data?.name).toBe('test-adapter');
  });
});

// ================================
// 桌面操作类型测试
// ================================

describe('桌面操作类型定义', () => {
  it('应该正确创建 DesktopInfo 对象', () => {
    const desktopInfo: DesktopInfo = {
      screen_width: 1920,
      screen_height: 1080,
      scale_factor: 1.0,
      display_count: 1,
      primary_display_index: 0,
      displays: [
        {
          index: 0,
          name: '主显示器',
          is_primary: true,
          width: 1920,
          height: 1080,
          refresh_rate: 60,
          scale_factor: 1.0,
          x: 0,
          y: 0,
          color_depth: 24,
          display_type: 'internal',
        },
      ],
    };

    expect(desktopInfo.screen_width).toBe(1920);
    expect(desktopInfo.screen_height).toBe(1080);
    expect(desktopInfo.displays).toHaveLength(1);
    expect(desktopInfo.displays[0].is_primary).toBe(true);
  });

  it('应该正确创建 WindowInfo 对象', () => {
    const windowInfo: WindowInfo = {
      id: 'window-1',
      title: '测试窗口',
      class_name: 'TestWindow',
      process_id: 1234,
      process_name: 'test-app',
      position: { x: 100, y: 100 },
      size: { width: 800, height: 600 },
      visible: true,
      minimized: false,
      maximized: false,
      fullscreen: false,
      always_on_top: false,
      state: 'normal',
    };

    expect(windowInfo.id).toBe('window-1');
    expect(windowInfo.title).toBe('测试窗口');
    expect(windowInfo.position.x).toBe(100);
    expect(windowInfo.size.width).toBe(800);
    expect(windowInfo.state).toBe('normal');
  });

  it('应该正确创建 SystemResources 对象', () => {
    const systemResources: SystemResources = {
      cpu_usage: 25.5,
      memory: {
        total_mb: 8192,
        used_mb: 4096,
        available_mb: 4096,
        usage_percent: 50.0,
      },
      disk: {
        total_mb: 500000,
        used_mb: 250000,
        available_mb: 250000,
        usage_percent: 50.0,
      },
      gpu: {
        name: 'NVIDIA GeForce RTX 3080',
        usage_percent: 15.0,
        memory: {
          total_mb: 10240,
          used_mb: 2048,
          usage_percent: 20.0,
        },
        temperature: 65,
      },
      network: {
        download_speed_kbps: 1000,
        upload_speed_kbps: 500,
        total_downloaded_mb: 10000,
        total_uploaded_mb: 5000,
      },
    };

    expect(systemResources.cpu_usage).toBe(25.5);
    expect(systemResources.memory.total_mb).toBe(8192);
    expect(systemResources.gpu?.name).toBe('NVIDIA GeForce RTX 3080');
  });

  it('应该正确创建 WorkflowDefinition 对象', () => {
    const workflowDefinition: WorkflowDefinition = {
      id: 'workflow-1',
      name: '测试工作流',
      description: '这是一个测试工作流',
      version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      steps: [
        {
          id: 'step-1',
          name: '步骤1',
          type: 'action',
          description: '执行第一个步骤',
          config: { action: 'process_data' },
          next_steps: ['step-2'],
          status: 'pending',
        },
      ],
      config: {
        enabled: true,
        timeout_ms: 300000,
        max_retries: 3,
        concurrency: 1,
        stop_on_error: true,
        log_level: 'info',
        notifications: {
          on_start: true,
          on_complete: true,
          on_error: true,
          on_cancel: true,
        },
      },
      status: WorkflowStatus.Draft,
      tags: ['test', 'demo'],
      category: 'automation',
    };

    expect(workflowDefinition.id).toBe('workflow-1');
    expect(workflowDefinition.name).toBe('测试工作流');
    expect(workflowDefinition.steps).toHaveLength(1);
    expect(workflowDefinition.status).toBe(WorkflowStatus.Draft);
  });

  it('应该正确创建 TaskInfo 对象', () => {
    const taskInfo: TaskInfo = {
      id: 'task-1',
      name: '测试任务',
      type: 'workflow',
      status: 'running',
      priority: 'normal',
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      progress: {
        current: 50,
        total: 100,
        percentage: 50,
        message: '处理中...',
      },
      config: {
        timeout: 300000,
        retries: 3,
      },
    };

    expect(taskInfo.id).toBe('task-1');
    expect(taskInfo.type).toBe('workflow');
    expect(taskInfo.status).toBe('running');
    expect(taskInfo.progress.percentage).toBe(50);
  });
});

// ================================
// 系统类型测试
// ================================

describe('系统类型定义', () => {
  it('应该正确创建 SystemInfo 对象', () => {
    const systemInfo: SystemInfo = {
      os_name: 'Windows 10',
      os_version: '10.0.19041',
      arch: 'x86_64',
      hostname: 'DESKTOP-ABC123',
      username: 'user',
      boot_time: new Date().toISOString(),
      uptime_seconds: 86400,
      cpu: {
        model: 'Intel Core i7-10700K',
        cores: 8,
        threads: 16,
        frequency_mhz: 3800,
      },
      memory: {
        total_mb: 16384,
        available_mb: 8192,
        used_mb: 8192,
      },
      disks: [
        {
          name: 'C:',
          mount_point: 'C:\\',
          total_mb: 500000,
          used_mb: 250000,
          available_mb: 250000,
          file_system: 'NTFS',
        },
      ],
      network_interfaces: [
        {
          name: 'Ethernet',
          mac_address: '00:11:22:33:44:55',
          ip_addresses: ['192.168.1.100'],
          is_up: true,
        },
      ],
    };

    expect(systemInfo.os_name).toBe('Windows 10');
    expect(systemInfo.cpu.cores).toBe(8);
    expect(systemInfo.memory.total_mb).toBe(16384);
    expect(systemInfo.disks).toHaveLength(1);
  });

  it('应该正确创建 AppVersionInfo 对象', () => {
    const appVersionInfo: AppVersionInfo = {
      app_name: 'Zishu Sensei',
      version: '1.0.0',
      build_number: '100',
      build_time: new Date().toISOString(),
      git_commit: 'abc123def456',
      git_branch: 'main',
      build_type: 'release',
      target_platform: 'x86_64-pc-windows-msvc',
    };

    expect(appVersionInfo.app_name).toBe('Zishu Sensei');
    expect(appVersionInfo.version).toBe('1.0.0');
    expect(appVersionInfo.build_type).toBe('release');
  });

  it('应该正确创建 UpdateInfo 对象', () => {
    const updateInfo: UpdateInfo = {
      has_update: true,
      latest_version: '1.1.0',
      current_version: '1.0.0',
      release_notes: '修复了一些bug，添加了新功能',
      download_url: 'https://github.com/zishu-sensei/releases/download/v1.1.0/zishu-sensei-1.1.0.exe',
      file_size_bytes: 50000000,
      release_date: new Date().toISOString(),
      update_type: 'minor',
      mandatory: false,
    };

    expect(updateInfo.has_update).toBe(true);
    expect(updateInfo.latest_version).toBe('1.1.0');
    expect(updateInfo.update_type).toBe('minor');
    expect(updateInfo.mandatory).toBe(false);
  });
});

// ================================
// 类型守卫函数测试
// ================================

describe('类型守卫函数', () => {
  it('应该正确验证适配器状态', () => {
    const { isValidAdapterStatus } = require('../types/adapter');
    
    expect(isValidAdapterStatus('loaded')).toBe(true);
    expect(isValidAdapterStatus('unloaded')).toBe(true);
    expect(isValidAdapterStatus('loading')).toBe(true);
    expect(isValidAdapterStatus('invalid')).toBe(false);
    expect(isValidAdapterStatus(null)).toBe(false);
  });

  it('应该正确验证适配器类型', () => {
    const { isValidAdapterType } = require('../types/adapter');
    
    expect(isValidAdapterType('soft')).toBe(true);
    expect(isValidAdapterType('hard')).toBe(true);
    expect(isValidAdapterType('intelligent')).toBe(true);
    expect(isValidAdapterType('invalid')).toBe(false);
    expect(isValidAdapterType(null)).toBe(false);
  });

  it('应该正确验证能力等级', () => {
    const { isValidCapabilityLevel } = require('../types/adapter');
    
    expect(isValidCapabilityLevel('basic')).toBe(true);
    expect(isValidCapabilityLevel('intermediate')).toBe(true);
    expect(isValidCapabilityLevel('advanced')).toBe(true);
    expect(isValidCapabilityLevel('expert')).toBe(true);
    expect(isValidCapabilityLevel('invalid')).toBe(false);
    expect(isValidCapabilityLevel(null)).toBe(false);
  });

  it('应该正确验证适配器信息完整性', () => {
    const { isCompleteAdapterInfo } = require('../types/adapter');
    
    const validInfo = {
      name: 'test-adapter',
      status: 'loaded',
    };
    
    const invalidInfo = {
      name: 'test-adapter',
      // 缺少 status
    };
    
    expect(isCompleteAdapterInfo(validInfo)).toBe(true);
    expect(isCompleteAdapterInfo(invalidInfo)).toBe(false);
    expect(isCompleteAdapterInfo(null)).toBe(false);
  });
});

// ================================
// 工具函数测试
// ================================

describe('工具函数', () => {
  it('应该正确格式化文件大小', () => {
    const { formatFileSize } = require('../services/api/desktop');
    
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1048576)).toBe('1.00 MB');
    expect(formatFileSize(1073741824)).toBe('1.00 GB');
    expect(formatFileSize(512)).toBe('512.00 B');
  });

  it('应该正确格式化时间', () => {
    const { formatDuration } = require('../services/api/desktop');
    
    expect(formatDuration(60000)).toBe('1分钟0秒');
    expect(formatDuration(3661000)).toBe('1小时1分钟1秒');
    expect(formatDuration(30000)).toBe('30秒');
  });

  it('应该正确计算进度百分比', () => {
    const { calculateProgress } = require('../services/api/desktop');
    
    expect(calculateProgress(50, 100)).toBe(50);
    expect(calculateProgress(25, 100)).toBe(25);
    expect(calculateProgress(0, 100)).toBe(0);
    expect(calculateProgress(100, 100)).toBe(100);
    expect(calculateProgress(150, 100)).toBe(100); // 限制在100%
  });

  it('应该正确验证URL格式', () => {
    const { validateUrl } = require('../services/api/system');
    
    expect(validateUrl('https://example.com')).toEqual({ valid: true });
    expect(validateUrl('http://localhost:3000')).toEqual({ valid: true });
    expect(validateUrl('invalid-url')).toEqual({ valid: false, error: '无效的URL格式' });
    expect(validateUrl('')).toEqual({ valid: false, error: 'URL不能为空' });
  });

  it('应该正确比较版本号', () => {
    const { compareVersions } = require('../services/api/system');
    
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });
});

// ================================
// 集成测试
// ================================

describe('API 集成测试', () => {
  it('应该能够正确导入所有API模块', () => {
    expect(() => {
      require('../services/api/chat');
      require('../services/api/desktop');
      require('../services/api/adapter');
      require('../services/api/system');
      require('../services/api/index');
    }).not.toThrow();
  });

  it('应该能够正确导入所有类型定义', () => {
    expect(() => {
      require('../types/adapter');
      require('../types/index');
    }).not.toThrow();
  });

  it('应该能够正确创建API实例', () => {
    const { ChatAPI } = require('../services/api/chat');
    const { DesktopAPI } = require('../services/api/desktop');
    const { AdapterAPI } = require('../services/api/adapter');
    const { SystemAPI } = require('../services/api/system');

    expect(ChatAPI).toBeDefined();
    expect(DesktopAPI).toBeDefined();
    expect(AdapterAPI).toBeDefined();
    expect(SystemAPI).toBeDefined();
  });
});
