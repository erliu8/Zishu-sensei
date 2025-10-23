/**
 * Package Config Domain Model
 * 打包配置领域模型
 */

import type {
  PackageConfig,
  PackagingPlatform,
  PackagingArchitecture,
  PackagingFormat,
} from './packaging.types';

/**
 * PackageConfig Domain 类
 */
export class PackageConfigDomain {
  /**
   * 验证配置是否有效
   */
  static validate(config: Partial<PackageConfig>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 必填字段验证
    if (!config.appName || config.appName.trim().length === 0) {
      errors.push('应用名称不能为空');
    }

    if (!config.version || !this.isValidVersion(config.version)) {
      errors.push('应用版本格式不正确');
    }

    if (!config.characterId) {
      errors.push('必须选择一个角色');
    }

    if (!config.platform) {
      errors.push('必须选择打包平台');
    }

    if (!config.architecture) {
      errors.push('必须选择打包架构');
    }

    if (!config.format) {
      errors.push('必须选择打包格式');
    }

    // 平台和架构兼容性验证
    if (config.platform && config.architecture) {
      if (!this.isPlatformArchitectureCompatible(config.platform, config.architecture)) {
        errors.push('所选架构与平台不兼容');
      }
    }

    // 平台和格式兼容性验证
    if (config.platform && config.format) {
      if (!this.isPlatformFormatCompatible(config.platform, config.format)) {
        errors.push('所选格式与平台不兼容');
      }
    }

    // 压缩级别验证
    if (
      config.compressionLevel !== undefined &&
      (config.compressionLevel < 0 || config.compressionLevel > 9)
    ) {
      errors.push('压缩级别必须在 0-9 之间');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证版本号格式
   */
  static isValidVersion(version: string): boolean {
    // 支持 semver 格式: 1.0.0, 1.0.0-beta, 1.0.0-rc.1
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?$/;
    return semverRegex.test(version);
  }

  /**
   * 检查平台和架构是否兼容
   */
  static isPlatformArchitectureCompatible(
    platform: PackagingPlatform,
    architecture: PackagingArchitecture
  ): boolean {
    const compatibilityMap: Record<PackagingPlatform, PackagingArchitecture[]> = {
      [PackagingPlatform.WINDOWS]: [
        PackagingArchitecture.X64,
        PackagingArchitecture.X86,
        PackagingArchitecture.ARM64,
      ],
      [PackagingPlatform.MACOS]: [
        PackagingArchitecture.X64,
        PackagingArchitecture.ARM64,
        PackagingArchitecture.UNIVERSAL,
      ],
      [PackagingPlatform.LINUX]: [
        PackagingArchitecture.X64,
        PackagingArchitecture.X86,
        PackagingArchitecture.ARM64,
        PackagingArchitecture.ARM,
      ],
      [PackagingPlatform.ANDROID]: [
        PackagingArchitecture.ARM64,
        PackagingArchitecture.ARM,
        PackagingArchitecture.X86,
        PackagingArchitecture.X64,
      ],
      [PackagingPlatform.IOS]: [PackagingArchitecture.ARM64],
      [PackagingPlatform.WEB]: [PackagingArchitecture.X64], // Web doesn't really have architecture
    };

    return compatibilityMap[platform]?.includes(architecture) ?? false;
  }

  /**
   * 检查平台和格式是否兼容
   */
  static isPlatformFormatCompatible(
    platform: PackagingPlatform,
    format: PackagingFormat
  ): boolean {
    const compatibilityMap: Record<PackagingPlatform, PackagingFormat[]> = {
      [PackagingPlatform.WINDOWS]: [
        PackagingFormat.ZIP,
        PackagingFormat.EXE,
      ],
      [PackagingPlatform.MACOS]: [
        PackagingFormat.ZIP,
        PackagingFormat.DMG,
        PackagingFormat.APP,
      ],
      [PackagingPlatform.LINUX]: [
        PackagingFormat.ZIP,
        PackagingFormat.TAR_GZ,
        PackagingFormat.DEB,
        PackagingFormat.RPM,
      ],
      [PackagingPlatform.ANDROID]: [PackagingFormat.APK],
      [PackagingPlatform.IOS]: [PackagingFormat.IPA],
      [PackagingPlatform.WEB]: [PackagingFormat.ZIP, PackagingFormat.TAR_GZ],
    };

    return compatibilityMap[platform]?.includes(format) ?? false;
  }

  /**
   * 获取平台支持的架构
   */
  static getSupportedArchitectures(platform: PackagingPlatform): PackagingArchitecture[] {
    const architectures: Record<PackagingPlatform, PackagingArchitecture[]> = {
      [PackagingPlatform.WINDOWS]: [
        PackagingArchitecture.X64,
        PackagingArchitecture.X86,
        PackagingArchitecture.ARM64,
      ],
      [PackagingPlatform.MACOS]: [
        PackagingArchitecture.X64,
        PackagingArchitecture.ARM64,
        PackagingArchitecture.UNIVERSAL,
      ],
      [PackagingPlatform.LINUX]: [
        PackagingArchitecture.X64,
        PackagingArchitecture.X86,
        PackagingArchitecture.ARM64,
        PackagingArchitecture.ARM,
      ],
      [PackagingPlatform.ANDROID]: [
        PackagingArchitecture.ARM64,
        PackagingArchitecture.ARM,
        PackagingArchitecture.X86,
        PackagingArchitecture.X64,
      ],
      [PackagingPlatform.IOS]: [PackagingArchitecture.ARM64],
      [PackagingPlatform.WEB]: [PackagingArchitecture.X64],
    };

    return architectures[platform] || [];
  }

  /**
   * 获取平台支持的格式
   */
  static getSupportedFormats(platform: PackagingPlatform): PackagingFormat[] {
    const formats: Record<PackagingPlatform, PackagingFormat[]> = {
      [PackagingPlatform.WINDOWS]: [PackagingFormat.ZIP, PackagingFormat.EXE],
      [PackagingPlatform.MACOS]: [
        PackagingFormat.ZIP,
        PackagingFormat.DMG,
        PackagingFormat.APP,
      ],
      [PackagingPlatform.LINUX]: [
        PackagingFormat.ZIP,
        PackagingFormat.TAR_GZ,
        PackagingFormat.DEB,
        PackagingFormat.RPM,
      ],
      [PackagingPlatform.ANDROID]: [PackagingFormat.APK],
      [PackagingPlatform.IOS]: [PackagingFormat.IPA],
      [PackagingPlatform.WEB]: [PackagingFormat.ZIP, PackagingFormat.TAR_GZ],
    };

    return formats[platform] || [];
  }

  /**
   * 创建默认配置
   */
  static createDefault(overrides?: Partial<PackageConfig>): Omit<PackageConfig, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      appName: '',
      version: '1.0.0',
      description: '',
      characterId: '',
      adapterIds: [],
      platform: PackagingPlatform.WINDOWS,
      architecture: PackagingArchitecture.X64,
      format: PackagingFormat.ZIP,
      includeAssets: true,
      compress: true,
      compressionLevel: 6,
      obfuscate: false,
      customConfig: {},
      environmentVariables: {},
      launchArgs: [],
      ...overrides,
    };
  }

