// vite.config.ts
import react from "file:///opt/zishu-sensei/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve } from "path";
import { defineConfig } from "file:///data/disk/zishu-sensei/desktop_app/node_modules/vitest/dist/config.js";
var __vite_injected_original_dirname = "/opt/zishu-sensei/desktop_app";
function pixiJSFixPlugin() {
  return {
    name: "pixijs-fix",
    transformIndexHtml: {
      enforce: "pre",
      transform(html) {
        const fixScript = `
          <script>
            // PixiJS BatchRenderer \u4FEE\u590D - \u5728\u6240\u6709\u6A21\u5757\u52A0\u8F7D\u524D\u6267\u884C
            (function() {
              console.log('\u{1F527} PixiJS \u4FEE\u590D\u63D2\u4EF6\u542F\u52A8');
              
              // \u4FDD\u5B58\u539F\u59CB\u7684\u6A21\u5757\u52A0\u8F7D\u51FD\u6570
              const originalImport = window.__vitePreload || window.import;
              
              // \u4FEE\u590D\u51FD\u6570
              function fixPixiJS(pixi) {
                if (pixi && pixi.BatchRenderer && pixi.BatchRenderer.prototype.checkMaxIfStatementsInShader) {
                  const original = pixi.BatchRenderer.prototype.checkMaxIfStatementsInShader;
                  if (!original._viteFixed) {
                    pixi.BatchRenderer.prototype.checkMaxIfStatementsInShader = function(maxIfs) {
                      const safeMaxIfs = Math.max(maxIfs || 32, 32);
                      console.log('\u{1F527} PixiJS Vite\u63D2\u4EF6\u4FEE\u590D:', maxIfs, '->', safeMaxIfs);
                      return original.call(this, safeMaxIfs);
                    };
                    pixi.BatchRenderer.prototype.checkMaxIfStatementsInShader._viteFixed = true;
                    console.log('\u2705 PixiJS Vite\u63D2\u4EF6\u4FEE\u590D\u5B8C\u6210');
                    return true;
                  }
                }
                return false;
              }
              
              // \u76D1\u542C\u5168\u5C40 PIXI \u5BF9\u8C61 - \u5FEB\u901F\u4E14\u77ED\u65F6\u5C1D\u8BD5\uFF0C\u65E0\u8D85\u65F6\u566A\u58F0
              let applied = false;
              const tryApply = () => {
                if (applied) return;
                const pixi = (window.PIXI || window.__PIXI__ ||
                              (window.pixiApp && window.pixiApp.PIXI) ||
                              (document && document['PIXI']));
                if (pixi && fixPixiJS(pixi)) {
                  applied = true;
                  console.log('\u2705 PixiJS Vite\u63D2\u4EF6\u4FEE\u590D\u6210\u529F');
                }
              };
              const checkInterval = setInterval(tryApply, 10);
              setTimeout(() => { clearInterval(checkInterval); }, 3000);
              
              // \u76D1\u542C\u6A21\u5757\u52A0\u8F7D\u4E8B\u4EF6
              const originalDefine = window.define;
              const originalRequire = window.require;
              
              // \u62E6\u622A\u53EF\u80FD\u7684\u6A21\u5757\u7CFB\u7EDF
              if (typeof window !== 'undefined') {
                // \u76D1\u542C script \u6807\u7B7E\u52A0\u8F7D
                const observer = new MutationObserver((mutations) => {
                  mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                      if (node.nodeType === 1 && node.tagName === 'SCRIPT') {
                        setTimeout(() => {
                          const pixi = window.PIXI || window.__PIXI__;
                          if (pixi) {
                            fixPixiJS(pixi);
                          }
                        }, 100);
                      }
                    });
                  });
                });
                observer.observe(document, { childList: true, subtree: true });
                
                setTimeout(() => observer.disconnect(), 3000);
              }
              
              // \u76D1\u542C window \u5BF9\u8C61\u5C5E\u6027\u53D8\u5316
              let pixiPropertyAdded = false;
              Object.defineProperty(window, 'PIXI', {
                get() {
                  return window._PIXI_INTERNAL_;
                },
                set(value) {
                  window._PIXI_INTERNAL_ = value;
                  if (value && !pixiPropertyAdded) {
                    pixiPropertyAdded = true;
                    setTimeout(() => fixPixiJS(value), 0);
                  }
                },
                configurable: true
              });
            })();
          </script>
        `;
        return html.replace("<head>", "<head>" + fixScript);
      }
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => ({
  plugins: [
    pixiJSFixPlugin(),
    // PixiJS 修复插件 - 必须在 react 插件之前
    react()
  ],
  // 开发模式下禁用 TypeScript 检查以提高 HMR 性能
  ...mode === "development" && {
    esbuild: {
      // 在开发模式下跳过类型检查
      target: "es2020",
      keepNames: true,
      // 禁用 TypeScript 检查
      tsconfigRaw: {
        compilerOptions: {
          skipLibCheck: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          strict: false,
          noImplicitAny: false,
          // 完全跳过类型检查
          checkJs: false,
          allowJs: true
        }
      }
    }
  },
  // 路径解析配置
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "src"),
      "@/components": resolve(__vite_injected_original_dirname, "src/components"),
      "@/pages": resolve(__vite_injected_original_dirname, "src/pages"),
      "@/hooks": resolve(__vite_injected_original_dirname, "src/hooks"),
      "@/utils": resolve(__vite_injected_original_dirname, "src/utils"),
      "@/stores": resolve(__vite_injected_original_dirname, "src/stores"),
      "@/types": resolve(__vite_injected_original_dirname, "src/types"),
      "@/styles": resolve(__vite_injected_original_dirname, "src/styles"),
      "@/assets": resolve(__vite_injected_original_dirname, "src/assets"),
      "@/api": resolve(__vite_injected_original_dirname, "src/api"),
      "@/constants": resolve(__vite_injected_original_dirname, "src/constants"),
      "@/contexts": resolve(__vite_injected_original_dirname, "src/contexts"),
      "@/services": resolve(__vite_injected_original_dirname, "src/services")
    }
  },
  // 开发服务器配置
  server: {
    port: 1424,
    host: "0.0.0.0",
    strictPort: true,
    open: false,
    // Tauri 会自动打开窗口
    cors: true,
    // 代理配置（如果需要）
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    },
    // HMR 配置
    hmr: {
      port: 1423
    }
  },
  // 预览服务器配置
  preview: {
    port: 1424,
    host: "0.0.0.0",
    strictPort: false
  },
  // 构建配置
  build: {
    // 输出目录
    outDir: "dist",
    // 静态资源目录
    assetsDir: "assets",
    // 生成 sourcemap
    sourcemap: process.env.NODE_ENV === "development",
    // 最小化
    minify: "esbuild",
    // 目标浏览器
    target: ["chrome87", "edge88", "firefox78", "safari14"],
    // 构建优化
    rollupOptions: {
      input: {
        main: resolve(__vite_injected_original_dirname, "index.html")
      },
      output: {
        // 代码分割
        manualChunks: {
          // React 相关
          "react-vendor": ["react", "react-dom"],
          // 路由相关
          "router-vendor": ["react-router-dom"],
          // UI 组件库
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-switch",
            "@radix-ui/react-slider",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-accordion",
            "@radix-ui/react-progress"
          ],
          // 状态管理
          "state-vendor": ["zustand", "@tanstack/react-query"],
          // 工具库
          "utils-vendor": ["lodash-es", "date-fns", "clsx", "tailwind-merge"],
          // 动画库
          "animation-vendor": ["framer-motion"],
          // Tauri API
          "tauri-vendor": ["@tauri-apps/api"]
        },
        // 文件命名
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split(".") ?? [];
          let extType = info[info.length - 1];
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name ?? "")) {
            extType = "media";
          } else if (/\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i.test(assetInfo.name ?? "")) {
            extType = "images";
          } else if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name ?? "")) {
            extType = "fonts";
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        }
      }
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
    chunkSizeWarningLimit: 2e3
  },
  // CSS 配置
  css: {
    // CSS 模块
    modules: {
      localsConvention: "camelCaseOnly",
      generateScopedName: "[name]__[local]___[hash:base64:5]"
    },
    // PostCSS 配置将通过 postcss.config.js 文件处理
    // 开发时的 CSS sourcemap
    devSourcemap: true
  },
  // 环境变量配置
  envPrefix: ["VITE_", "TAURI_"],
  envDir: ".",
  // 依赖优化
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "zustand",
      "framer-motion",
      "lucide-react",
      "clsx",
      "tailwind-merge",
      "lodash-es",
      "date-fns",
      "nanoid",
      "mitt"
    ],
    exclude: [
      "@tauri-apps/api",
      "@tauri-apps/plugin-window-state"
    ]
  },
  // 测试配置
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**"
      ]
    }
  },
  // 日志级别
  logLevel: "info",
  // 清除控制台
  clearScreen: false,
  // 定义全局常量
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify((/* @__PURE__ */ new Date()).toISOString())
  },
  // esbuild 配置 - 生产环境专用
  ...mode === "production" && {
    esbuild: {
      // 移除 console 和 debugger（生产环境）
      drop: ["console", "debugger"],
      // 保留函数名
      keepNames: true
    }
  },
  // 工作线程配置
  worker: {
    format: "es",
    plugins: () => [react()]
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvb3B0L3ppc2h1LXNlbnNlaS9kZXNrdG9wX2FwcFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL29wdC96aXNodS1zZW5zZWkvZGVza3RvcF9hcHAvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL29wdC96aXNodS1zZW5zZWkvZGVza3RvcF9hcHAvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGVzdC9jb25maWcnXG5pbXBvcnQgdHlwZSB7IFBsdWdpbiB9IGZyb20gJ3ZpdGUnXG5cbi8vIFBpeGlKUyBCYXRjaFJlbmRlcmVyIFx1NEZFRVx1NTkwRFx1NjNEMlx1NEVGNlxuZnVuY3Rpb24gcGl4aUpTRml4UGx1Z2luKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ3BpeGlqcy1maXgnLFxuICAgIHRyYW5zZm9ybUluZGV4SHRtbDoge1xuICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICB0cmFuc2Zvcm0oaHRtbDogc3RyaW5nKSB7XG4gICAgICAgIC8vIFx1NTcyOCBIVE1MIFx1NEUyRFx1NkNFOFx1NTE2NVx1NEZFRVx1NTkwRFx1ODExQVx1NjcyQ1xuICAgICAgICBjb25zdCBmaXhTY3JpcHQgPSBgXG4gICAgICAgICAgPHNjcmlwdD5cbiAgICAgICAgICAgIC8vIFBpeGlKUyBCYXRjaFJlbmRlcmVyIFx1NEZFRVx1NTkwRCAtIFx1NTcyOFx1NjI0MFx1NjcwOVx1NkEyMVx1NTc1N1x1NTJBMFx1OEY3RFx1NTI0RFx1NjI2N1x1ODg0Q1xuICAgICAgICAgICAgKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnXHVEODNEXHVERDI3IFBpeGlKUyBcdTRGRUVcdTU5MERcdTYzRDJcdTRFRjZcdTU0MkZcdTUyQTgnKTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIFx1NEZERFx1NUI1OFx1NTM5Rlx1NTlDQlx1NzY4NFx1NkEyMVx1NTc1N1x1NTJBMFx1OEY3RFx1NTFGRFx1NjU3MFxuICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbEltcG9ydCA9IHdpbmRvdy5fX3ZpdGVQcmVsb2FkIHx8IHdpbmRvdy5pbXBvcnQ7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBcdTRGRUVcdTU5MERcdTUxRkRcdTY1NzBcbiAgICAgICAgICAgICAgZnVuY3Rpb24gZml4UGl4aUpTKHBpeGkpIHtcbiAgICAgICAgICAgICAgICBpZiAocGl4aSAmJiBwaXhpLkJhdGNoUmVuZGVyZXIgJiYgcGl4aS5CYXRjaFJlbmRlcmVyLnByb3RvdHlwZS5jaGVja01heElmU3RhdGVtZW50c0luU2hhZGVyKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbCA9IHBpeGkuQmF0Y2hSZW5kZXJlci5wcm90b3R5cGUuY2hlY2tNYXhJZlN0YXRlbWVudHNJblNoYWRlcjtcbiAgICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWwuX3ZpdGVGaXhlZCkge1xuICAgICAgICAgICAgICAgICAgICBwaXhpLkJhdGNoUmVuZGVyZXIucHJvdG90eXBlLmNoZWNrTWF4SWZTdGF0ZW1lbnRzSW5TaGFkZXIgPSBmdW5jdGlvbihtYXhJZnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzYWZlTWF4SWZzID0gTWF0aC5tYXgobWF4SWZzIHx8IDMyLCAzMik7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1x1RDgzRFx1REQyNyBQaXhpSlMgVml0ZVx1NjNEMlx1NEVGNlx1NEZFRVx1NTkwRDonLCBtYXhJZnMsICctPicsIHNhZmVNYXhJZnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvcmlnaW5hbC5jYWxsKHRoaXMsIHNhZmVNYXhJZnMpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBwaXhpLkJhdGNoUmVuZGVyZXIucHJvdG90eXBlLmNoZWNrTWF4SWZTdGF0ZW1lbnRzSW5TaGFkZXIuX3ZpdGVGaXhlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgUGl4aUpTIFZpdGVcdTYzRDJcdTRFRjZcdTRGRUVcdTU5MERcdTVCOENcdTYyMTAnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgLy8gXHU3NkQxXHU1NDJDXHU1MTY4XHU1QzQwIFBJWEkgXHU1QkY5XHU4QzYxIC0gXHU1RkVCXHU5MDFGXHU0RTE0XHU3N0VEXHU2NUY2XHU1QzFEXHU4QkQ1XHVGRjBDXHU2NUUwXHU4RDg1XHU2NUY2XHU1NjZBXHU1OEYwXG4gICAgICAgICAgICAgIGxldCBhcHBsaWVkID0gZmFsc2U7XG4gICAgICAgICAgICAgIGNvbnN0IHRyeUFwcGx5ID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChhcHBsaWVkKSByZXR1cm47XG4gICAgICAgICAgICAgICAgY29uc3QgcGl4aSA9ICh3aW5kb3cuUElYSSB8fCB3aW5kb3cuX19QSVhJX18gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICh3aW5kb3cucGl4aUFwcCAmJiB3aW5kb3cucGl4aUFwcC5QSVhJKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRvY3VtZW50ICYmIGRvY3VtZW50WydQSVhJJ10pKTtcbiAgICAgICAgICAgICAgICBpZiAocGl4aSAmJiBmaXhQaXhpSlMocGl4aSkpIHtcbiAgICAgICAgICAgICAgICAgIGFwcGxpZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1x1MjcwNSBQaXhpSlMgVml0ZVx1NjNEMlx1NEVGNlx1NEZFRVx1NTkwRFx1NjIxMFx1NTI5RicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgY29uc3QgY2hlY2tJbnRlcnZhbCA9IHNldEludGVydmFsKHRyeUFwcGx5LCAxMCk7XG4gICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyBjbGVhckludGVydmFsKGNoZWNrSW50ZXJ2YWwpOyB9LCAzMDAwKTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIFx1NzZEMVx1NTQyQ1x1NkEyMVx1NTc1N1x1NTJBMFx1OEY3RFx1NEU4Qlx1NEVGNlxuICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbERlZmluZSA9IHdpbmRvdy5kZWZpbmU7XG4gICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsUmVxdWlyZSA9IHdpbmRvdy5yZXF1aXJlO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgLy8gXHU2MkU2XHU2MjJBXHU1M0VGXHU4MEZEXHU3Njg0XHU2QTIxXHU1NzU3XHU3Q0ZCXHU3RURGXG4gICAgICAgICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIC8vIFx1NzZEMVx1NTQyQyBzY3JpcHQgXHU2ODA3XHU3QjdFXHU1MkEwXHU4RjdEXG4gICAgICAgICAgICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB7XG4gICAgICAgICAgICAgICAgICBtdXRhdGlvbnMuZm9yRWFjaCgobXV0YXRpb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbXV0YXRpb24uYWRkZWROb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDEgJiYgbm9kZS50YWdOYW1lID09PSAnU0NSSVBUJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBpeGkgPSB3aW5kb3cuUElYSSB8fCB3aW5kb3cuX19QSVhJX187XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwaXhpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZml4UGl4aUpTKHBpeGkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAxMDApO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IG9ic2VydmVyLmRpc2Nvbm5lY3QoKSwgMzAwMCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIFx1NzZEMVx1NTQyQyB3aW5kb3cgXHU1QkY5XHU4QzYxXHU1QzVFXHU2MDI3XHU1M0Q4XHU1MzE2XG4gICAgICAgICAgICAgIGxldCBwaXhpUHJvcGVydHlBZGRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LCAnUElYSScsIHtcbiAgICAgICAgICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gd2luZG93Ll9QSVhJX0lOVEVSTkFMXztcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldCh2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgd2luZG93Ll9QSVhJX0lOVEVSTkFMXyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICYmICFwaXhpUHJvcGVydHlBZGRlZCkge1xuICAgICAgICAgICAgICAgICAgICBwaXhpUHJvcGVydHlBZGRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gZml4UGl4aUpTKHZhbHVlKSwgMCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KSgpO1xuICAgICAgICAgIDwvc2NyaXB0PlxuICAgICAgICBgO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIGh0bWwucmVwbGFjZSgnPGhlYWQ+JywgJzxoZWFkPicgKyBmaXhTY3JpcHQpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gICAgcGx1Z2luczogW1xuICAgICAgICBwaXhpSlNGaXhQbHVnaW4oKSwgLy8gUGl4aUpTIFx1NEZFRVx1NTkwRFx1NjNEMlx1NEVGNiAtIFx1NUZDNVx1OTg3Qlx1NTcyOCByZWFjdCBcdTYzRDJcdTRFRjZcdTRFNEJcdTUyNERcbiAgICAgICAgcmVhY3QoKSxcbiAgICBdLFxuICAgIFxuICAgIC8vIFx1NUYwMFx1NTNEMVx1NkEyMVx1NUYwRlx1NEUwQlx1Nzk4MVx1NzUyOCBUeXBlU2NyaXB0IFx1NjhDMFx1NjdFNVx1NEVFNVx1NjNEMFx1OUFEOCBITVIgXHU2MDI3XHU4MEZEXG4gICAgLi4uKG1vZGUgPT09ICdkZXZlbG9wbWVudCcgJiYge1xuICAgICAgICBlc2J1aWxkOiB7XG4gICAgICAgICAgICAvLyBcdTU3MjhcdTVGMDBcdTUzRDFcdTZBMjFcdTVGMEZcdTRFMEJcdThERjNcdThGQzdcdTdDN0JcdTU3OEJcdTY4QzBcdTY3RTVcbiAgICAgICAgICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gICAgICAgICAgICBrZWVwTmFtZXM6IHRydWUsXG4gICAgICAgICAgICAvLyBcdTc5ODFcdTc1MjggVHlwZVNjcmlwdCBcdTY4QzBcdTY3RTVcbiAgICAgICAgICAgIHRzY29uZmlnUmF3OiB7XG4gICAgICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgIHNraXBMaWJDaGVjazogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgbm9VbnVzZWRMb2NhbHM6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBub1VudXNlZFBhcmFtZXRlcnM6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBzdHJpY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBub0ltcGxpY2l0QW55OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgLy8gXHU1QjhDXHU1MTY4XHU4REYzXHU4RkM3XHU3QzdCXHU1NzhCXHU2OEMwXHU2N0U1XG4gICAgICAgICAgICAgICAgICAgIGNoZWNrSnM6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBhbGxvd0pzOiB0cnVlLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pLFxuXG4gICAgLy8gXHU4REVGXHU1Rjg0XHU4OUUzXHU2NzkwXHU5MTREXHU3RjZFXG4gICAgcmVzb2x2ZToge1xuICAgICAgICBhbGlhczoge1xuICAgICAgICAgICAgJ0AnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYycpLFxuICAgICAgICAgICAgJ0AvY29tcG9uZW50cyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2NvbXBvbmVudHMnKSxcbiAgICAgICAgICAgICdAL3BhZ2VzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvcGFnZXMnKSxcbiAgICAgICAgICAgICdAL2hvb2tzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvaG9va3MnKSxcbiAgICAgICAgICAgICdAL3V0aWxzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvdXRpbHMnKSxcbiAgICAgICAgICAgICdAL3N0b3Jlcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL3N0b3JlcycpLFxuICAgICAgICAgICAgJ0AvdHlwZXMnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy90eXBlcycpLFxuICAgICAgICAgICAgJ0Avc3R5bGVzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvc3R5bGVzJyksXG4gICAgICAgICAgICAnQC9hc3NldHMnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9hc3NldHMnKSxcbiAgICAgICAgICAgICdAL2FwaSc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2FwaScpLFxuICAgICAgICAgICAgJ0AvY29uc3RhbnRzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvY29uc3RhbnRzJyksXG4gICAgICAgICAgICAnQC9jb250ZXh0cyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2NvbnRleHRzJyksXG4gICAgICAgICAgICAnQC9zZXJ2aWNlcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL3NlcnZpY2VzJyksXG4gICAgICAgIH0sXG4gICAgfSxcblxuICAgIC8vIFx1NUYwMFx1NTNEMVx1NjcwRFx1NTJBMVx1NTY2OFx1OTE0RFx1N0Y2RVxuICAgIHNlcnZlcjoge1xuICAgICAgICBwb3J0OiAxNDI0LFxuICAgICAgICBob3N0OiAnMC4wLjAuMCcsXG4gICAgICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgICAgIG9wZW46IGZhbHNlLCAvLyBUYXVyaSBcdTRGMUFcdTgxRUFcdTUyQThcdTYyNTNcdTVGMDBcdTdBOTdcdTUzRTNcbiAgICAgICAgY29yczogdHJ1ZSxcbiAgICAgICAgLy8gXHU0RUUzXHU3NDA2XHU5MTREXHU3RjZFXHVGRjA4XHU1OTgyXHU2NzlDXHU5NzAwXHU4OTgxXHVGRjA5XG4gICAgICAgIHByb3h5OiB7XG4gICAgICAgICAgICAnL2FwaSc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICByZXdyaXRlOiAocGF0aDogc3RyaW5nKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGkvLCAnJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAvLyBITVIgXHU5MTREXHU3RjZFXG4gICAgICAgIGhtcjoge1xuICAgICAgICAgICAgcG9ydDogMTQyMyxcbiAgICAgICAgfSxcbiAgICB9LFxuXG4gICAgLy8gXHU5ODg0XHU4OUM4XHU2NzBEXHU1MkExXHU1NjY4XHU5MTREXHU3RjZFXG4gICAgcHJldmlldzoge1xuICAgICAgICBwb3J0OiAxNDI0LFxuICAgICAgICBob3N0OiAnMC4wLjAuMCcsXG4gICAgICAgIHN0cmljdFBvcnQ6IGZhbHNlLFxuICAgIH0sXG5cbiAgICAvLyBcdTY3ODRcdTVFRkFcdTkxNERcdTdGNkVcbiAgICBidWlsZDoge1xuICAgICAgICAvLyBcdThGOTNcdTUxRkFcdTc2RUVcdTVGNTVcbiAgICAgICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgICAgIC8vIFx1OTc1OVx1NjAwMVx1OEQ0NFx1NkU5MFx1NzZFRVx1NUY1NVxuICAgICAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxuICAgICAgICAvLyBcdTc1MUZcdTYyMTAgc291cmNlbWFwXG4gICAgICAgIHNvdXJjZW1hcDogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcsXG4gICAgICAgIC8vIFx1NjcwMFx1NUMwRlx1NTMxNlxuICAgICAgICBtaW5pZnk6ICdlc2J1aWxkJyxcbiAgICAgICAgLy8gXHU3NkVFXHU2ODA3XHU2RDRGXHU4OUM4XHU1NjY4XG4gICAgICAgIHRhcmdldDogWydjaHJvbWU4NycsICdlZGdlODgnLCAnZmlyZWZveDc4JywgJ3NhZmFyaTE0J10sXG4gICAgICAgIC8vIFx1Njc4NFx1NUVGQVx1NEYxOFx1NTMxNlxuICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgICAgIG1haW46IHJlc29sdmUoX19kaXJuYW1lLCAnaW5kZXguaHRtbCcpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG91dHB1dDoge1xuICAgICAgICAgICAgICAgIC8vIFx1NEVFM1x1NzgwMVx1NTIwNlx1NTI3MlxuICAgICAgICAgICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICAgICAgICAgICAvLyBSZWFjdCBcdTc2RjhcdTUxNzNcbiAgICAgICAgICAgICAgICAgICAgJ3JlYWN0LXZlbmRvcic6IFsncmVhY3QnLCAncmVhY3QtZG9tJ10sXG4gICAgICAgICAgICAgICAgICAgIC8vIFx1OERFRlx1NzUzMVx1NzZGOFx1NTE3M1xuICAgICAgICAgICAgICAgICAgICAncm91dGVyLXZlbmRvcic6IFsncmVhY3Qtcm91dGVyLWRvbSddLFxuICAgICAgICAgICAgICAgICAgICAvLyBVSSBcdTdFQzRcdTRFRjZcdTVFOTNcbiAgICAgICAgICAgICAgICAgICAgJ3VpLXZlbmRvcic6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtZGlhbG9nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudScsXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXRvYXN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9vbHRpcCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXN3aXRjaCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXNsaWRlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXNlbGVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXRhYnMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1hY2NvcmRpb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1wcm9ncmVzcycsXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIC8vIFx1NzJCNlx1NjAwMVx1N0JBMVx1NzQwNlxuICAgICAgICAgICAgICAgICAgICAnc3RhdGUtdmVuZG9yJzogWyd6dXN0YW5kJywgJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSddLFxuICAgICAgICAgICAgICAgICAgICAvLyBcdTVERTVcdTUxNzdcdTVFOTNcbiAgICAgICAgICAgICAgICAgICAgJ3V0aWxzLXZlbmRvcic6IFsnbG9kYXNoLWVzJywgJ2RhdGUtZm5zJywgJ2Nsc3gnLCAndGFpbHdpbmQtbWVyZ2UnXSxcbiAgICAgICAgICAgICAgICAgICAgLy8gXHU1MkE4XHU3NTNCXHU1RTkzXG4gICAgICAgICAgICAgICAgICAgICdhbmltYXRpb24tdmVuZG9yJzogWydmcmFtZXItbW90aW9uJ10sXG4gICAgICAgICAgICAgICAgICAgIC8vIFRhdXJpIEFQSVxuICAgICAgICAgICAgICAgICAgICAndGF1cmktdmVuZG9yJzogWydAdGF1cmktYXBwcy9hcGknXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIC8vIFx1NjU4N1x1NEVGNlx1NTQ3RFx1NTQwRFxuICAgICAgICAgICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL2pzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICAgICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnYXNzZXRzL2pzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICAgICAgICAgIGFzc2V0RmlsZU5hbWVzOiAoYXNzZXRJbmZvOiB7IG5hbWU/OiBzdHJpbmcgfSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gYXNzZXRJbmZvLm5hbWU/LnNwbGl0KCcuJykgPz8gW11cbiAgICAgICAgICAgICAgICAgICAgbGV0IGV4dFR5cGUgPSBpbmZvW2luZm8ubGVuZ3RoIC0gMV1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoL1xcLihtcDR8d2VibXxvZ2d8bXAzfHdhdnxmbGFjfGFhYykoXFw/LiopPyQvaS50ZXN0KGFzc2V0SW5mby5uYW1lID8/ICcnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXh0VHlwZSA9ICdtZWRpYSdcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICgvXFwuKHBuZ3xqcGU/Z3xnaWZ8c3ZnfHdlYnB8YXZpZikoXFw/LiopPyQvaS50ZXN0KGFzc2V0SW5mby5uYW1lID8/ICcnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXh0VHlwZSA9ICdpbWFnZXMnXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoL1xcLih3b2ZmMj98ZW90fHR0ZnxvdGYpKFxcPy4qKT8kL2kudGVzdChhc3NldEluZm8ubmFtZSA/PyAnJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4dFR5cGUgPSAnZm9udHMnXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYGFzc2V0cy8ke2V4dFR5cGV9L1tuYW1lXS1baGFzaF1bZXh0bmFtZV1gXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC8vIFx1OEQ0NFx1NkU5MFx1NTE4NVx1ODA1NFx1OTYwOFx1NTAzQ1xuICAgICAgICBhc3NldHNJbmxpbmVMaW1pdDogNDA5NixcbiAgICAgICAgLy8gQ1NTIFx1NEVFM1x1NzgwMVx1NTIwNlx1NTI3MlxuICAgICAgICBjc3NDb2RlU3BsaXQ6IHRydWUsXG4gICAgICAgIC8vIFx1NkUwNVx1N0E3QVx1OEY5M1x1NTFGQVx1NzZFRVx1NUY1NVxuICAgICAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICAgICAgLy8gXHU2MkE1XHU1NDRBXHU1MzhCXHU3RjI5XHU4QkU2XHU2MEM1XG4gICAgICAgIHJlcG9ydENvbXByZXNzZWRTaXplOiBmYWxzZSxcbiAgICAgICAgLy8gY2h1bmsgXHU1OTI3XHU1QzBGXHU4QjY2XHU1NDRBXHU5NjUwXHU1MjM2XG4gICAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMjAwMCxcbiAgICB9LFxuXG4gICAgLy8gQ1NTIFx1OTE0RFx1N0Y2RVxuICAgIGNzczoge1xuICAgICAgICAvLyBDU1MgXHU2QTIxXHU1NzU3XG4gICAgICAgIG1vZHVsZXM6IHtcbiAgICAgICAgICAgIGxvY2Fsc0NvbnZlbnRpb246ICdjYW1lbENhc2VPbmx5JyxcbiAgICAgICAgICAgIGdlbmVyYXRlU2NvcGVkTmFtZTogJ1tuYW1lXV9fW2xvY2FsXV9fX1toYXNoOmJhc2U2NDo1XScsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIFBvc3RDU1MgXHU5MTREXHU3RjZFXHU1QzA2XHU5MDFBXHU4RkM3IHBvc3Rjc3MuY29uZmlnLmpzIFx1NjU4N1x1NEVGNlx1NTkwNFx1NzQwNlxuICAgICAgICAvLyBcdTVGMDBcdTUzRDFcdTY1RjZcdTc2ODQgQ1NTIHNvdXJjZW1hcFxuICAgICAgICBkZXZTb3VyY2VtYXA6IHRydWUsXG4gICAgfSxcblxuICAgIC8vIFx1NzNBRlx1NTg4M1x1NTNEOFx1OTFDRlx1OTE0RFx1N0Y2RVxuICAgIGVudlByZWZpeDogWydWSVRFXycsICdUQVVSSV8nXSxcbiAgICBlbnZEaXI6ICcuJyxcblxuICAgIC8vIFx1NEY5RFx1OEQ1Nlx1NEYxOFx1NTMxNlxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgICBpbmNsdWRlOiBbXG4gICAgICAgICAgICAncmVhY3QnLFxuICAgICAgICAgICAgJ3JlYWN0LWRvbScsXG4gICAgICAgICAgICAncmVhY3Qtcm91dGVyLWRvbScsXG4gICAgICAgICAgICAnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5JyxcbiAgICAgICAgICAgICd6dXN0YW5kJyxcbiAgICAgICAgICAgICdmcmFtZXItbW90aW9uJyxcbiAgICAgICAgICAgICdsdWNpZGUtcmVhY3QnLFxuICAgICAgICAgICAgJ2Nsc3gnLFxuICAgICAgICAgICAgJ3RhaWx3aW5kLW1lcmdlJyxcbiAgICAgICAgICAgICdsb2Rhc2gtZXMnLFxuICAgICAgICAgICAgJ2RhdGUtZm5zJyxcbiAgICAgICAgICAgICduYW5vaWQnLFxuICAgICAgICAgICAgJ21pdHQnLFxuICAgICAgICBdLFxuICAgICAgICBleGNsdWRlOiBbXG4gICAgICAgICAgICAnQHRhdXJpLWFwcHMvYXBpJyxcbiAgICAgICAgICAgICdAdGF1cmktYXBwcy9wbHVnaW4td2luZG93LXN0YXRlJyxcbiAgICAgICAgXSxcbiAgICB9LFxuXG4gICAgLy8gXHU2RDRCXHU4QkQ1XHU5MTREXHU3RjZFXG4gICAgdGVzdDoge1xuICAgICAgICBnbG9iYWxzOiB0cnVlLFxuICAgICAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICAgICAgc2V0dXBGaWxlczogWycuL3NyYy90ZXN0L3NldHVwLnRzJ10sXG4gICAgICAgIGNzczogdHJ1ZSxcbiAgICAgICAgY292ZXJhZ2U6IHtcbiAgICAgICAgICAgIHByb3ZpZGVyOiAndjgnLFxuICAgICAgICAgICAgcmVwb3J0ZXI6IFsndGV4dCcsICdqc29uJywgJ2h0bWwnXSxcbiAgICAgICAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgICAgICAgICAnbm9kZV9tb2R1bGVzLycsXG4gICAgICAgICAgICAgICAgJ3NyYy90ZXN0LycsXG4gICAgICAgICAgICAgICAgJyoqLyouZC50cycsXG4gICAgICAgICAgICAgICAgJyoqLyouY29uZmlnLionLFxuICAgICAgICAgICAgICAgICcqKi9kaXN0LyoqJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgfSxcblxuICAgIC8vIFx1NjVFNVx1NUZEN1x1N0VBN1x1NTIyQlxuICAgIGxvZ0xldmVsOiAnaW5mbycsXG5cbiAgICAvLyBcdTZFMDVcdTk2NjRcdTYzQTdcdTUyMzZcdTUzRjBcbiAgICBjbGVhclNjcmVlbjogZmFsc2UsXG5cbiAgICAvLyBcdTVCOUFcdTRFNDlcdTUxNjhcdTVDNDBcdTVFMzhcdTkxQ0ZcbiAgICBkZWZpbmU6IHtcbiAgICAgICAgX19BUFBfVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShwcm9jZXNzLmVudi5ucG1fcGFja2FnZV92ZXJzaW9uKSxcbiAgICAgICAgX19CVUlMRF9USU1FX186IEpTT04uc3RyaW5naWZ5KG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSksXG4gICAgfSxcblxuICAgIC8vIGVzYnVpbGQgXHU5MTREXHU3RjZFIC0gXHU3NTFGXHU0RUE3XHU3M0FGXHU1ODgzXHU0RTEzXHU3NTI4XG4gICAgLi4uKG1vZGUgPT09ICdwcm9kdWN0aW9uJyAmJiB7XG4gICAgICAgIGVzYnVpbGQ6IHtcbiAgICAgICAgICAgIC8vIFx1NzlGQlx1OTY2NCBjb25zb2xlIFx1NTQ4QyBkZWJ1Z2dlclx1RkYwOFx1NzUxRlx1NEVBN1x1NzNBRlx1NTg4M1x1RkYwOVxuICAgICAgICAgICAgZHJvcDogWydjb25zb2xlJywgJ2RlYnVnZ2VyJ10sXG4gICAgICAgICAgICAvLyBcdTRGRERcdTc1NTlcdTUxRkRcdTY1NzBcdTU0MERcbiAgICAgICAgICAgIGtlZXBOYW1lczogdHJ1ZSxcbiAgICAgICAgfVxuICAgIH0pLFxuXG4gICAgLy8gXHU1REU1XHU0RjVDXHU3RUJGXHU3QTBCXHU5MTREXHU3RjZFXG4gICAgd29ya2VyOiB7XG4gICAgICAgIGZvcm1h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
