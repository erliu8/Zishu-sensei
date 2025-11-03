import type { NextConfig } from 'next'
import withBundleAnalyzer from '@next/bundle-analyzer'

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env['ANALYZE'] === 'true',
})

const nextConfig: NextConfig = {
  // 输出配置
  output: 'standalone',

  // React严格模式
  reactStrictMode: true,

  // 移除X-Powered-By头
  poweredByHeader: false,

  // 压缩
  compress: true,

  // 禁用自动末尾斜杠重定向（因为 FastAPI 需要末尾斜杠）
  skipTrailingSlashRedirect: true,

  // 性能分析
  productionBrowserSourceMaps: false,

  // 编译器优化
  compiler: {
    // 移除 console.*
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // 使用 SWC 压缩器
  swcMinify: true,

  // 日志级别
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },

  // 图片优化配置
  images: {
    // 允许的图片域名
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'api.zishu.ai',
      },
      {
        protocol: 'https',
        hostname: 'cdn.zishu.ai',
      },
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
    ],
    // 图片格式
    formats: ['image/avif', 'image/webp'],
    // 图片尺寸
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 最小缓存时间（秒）
    minimumCacheTTL: 60,
  },

  // 环境变量
  env: {
    // NEXT_PUBLIC_API_URL 应该是浏览器访问的地址，默认使用 /api（通过 rewrites 代理到后端）
    NEXT_PUBLIC_API_URL:
      process.env['NEXT_PUBLIC_API_URL'] || '/api',
    NEXT_PUBLIC_WS_URL:
      process.env['NEXT_PUBLIC_WS_URL'] || 'ws://localhost:8001/ws',
  },

  // 重定向规则
  async redirects() {
    return [
      // 重定向旧路径到新路径
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
      // 注意：移除了末尾斜杠重定向规则，因为会影响API代理
      // FastAPI需要末尾斜杠，而重定向会干扰API请求
    ]
  },

  // 重写规则（API代理）
  async rewrites() {
    // 使用 BACKEND_API_URL 而不是 NEXT_PUBLIC_API_URL
    // 因为 NEXT_PUBLIC_API_URL 是给浏览器用的（值为 /api）
    const backendUrl = process.env['BACKEND_API_URL'] || 'http://localhost:8001/api/v1';
    
    return {
      // 使用 afterFiles 而不是 beforeFiles
      // 这样 Next.js 的 API Routes (/app/api/*) 会优先处理
      // 只有不存在的路由才会被代理到后端
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/:path*`,  // 不要添加末尾斜杠
        },
      ],
    }
  },

  // 安全头配置
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // XSS保护
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // 点击劫持保护
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // XSS过滤器
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer策略
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // 权限策略
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },

  // Webpack配置
  webpack: (config, { dev, isServer }) => {
    // 生产环境优化
    if (!dev && !isServer) {
      // 分离共享模块
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // React及相关库
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              name: 'react',
              priority: 20,
            },
            // UI库
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|framer-motion|lucide-react)[\\/]/,
              name: 'ui',
              priority: 15,
            },
            // 工具库
            utils: {
              test: /[\\/]node_modules[\\/](date-fns|clsx|tailwind-merge|zod)[\\/]/,
              name: 'utils',
              priority: 10,
            },
            // 数据管理
            data: {
              test: /[\\/]node_modules[\\/](@tanstack|zustand|jotai)[\\/]/,
              name: 'data',
              priority: 10,
            },
            // 其他vendor
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 5,
            },
          },
        },
      }
    }

    // SVG处理
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })

    return config
  },

  // 实验性特性
  experimental: {
    // 优化CSS
    optimizeCss: true,
    // 优化包导入
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@tanstack/react-query',
      'react-markdown',
      'rehype-highlight',
      'remark-gfm',
    ],
    // 服务器操作
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // 类型检查
  typescript: {
    // 生产构建时进行类型检查
    ignoreBuildErrors: false,
  },

  // ESLint
  eslint: {
    // 生产构建时进行lint
    ignoreDuringBuilds: false,
  },
}

export default bundleAnalyzer(nextConfig)