  /**
   * 估算打包文件大小（MB）
   */
  static estimateFileSize(config: PackageConfig): number {
    let baseSize = 50; // 基础大小 50MB

    // 根据平台调整
    const platformSizes: Record<PackagingPlatform, number> = {
      [PackagingPlatform.WINDOWS]: 70,
      [PackagingPlatform.MACOS]: 80,
      [PackagingPlatform.LINUX]: 60,
      [PackagingPlatform.ANDROID]: 40,
      [PackagingPlatform.IOS]: 45,
      [PackagingPlatform.WEB]: 20,
    };

    baseSize = platformSizes[config.platform] || baseSize;

    // 适配器增加大小
    baseSize += config.adapterIds.length * 5;

    // 资源增加大小
    if (config.includeAssets) {
      baseSize += 30;
    }

    // 压缩减少大小
    if (config.compress && config.compressionLevel !== undefined) {
      const compressionRatio = 1 - (config.compressionLevel / 10) * 0.4;
      baseSize *= compressionRatio;
    }

    return Math.round(baseSize);
  }

  /**
   * 格式化配置为可读文本
   */
  static formatConfig(config: PackageConfig): string {
    return `
应用名称: ${config.appName}
版本: ${config.version}
平台: ${config.platform}
架构: ${config.architecture}
格式: ${config.format}
压缩: ${config.compress ? '是' : '否'}
代码混淆: ${config.obfuscate ? '是' : '否'}
包含资源: ${config.includeAssets ? '是' : '否'}
适配器数量: ${config.adapterIds.length}
    `.trim();
  }
}

