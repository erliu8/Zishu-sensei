/**
 * Bundle 分析和优化配置
 * 提供包体积分析和优化建议
 */

/**
 * Bundle 分析配置
 */
export const bundleAnalyzerConfig = {
  /**
   * 是否启用分析器
   */
  enabled: process.env.ANALYZE === 'true',
  
  /**
   * 分析器选项
   */
  options: {
    analyzerMode: 'static' as const,
    reportFilename: '../bundle-report.html',
    openAnalyzer: false,
    generateStatsFile: true,
    statsFilename: '../bundle-stats.json',
    logLevel: 'info' as const,
  },
};

/**
 * 动态导入优化配置
 */
export const dynamicImportConfig = {
  /**
   * 路由级别代码分割
   */
  routes: {
    // 认证页面（不需要 SSR）
    auth: ['/login', '/register', '/forgot-password', '/reset-password'],
    
    // 用户中心（需要认证）
    profile: ['/profile', '/profile/settings'],
    
    // 创建/编辑页面（不需要 SSR）
    editor: [
      '/posts/create',
      '/posts/[id]/edit',
      '/adapters/upload',
      '/characters/create',
      '/characters/[id]/edit',
    ],
    
    // 管理页面（需要权限）
    admin: ['/admin'],
  },

  /**
   * 组件级别代码分割
   */
  components: {
    // 重量级组件（按需加载）
    heavy: [
      'MarkdownEditor',
      'CodeBlock',
      'ImageGallery',
      'Chart',
      'ModelPreview',
      'PersonalityEditor',
      'ExpressionManager',
    ],
    
    // 第三方库（独立打包）
    vendor: [
      'react-markdown',
      'recharts',
      '@tanstack/react-virtual',
      'date-fns',
    ],
  },
};

/**
 * 包体积预算
 */
export const bundleSizebudget = {
  /**
   * 页面级别预算（gzipped）
   */
  pages: {
    // 首页
    home: 150 * 1024, // 150KB
    
    // 列表页
    list: 120 * 1024, // 120KB
    
    // 详情页
    detail: 100 * 1024, // 100KB
    
    // 编辑器页
    editor: 250 * 1024, // 250KB
  },

  /**
   * 资源类型预算（gzipped）
   */
  assets: {
    // JavaScript
    js: {
      main: 200 * 1024, // 200KB
      vendor: 300 * 1024, // 300KB
      chunk: 50 * 1024, // 50KB per chunk
    },
    
    // CSS
    css: {
      main: 50 * 1024, // 50KB
      chunk: 20 * 1024, // 20KB per chunk
    },
    
    // 图片
    images: {
      icon: 10 * 1024, // 10KB
      thumbnail: 50 * 1024, // 50KB
      full: 200 * 1024, // 200KB
    },
    
    // 字体
    fonts: {
      main: 100 * 1024, // 100KB
    },
  },

  /**
   * 总体预算
   */
  total: {
    // 首屏加载总预算
    initial: 500 * 1024, // 500KB
    
    // 所有资源总预算
    all: 2 * 1024 * 1024, // 2MB
  },
};

/**
 * 性能预算检查
 */
export class BundleSizeChecker {
  /**
   * 检查文件大小
   */
  static checkFileSize(filePath: string, size: number): {
    pass: boolean;
    budget: number;
    actual: number;
    percentage: number;
  } {
    let budget = 0;

    // 根据文件路径确定预算
    if (filePath.endsWith('.js')) {
      if (filePath.includes('vendor')) {
        budget = bundleSizebudget.assets.js.vendor;
      } else if (filePath.includes('main')) {
        budget = bundleSizebudget.assets.js.main;
      } else {
        budget = bundleSizebudget.assets.js.chunk;
      }
    } else if (filePath.endsWith('.css')) {
      if (filePath.includes('main')) {
        budget = bundleSizebudget.assets.css.main;
      } else {
        budget = bundleSizebudget.assets.css.chunk;
      }
    }

    const percentage = (size / budget) * 100;
    const pass = size <= budget;

    return {
      pass,
      budget,
      actual: size,
      percentage,
    };
  }

  /**
   * 生成优化建议
   */
  static generateOptimizationTips(results: Array<{
    file: string;
    size: number;
    pass: boolean;
  }>): string[] {
    const tips: string[] = [];

    const failedFiles = results.filter((r) => !r.pass);

    if (failedFiles.length > 0) {
      tips.push('⚠️ 以下文件超出预算:');
      failedFiles.forEach(({ file, size }) => {
        const sizeKB = (size / 1024).toFixed(2);
        tips.push(`  - ${file}: ${sizeKB}KB`);
      });

      tips.push('\n💡 优化建议:');
      tips.push('  1. 使用动态导入拆分大型组件');
      tips.push('  2. 移除未使用的依赖');
      tips.push('  3. 使用 Tree Shaking 移除死代码');
      tips.push('  4. 压缩和混淆代码');
      tips.push('  5. 使用 Code Splitting 按需加载');
    }

    return tips;
  }
}

