import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [
        react({
            // 启用 React Fast Refresh
            fastRefresh: true,
            // 启用 SWC 装饰器支持
            //plugins: [
            //  ['@swc/plugin-styled-components', {}],
            //],
        }),
    ],

    // 路径解析配置
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@/components': resolve(__dirname, 'src/components'),
            '@/pages': resolve(__dirname, 'src/pages'),
            '@/hooks': resolve(__dirname, 'src/hooks'),
            '@/utils': resolve(__dirname, 'src/utils'),
            '@/stores': resolve(__dirname, 'src/stores'),
            '@/types': resolve(__dirname, 'src/types'),
            '@/styles': resolve(__dirname, 'src/styles'),
            '@/assets': resolve(__dirname, 'src/assets'),
            '@/api': resolve(__dirname, 'src/api'),
            '@/constants': resolve(__dirname, 'src/constants'),
            '@/contexts': resolve(__dirname, 'src/contexts'),
        },
    },

    // 开发服务器配置
    server: {
        port: 1420,
        host: '0.0.0.0',
        strictPort: true,
        open: false, // Tauri 会自动打开窗口
        cors: true,
        // 代理配置（如果需要）
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
        // HMR 配置
        hmr: {
            port: 1421,
        },
    },

    // 预览服务器配置
    preview: {
        port: 1420,
        host: '0.0.0.0',
        strictPort: true,
    },

    // 构建配置
    build: {
        // 输出目录
        outDir: 'dist',
        // 静态资源目录
        assetsDir: 'assets',
        // 生成 sourcemap
        sourcemap: process.env.NODE_ENV === 'development',
        // 最小化
        minify: 'esbuild',
        // 目标浏览器
        target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
        // 构建优化
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
            output: {
                // 代码分割
                manualChunks: {
                    // React 相关
                    'react-vendor': ['react', 'react-dom'],
                    // 路由相关
                    'router-vendor': ['react-router-dom'],
                    // UI 组件库
                    'ui-vendor': [
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-dropdown-menu',
                        '@radix-ui/react-toast',
                        '@radix-ui/react-tooltip',
                        '@radix-ui/react-switch',
                        '@radix-ui/react-slider',
                        '@radix-ui/react-select',
                        '@radix-ui/react-tabs',
                        '@radix-ui/react-accordion',
                        '@radix-ui/react-progress',
                    ],
                    // 状态管理
                    'state-vendor': ['zustand', '@tanstack/react-query'],
                    // 工具库
                    'utils-vendor': ['lodash-es', 'date-fns', 'clsx', 'tailwind-merge'],
                    // 动画库
                    'animation-vendor': ['framer-motion'],
                    // Tauri API
                    'tauri-vendor': ['@tauri-apps/api'],
                },
                // 文件命名
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name?.split('.') ?? []
                    let extType = info[info.length - 1]

                    if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name ?? '')) {
                        extType = 'media'
                    } else if (/\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i.test(assetInfo.name ?? '')) {
                        extType = 'images'
                    } else if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name ?? '')) {
                        extType = 'fonts'
                    }

                    return `assets/${extType}/[name]-[hash][extname]`
                },
            },
        },
        // 资源内联阈值
        assetsInlineLimit: 4096,
        // CSS 代码分割
        cssCodeSplit: true,
        // 清空输出目录
        emptyOutDir: true,
        // 报告压缩详情
        reportCompressedSize: false,
        // chunk 大小警告限制
        chunkSizeWarningLimit: 2000,
    },

    // CSS 配置
    css: {
        // CSS 模块
        modules: {
            localsConvention: 'camelCaseOnly',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
        // PostCSS 配置将通过 postcss.config.js 文件处理
        // 开发时的 CSS sourcemap
        devSourcemap: true,
    },

    // 环境变量配置
    envPrefix: ['VITE_', 'TAURI_'],
    envDir: '.',

    // 依赖优化
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-router-dom',
            '@tanstack/react-query',
            'zustand',
            'framer-motion',
            'lucide-react',
            'clsx',
            'tailwind-merge',
            'lodash-es',
            'date-fns',
            'nanoid',
            'mitt',
        ],
        exclude: [
            '@tauri-apps/api',
            '@tauri-apps/plugin-window-state',
        ],
    },

    // 测试配置
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        css: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'src/test/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/dist/**',
            ],
        },
    },

    // 日志级别
    logLevel: 'info',

    // 清除控制台
    clearScreen: false,

    // 定义全局常量
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

    // esbuild 配置
    esbuild: {
        // 移除 console 和 debugger（生产环境）
        drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
        // 保留函数名
        keepNames: true,
    },

    // 工作线程配置
    worker: {
        format: 'es',
        plugins: [react()],
    },
}))
