/**
 * 适配器管理服务测试
 * 
 * 测试 AdapterManagementService 的所有功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  AdapterManagementService,
  AdapterInstallStatus,
  type InstalledAdapter,
  type AdapterVersion,
  type AdapterDependency,
  type AdapterPermission,
} from '../../../services/adapterManagementService';
import { createMockApiResponse, createMockErrorResponse } from '../../mocks/factories';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('AdapterManagementService', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

  // 辅助函数：创建mock适配器
  const createMockInstalledAdapter = (overrides?: Partial<InstalledAdapter>): InstalledAdapter => ({
    id: 'test-adapter',
    name: 'test-adapter',
    display_name: '测试适配器',
    version: '1.0.0',
    install_path: '/path/to/adapter',
    status: AdapterInstallStatus.Installed,
    enabled: true,
    auto_update: false,
    source: 'market',
    source_id: 'market-123',
    description: '测试适配器描述',
    author: '测试作者',
    license: 'MIT',
    homepage_url: 'https://example.com',
    installed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
    config: {},
    metadata: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================
  // 基础管理测试
  // ================================
  describe('getInstalledAdapters', () => {
    it('应该成功获取所有已安装的适配器', async () => {
      const mockAdapters = [
        createMockInstalledAdapter({ id: 'adapter-1', name: 'adapter-1' }),
        createMockInstalledAdapter({ id: 'adapter-2', name: 'adapter-2' }),
      ];

      mockInvoke.mockResolvedValue(createMockApiResponse(mockAdapters));

      const result = await AdapterManagementService.getInstalledAdapters();

      expect(mockInvoke).toHaveBeenCalledWith('get_installed_adapters');
      expect(result).toEqual(mockAdapters);
      expect(result).toHaveLength(2);
    });

    it('应该处理空适配器列表', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse([]));

      const result = await AdapterManagementService.getInstalledAdapters();

      expect(result).toEqual([]);
    });

    it('应该处理获取失败', async () => {
      mockInvoke.mockResolvedValue(createMockErrorResponse('获取失败'));

      await expect(
        AdapterManagementService.getInstalledAdapters()
      ).rejects.toThrow('获取失败');
    });
  });

  describe('getEnabledAdapters', () => {
    it('应该只返回已启用的适配器', async () => {
      const mockAdapters = [
        createMockInstalledAdapter({ id: 'adapter-1', enabled: true }),
        createMockInstalledAdapter({ id: 'adapter-2', enabled: true }),
      ];

      mockInvoke.mockResolvedValue(createMockApiResponse(mockAdapters));

      const result = await AdapterManagementService.getEnabledAdapters();

      expect(result.every((a) => a.enabled)).toBe(true);
    });

    it('应该处理没有已启用的适配器', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse([]));

      const result = await AdapterManagementService.getEnabledAdapters();

      expect(result).toEqual([]);
    });
  });

  describe('getInstalledAdapter', () => {
    it('应该成功获取单个适配器详情', async () => {
      const mockAdapter = createMockInstalledAdapter({ id: 'test-adapter' });

      mockInvoke.mockResolvedValue(createMockApiResponse(mockAdapter));

      const result = await AdapterManagementService.getInstalledAdapter('test-adapter');

      expect(mockInvoke).toHaveBeenCalledWith('get_installed_adapter', {
        adapterId: 'test-adapter',
      });
      expect(result).toEqual(mockAdapter);
    });

    it('应该处理适配器不存在', async () => {
      mockInvoke.mockResolvedValue(createMockErrorResponse('适配器不存在'));

      await expect(
        AdapterManagementService.getInstalledAdapter('nonexistent')
      ).rejects.toThrow('适配器不存在');
    });
  });

  describe('toggleAdapter', () => {
    it('应该成功启用适配器', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterManagementService.toggleAdapter('test-adapter', true);

      expect(mockInvoke).toHaveBeenCalledWith('toggle_adapter', {
        adapterId: 'test-adapter',
        enabled: true,
      });
      expect(result).toBe(true);
    });

    it('应该成功禁用适配器', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterManagementService.toggleAdapter('test-adapter', false);

      expect(mockInvoke).toHaveBeenCalledWith('toggle_adapter', {
        adapterId: 'test-adapter',
        enabled: false,
      });
      expect(result).toBe(true);
    });

    it('应该处理切换失败', async () => {
      mockInvoke.mockResolvedValue(createMockErrorResponse('切换失败'));

      await expect(
        AdapterManagementService.toggleAdapter('test-adapter', true)
      ).rejects.toThrow('切换失败');
    });
  });

  describe('removeAdapter', () => {
    it('应该成功删除适配器', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterManagementService.removeAdapter('test-adapter');

      expect(mockInvoke).toHaveBeenCalledWith('remove_installed_adapter', {
        adapterId: 'test-adapter',
      });
      expect(result).toBe(true);
    });

    it('应该处理删除失败', async () => {
      mockInvoke.mockResolvedValue(createMockErrorResponse('删除失败'));

      await expect(
        AdapterManagementService.removeAdapter('test-adapter')
      ).rejects.toThrow('删除失败');
    });
  });

  // ================================
  // 版本管理测试
  // ================================
  describe('Version Management', () => {
    const createMockVersion = (overrides?: Partial<AdapterVersion>): AdapterVersion => ({
      id: 1,
      adapter_id: 'test-adapter',
      version: '1.0.0',
      released_at: new Date().toISOString(),
      changelog: '初始版本',
      download_url: 'https://example.com/download',
      file_size: 1024000,
      checksum: 'abc123',
      is_current: true,
      ...overrides,
    });

    describe('getAdapterVersions', () => {
      it('应该成功获取版本历史', async () => {
        const mockVersions = [
          createMockVersion({ version: '2.0.0', is_current: true }),
          createMockVersion({ version: '1.0.0', is_current: false }),
        ];

        mockInvoke.mockResolvedValue(createMockApiResponse(mockVersions));

        const result = await AdapterManagementService.getAdapterVersions('test-adapter');

        expect(mockInvoke).toHaveBeenCalledWith('get_adapter_versions', {
          adapterId: 'test-adapter',
        });
        expect(result).toEqual(mockVersions);
        expect(result).toHaveLength(2);
      });

      it('应该处理空版本历史', async () => {
        mockInvoke.mockResolvedValue(createMockApiResponse([]));

        const result = await AdapterManagementService.getAdapterVersions('test-adapter');

        expect(result).toEqual([]);
      });
    });

    describe('addVersion', () => {
      it('应该成功添加版本记录', async () => {
        const newVersion = createMockVersion({ version: '2.0.0' });

        mockInvoke.mockResolvedValue(createMockApiResponse(true));

        const result = await AdapterManagementService.addVersion(newVersion);

        expect(mockInvoke).toHaveBeenCalledWith('add_adapter_version', {
          version: newVersion,
        });
        expect(result).toBe(true);
      });

      it('应该处理添加失败', async () => {
        const newVersion = createMockVersion();

        mockInvoke.mockResolvedValue(createMockErrorResponse('添加失败'));

        await expect(
          AdapterManagementService.addVersion(newVersion)
        ).rejects.toThrow('添加失败');
      });
    });
  });

  // ================================
  // 依赖管理测试
  // ================================
  describe('Dependency Management', () => {
    const createMockDependency = (overrides?: Partial<AdapterDependency>): AdapterDependency => ({
      id: 1,
      adapter_id: 'test-adapter',
      dependency_id: 'dependency-adapter',
      version_requirement: '^1.0.0',
      required: true,
      ...overrides,
    });

    describe('getDependencies', () => {
      it('应该成功获取依赖列表', async () => {
        const mockDeps = [
          createMockDependency({ dependency_id: 'dep-1' }),
          createMockDependency({ dependency_id: 'dep-2' }),
        ];

        mockInvoke.mockResolvedValue(createMockApiResponse(mockDeps));

        const result = await AdapterManagementService.getDependencies('test-adapter');

        expect(mockInvoke).toHaveBeenCalledWith('get_adapter_dependencies', {
          adapterId: 'test-adapter',
        });
        expect(result).toEqual(mockDeps);
      });

      it('应该处理无依赖的情况', async () => {
        mockInvoke.mockResolvedValue(createMockApiResponse([]));

        const result = await AdapterManagementService.getDependencies('test-adapter');

        expect(result).toEqual([]);
      });
    });

    describe('addDependency', () => {
      it('应该成功添加依赖', async () => {
        const newDep = createMockDependency();

        mockInvoke.mockResolvedValue(createMockApiResponse(true));

        const result = await AdapterManagementService.addDependency(newDep);

        expect(mockInvoke).toHaveBeenCalledWith('add_adapter_dependency', {
          dependency: newDep,
        });
        expect(result).toBe(true);
      });
    });

    describe('removeDependency', () => {
      it('应该成功删除依赖', async () => {
        mockInvoke.mockResolvedValue(createMockApiResponse(true));

        const result = await AdapterManagementService.removeDependency(
          'test-adapter',
          'dep-1'
        );

        expect(mockInvoke).toHaveBeenCalledWith('remove_adapter_dependency', {
          adapterId: 'test-adapter',
          dependencyId: 'dep-1',
        });
        expect(result).toBe(true);
      });
    });

    describe('checkDependencies', () => {
      it('应该检测满足的依赖', async () => {
        const mockDeps = [
          createMockDependency({ dependency_id: 'dep-1', required: true }),
        ];
        const mockInstalled = [
          createMockInstalledAdapter({ id: 'dep-1', version: '1.0.0' }),
        ];

        mockInvoke
          .mockResolvedValueOnce(createMockApiResponse(mockDeps))
          .mockResolvedValueOnce(createMockApiResponse(mockInstalled));

        const result = await AdapterManagementService.checkDependencies('test-adapter');

        expect(result.satisfied).toBe(true);
        expect(result.missing).toHaveLength(0);
        expect(result.conflicts).toHaveLength(0);
      });

      it('应该检测缺失的依赖', async () => {
        const mockDeps = [
          createMockDependency({ dependency_id: 'missing-dep', required: true }),
        ];
        const mockInstalled: InstalledAdapter[] = [];

        mockInvoke
          .mockResolvedValueOnce(createMockApiResponse(mockDeps))
          .mockResolvedValueOnce(createMockApiResponse(mockInstalled));

        const result = await AdapterManagementService.checkDependencies('test-adapter');

        expect(result.satisfied).toBe(false);
        expect(result.missing).toContain('missing-dep');
      });

      it('应该忽略可选依赖', async () => {
        const mockDeps = [
          createMockDependency({ dependency_id: 'optional-dep', required: false }),
        ];
        const mockInstalled: InstalledAdapter[] = [];

        mockInvoke
          .mockResolvedValueOnce(createMockApiResponse(mockDeps))
          .mockResolvedValueOnce(createMockApiResponse(mockInstalled));

        const result = await AdapterManagementService.checkDependencies('test-adapter');

        expect(result.satisfied).toBe(true);
        expect(result.missing).toHaveLength(0);
      });
    });
  });

  // ================================
  // 权限管理测试
  // ================================
  describe('Permission Management', () => {
    const createMockPermission = (overrides?: Partial<AdapterPermission>): AdapterPermission => ({
      id: 1,
      adapter_id: 'test-adapter',
      permission_type: 'file_read',
      granted: true,
      granted_at: new Date().toISOString(),
      description: '读取文件权限',
      ...overrides,
    });

    describe('getPermissions', () => {
      it('应该成功获取权限列表', async () => {
        const mockPerms = [
          createMockPermission({ permission_type: 'file_read' }),
          createMockPermission({ permission_type: 'network' }),
        ];

        mockInvoke.mockResolvedValue(createMockApiResponse(mockPerms));

        const result = await AdapterManagementService.getPermissions('test-adapter');

        expect(mockInvoke).toHaveBeenCalledWith('get_adapter_permissions', {
          adapterId: 'test-adapter',
        });
        expect(result).toEqual(mockPerms);
      });
    });

    describe('grantPermission', () => {
      it('应该成功授予权限', async () => {
        mockInvoke.mockResolvedValue(createMockApiResponse(true));

        const result = await AdapterManagementService.grantPermission(
          'test-adapter',
          'file_write',
          true
        );

        expect(mockInvoke).toHaveBeenCalledWith('grant_adapter_permission', {
          adapterId: 'test-adapter',
          permissionType: 'file_write',
          granted: true,
        });
        expect(result).toBe(true);
      });

      it('应该成功撤销权限', async () => {
        mockInvoke.mockResolvedValue(createMockApiResponse(true));

        const result = await AdapterManagementService.grantPermission(
          'test-adapter',
          'file_write',
          false
        );

        expect(result).toBe(true);
      });
    });

    describe('checkPermission', () => {
      it('应该检查已授予的权限', async () => {
        mockInvoke.mockResolvedValue(createMockApiResponse(true));

        const result = await AdapterManagementService.checkPermission(
          'test-adapter',
          'file_read'
        );

        expect(mockInvoke).toHaveBeenCalledWith('check_adapter_permission', {
          adapterId: 'test-adapter',
          permissionType: 'file_read',
        });
        expect(result).toBe(true);
      });

      it('应该检查未授予的权限', async () => {
        mockInvoke.mockResolvedValue(createMockApiResponse(false));

        const result = await AdapterManagementService.checkPermission(
          'test-adapter',
          'system'
        );

        expect(result).toBe(false);
      });
    });

    describe('addPermission', () => {
      it('应该成功添加权限', async () => {
        const newPerm = createMockPermission();

        mockInvoke.mockResolvedValue(createMockApiResponse(true));

        const result = await AdapterManagementService.addPermission(newPerm);

        expect(mockInvoke).toHaveBeenCalledWith('add_adapter_permission', {
          permission: newPerm,
        });
        expect(result).toBe(true);
      });
    });
  });

  // ================================
  // 工具方法测试
  // ================================
  describe('Utility Methods', () => {
    describe('formatStatus', () => {
      it('应该正确格式化状态', () => {
        expect(
          AdapterManagementService.formatStatus(AdapterInstallStatus.Installed)
        ).toBe('已安装');
        expect(
          AdapterManagementService.formatStatus(AdapterInstallStatus.Installing)
        ).toBe('安装中');
        expect(
          AdapterManagementService.formatStatus(AdapterInstallStatus.InstallFailed)
        ).toBe('安装失败');
      });
    });

    describe('getStatusColor', () => {
      it('应该返回正确的状态颜色', () => {
        expect(
          AdapterManagementService.getStatusColor(AdapterInstallStatus.Installed)
        ).toBe('text-green-600');
        expect(
          AdapterManagementService.getStatusColor(AdapterInstallStatus.Installing)
        ).toBe('text-blue-600');
        expect(
          AdapterManagementService.getStatusColor(AdapterInstallStatus.InstallFailed)
        ).toBe('text-red-600');
      });
    });

    describe('formatPermissionType', () => {
      it('应该正确格式化权限类型', () => {
        expect(AdapterManagementService.formatPermissionType('file_read')).toBe('读取文件');
        expect(AdapterManagementService.formatPermissionType('file_write')).toBe('写入文件');
        expect(AdapterManagementService.formatPermissionType('network')).toBe('网络访问');
      });

      it('应该处理未知权限类型', () => {
        expect(AdapterManagementService.formatPermissionType('unknown')).toBe('unknown');
      });
    });

    describe('getPermissionRiskLevel', () => {
      it('应该识别高风险权限', () => {
        expect(AdapterManagementService.getPermissionRiskLevel('file_write')).toBe('high');
        expect(AdapterManagementService.getPermissionRiskLevel('system')).toBe('high');
      });

      it('应该识别中风险权限', () => {
        expect(AdapterManagementService.getPermissionRiskLevel('file_read')).toBe('medium');
        expect(AdapterManagementService.getPermissionRiskLevel('network')).toBe('medium');
      });

      it('应该识别低风险权限', () => {
        expect(AdapterManagementService.getPermissionRiskLevel('camera')).toBe('low');
        expect(AdapterManagementService.getPermissionRiskLevel('microphone')).toBe('low');
      });
    });

    describe('getPermissionRiskColor', () => {
      it('应该返回正确的风险颜色', () => {
        expect(AdapterManagementService.getPermissionRiskColor('file_write')).toBe('text-red-600');
        expect(AdapterManagementService.getPermissionRiskColor('network')).toBe('text-yellow-600');
        expect(AdapterManagementService.getPermissionRiskColor('camera')).toBe('text-green-600');
      });
    });
  });

  // ================================
  // 错误处理和边界情况
  // ================================
  describe('Error Handling', () => {
    it('应该处理网络错误', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      await expect(
        AdapterManagementService.getInstalledAdapters()
      ).rejects.toThrow('Network error');
    });

    it('应该处理无效的响应', async () => {
      mockInvoke.mockResolvedValue({ success: false });

      await expect(
        AdapterManagementService.getInstalledAdapters()
      ).rejects.toThrow();
    });

    it('应该记录错误到控制台', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error('Test error'));

      await expect(
        AdapterManagementService.getInstalledAdapters()
      ).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ================================
  // 集成测试
  // ================================
  describe('Integration Scenarios', () => {
    it('应该支持完整的适配器生命周期', async () => {
      // 1. 安装
      mockInvoke.mockResolvedValueOnce(createMockApiResponse(true));
      
      // 2. 获取详情
      const mockAdapter = createMockInstalledAdapter();
      mockInvoke.mockResolvedValueOnce(createMockApiResponse(mockAdapter));
      
      // 3. 启用
      mockInvoke.mockResolvedValueOnce(createMockApiResponse(true));
      
      // 4. 设置权限
      mockInvoke.mockResolvedValueOnce(createMockApiResponse(true));
      
      // 5. 删除
      mockInvoke.mockResolvedValueOnce(createMockApiResponse(true));

      // 执行生命周期操作
      const adapter = await AdapterManagementService.getInstalledAdapter('test-adapter');
      expect(adapter).toBeDefined();

      const enabled = await AdapterManagementService.toggleAdapter('test-adapter', true);
      expect(enabled).toBe(true);

      const permGranted = await AdapterManagementService.grantPermission(
        'test-adapter',
        'file_read',
        true
      );
      expect(permGranted).toBe(true);

      const removed = await AdapterManagementService.removeAdapter('test-adapter');
      expect(removed).toBe(true);
    });

    it('应该正确处理依赖解析', async () => {
      // 适配器A依赖适配器B
      const depsA = [
        {
          id: 1,
          adapter_id: 'adapter-a',
          dependency_id: 'adapter-b',
          version_requirement: '^1.0.0',
          required: true,
        },
      ];

      // 适配器B已安装
      const installedAdapters = [
        createMockInstalledAdapter({ id: 'adapter-b', version: '1.2.0' }),
      ];

      mockInvoke
        .mockResolvedValueOnce(createMockApiResponse(depsA))
        .mockResolvedValueOnce(createMockApiResponse(installedAdapters));

      const result = await AdapterManagementService.checkDependencies('adapter-a');

      expect(result.satisfied).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });
});