/**
 * Webpack/Next.js 优化配置
 */
export const webpackOptimizationConfig = {
  /**
   * 代码分割配置
   */
  splitChunks: {
    chunks: 'all' as const,
    cacheGroups: {
      // React 核心库
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
        name: 'react',
        priority: 40,
        reuseExistingChunk: true,
      },
      
      // UI 库
      ui: {
        test: /[\\/]node_modules[\\/](@radix-ui|@headlessui)[\\/]/,
        name: 'ui',
        priority: 30,
        reuseExistingChunk: true,
      },
      
      // 工具库
      utils: {
        test: /[\\/]node_modules[\\/](lodash|date-fns|clsx)[\\/]/,
        name: 'utils',
        priority: 25,
        reuseExistingChunk: true,
      },
      
      // TanStack 库
      tanstack: {
        test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
        name: 'tanstack',
        priority: 20,
        reuseExistingChunk: true,
      },
      
      // 其他第三方库
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendor',
        priority: 10,
        reuseExistingChunk: true,
      },
      
      // 共享组件
      common: {
        minChunks: 2,
        priority: 5,
        reuseExistingChunk: true,
        enforce: true,
      },
    },
  },

  /**
   * 最小化配置
   */
  minimize: true,
  
  /**
   * 运行时 Chunk
   */
  runtimeChunk: {
    name: 'runtime',
  },

  /**
   * Module IDs
   */
  moduleIds: 'deterministic' as const,
  
  /**
   * Chunk IDs
   */
  chunkIds: 'deterministic' as const,
};

/**
 * Tree Shaking 配置
 */
export const treeShakingConfig = {
  /**
   * 副作用配置
   */
  sideEffects: false,
  
  /**
   * 使用 ES Modules
   */
  useESModules: true,
  
  /**
   * 标记为 pure 的模块
   */
  pureFunctions: [
    'console.log',
    'console.info',
    'console.debug',
    'console.warn',
  ],
};

/**
 * 压缩配置
 */
export const compressionConfig = {
  /**
   * Gzip 压缩
   */
  gzip: {
    enabled: true,
    threshold: 10240, // 10KB
    level: 9,
  },
  
  /**
   * Brotli 压缩
   */
  brotli: {
    enabled: true,
    threshold: 10240, // 10KB
    quality: 11,
  },
};

/**
 * Bundle 分析报告生成器
 */
export class BundleReportGenerator {
  /**
   * 生成 Markdown 报告
   */
  static generateMarkdownReport(stats: {
    totalSize: number;
    files: Array<{ name: string; size: number }>;
  }): string {
    const lines: string[] = [];

    lines.push('# Bundle 分析报告\n');
    lines.push(`生成时间: ${new Date().toLocaleString()}\n`);
    
    lines.push('## 总体统计\n');
    lines.push(`- 总大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    lines.push(`- 文件数量: ${stats.files.length}\n`);

    lines.push('## 文件列表\n');
    lines.push('| 文件名 | 大小 | 占比 |');
    lines.push('|--------|------|------|');

    const sortedFiles = [...stats.files].sort((a, b) => b.size - a.size);
    sortedFiles.forEach((file) => {
      const sizeKB = (file.size / 1024).toFixed(2);
      const percentage = ((file.size / stats.totalSize) * 100).toFixed(2);
      lines.push(`| ${file.name} | ${sizeKB} KB | ${percentage}% |`);
    });

    lines.push('\n## 优化建议\n');
    
    const largeFiles = sortedFiles.filter((f) => f.size > 100 * 1024);
    if (largeFiles.length > 0) {
      lines.push('### 大文件 (>100KB)\n');
      largeFiles.forEach((file) => {
        lines.push(`- **${file.name}** (${(file.size / 1024).toFixed(2)} KB)`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 生成 JSON 报告
   */
  static generateJSONReport(stats: unknown): string {
    return JSON.stringify(stats, null, 2);
  }
}

/**
 * 分析脚本命令
 */
export const analyzerScripts = {
  /**
   * 分析打包结果
   */
  analyze: 'ANALYZE=true npm run build',
  
  /**
   * 生成依赖图
   */
  depGraph: 'npx madge --image graph.svg src/app',
  
  /**
   * 检查重复依赖
   */
  duplicates: 'npx depcheck',
  
  /**
   * 检查未使用的导出
   */
  unusedExports: 'npx ts-prune',
};

