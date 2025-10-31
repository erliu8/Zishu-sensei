// vitest.config.ts
import { defineConfig } from "file:///data/disk/zishu-sensei/desktop_app/node_modules/vitest/dist/config.js";
import react from "file:///data/disk/zishu-sensei/desktop_app/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "/opt/zishu-sensei/desktop_app";
var vitest_config_default = defineConfig({
  plugins: [react()],
  test: {
    // 测试环境
    environment: "jsdom",
    // 全局测试设置
    globals: true,
    // 测试覆盖率配置
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/__tests__/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/types/**",
        "src/**/*.d.ts",
        "src/examples/**",
        "src/tests/**"
      ],
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    // 测试文件匹配模式
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}"
    ],
    // 排除的文件
    exclude: [
      "node_modules",
      "dist",
      "build",
      ".idea",
      ".git",
      ".cache"
    ],
    // 设置文件
    setupFiles: ["./src/tests/setup.ts"],
    // 测试超时时间
    testTimeout: 1e4,
    // Hook 超时时间
    hookTimeout: 1e4,
    // 是否在测试结束后清理 mock
    clearMocks: true,
    // 是否在每个测试前重置 mock
    mockReset: false,
    // 是否在每个测试前恢复 mock
    restoreMocks: false,
    // 测试隔离
    isolate: false,
    // 监视模式配置
    watch: false,
    // 报告器
    reporters: ["default", "verbose"],
    // 别名
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@components": path.resolve(__vite_injected_original_dirname, "./src/components"),
      "@hooks": path.resolve(__vite_injected_original_dirname, "./src/hooks"),
      "@services": path.resolve(__vite_injected_original_dirname, "./src/services"),
      "@stores": path.resolve(__vite_injected_original_dirname, "./src/stores"),
      "@utils": path.resolve(__vite_injected_original_dirname, "./src/utils"),
      "@types": path.resolve(__vite_injected_original_dirname, "./src/types"),
      "@styles": path.resolve(__vite_injected_original_dirname, "./src/styles"),
      "@assets": path.resolve(__vite_injected_original_dirname, "./src/assets"),
      "@tauri-apps/api/tauri": path.resolve(__vite_injected_original_dirname, "./src/tests/mocks/tauri-api.ts"),
      "@tauri-apps/api/core": path.resolve(__vite_injected_original_dirname, "./src/tests/mocks/tauri-api.ts")
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@components": path.resolve(__vite_injected_original_dirname, "./src/components"),
      "@hooks": path.resolve(__vite_injected_original_dirname, "./src/hooks"),
      "@services": path.resolve(__vite_injected_original_dirname, "./src/services"),
      "@stores": path.resolve(__vite_injected_original_dirname, "./src/stores"),
      "@utils": path.resolve(__vite_injected_original_dirname, "./src/utils"),
      "@types": path.resolve(__vite_injected_original_dirname, "./src/types"),
      "@styles": path.resolve(__vite_injected_original_dirname, "./src/styles"),
      "@assets": path.resolve(__vite_injected_original_dirname, "./src/assets"),
      "@tauri-apps/api/tauri": path.resolve(__vite_injected_original_dirname, "./src/tests/mocks/tauri-api.ts"),
      "@tauri-apps/api/core": path.resolve(__vite_injected_original_dirname, "./src/tests/mocks/tauri-api.ts")
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9vcHQvemlzaHUtc2Vuc2VpL2Rlc2t0b3BfYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvb3B0L3ppc2h1LXNlbnNlaS9kZXNrdG9wX2FwcC92aXRlc3QuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9vcHQvemlzaHUtc2Vuc2VpL2Rlc2t0b3BfYXBwL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2MnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgXG4gIHRlc3Q6IHtcbiAgICAvLyBcdTZENEJcdThCRDVcdTczQUZcdTU4ODNcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBcbiAgICAvLyBcdTUxNjhcdTVDNDBcdTZENEJcdThCRDVcdThCQkVcdTdGNkVcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIFxuICAgIC8vIFx1NkQ0Qlx1OEJENVx1ODk4Nlx1NzZENlx1NzM4N1x1OTE0RFx1N0Y2RVxuICAgIGNvdmVyYWdlOiB7XG4gICAgICBwcm92aWRlcjogJ3Y4JyxcbiAgICAgIHJlcG9ydGVyOiBbJ3RleHQnLCAnanNvbicsICdodG1sJywgJ2xjb3YnXSxcbiAgICAgIGluY2x1ZGU6IFsnc3JjLyoqLyoue3RzLHRzeH0nXSxcbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgJ3NyYy8qKi8qLnRlc3Que3RzLHRzeH0nLFxuICAgICAgICAnc3JjLyoqLyouc3BlYy57dHMsdHN4fScsXG4gICAgICAgICdzcmMvKiovX190ZXN0c19fLyoqJyxcbiAgICAgICAgJ3NyYy9tYWluLnRzeCcsXG4gICAgICAgICdzcmMvdml0ZS1lbnYuZC50cycsXG4gICAgICAgICdzcmMvdHlwZXMvKionLFxuICAgICAgICAnc3JjLyoqLyouZC50cycsXG4gICAgICAgICdzcmMvZXhhbXBsZXMvKionLFxuICAgICAgICAnc3JjL3Rlc3RzLyoqJyxcbiAgICAgIF0sXG4gICAgICBhbGw6IHRydWUsXG4gICAgICB0aHJlc2hvbGRzOiB7XG4gICAgICAgIGxpbmVzOiA4MCxcbiAgICAgICAgZnVuY3Rpb25zOiA4MCxcbiAgICAgICAgYnJhbmNoZXM6IDgwLFxuICAgICAgICBzdGF0ZW1lbnRzOiA4MCxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBcbiAgICAvLyBcdTZENEJcdThCRDVcdTY1ODdcdTRFRjZcdTUzMzlcdTkxNERcdTZBMjFcdTVGMEZcbiAgICBpbmNsdWRlOiBbXG4gICAgICAnc3JjLyoqLyoue3Rlc3Qsc3BlY30ue3RzLHRzeH0nLFxuICAgICAgJ3Rlc3RzLyoqLyoue3Rlc3Qsc3BlY30ue3RzLHRzeH0nLFxuICAgIF0sXG4gICAgXG4gICAgLy8gXHU2MzkyXHU5NjY0XHU3Njg0XHU2NTg3XHU0RUY2XG4gICAgZXhjbHVkZTogW1xuICAgICAgJ25vZGVfbW9kdWxlcycsXG4gICAgICAnZGlzdCcsXG4gICAgICAnYnVpbGQnLFxuICAgICAgJy5pZGVhJyxcbiAgICAgICcuZ2l0JyxcbiAgICAgICcuY2FjaGUnLFxuICAgIF0sXG4gICAgXG4gICAgLy8gXHU4QkJFXHU3RjZFXHU2NTg3XHU0RUY2XG4gICAgc2V0dXBGaWxlczogWycuL3NyYy90ZXN0cy9zZXR1cC50cyddLFxuICAgIFxuICAgIC8vIFx1NkQ0Qlx1OEJENVx1OEQ4NVx1NjVGNlx1NjVGNlx1OTVGNFxuICAgIHRlc3RUaW1lb3V0OiAxMDAwMCxcbiAgICBcbiAgICAvLyBIb29rIFx1OEQ4NVx1NjVGNlx1NjVGNlx1OTVGNFxuICAgIGhvb2tUaW1lb3V0OiAxMDAwMCxcbiAgICBcbiAgICAvLyBcdTY2MkZcdTU0MjZcdTU3MjhcdTZENEJcdThCRDVcdTdFRDNcdTY3NUZcdTU0MEVcdTZFMDVcdTc0MDYgbW9ja1xuICAgIGNsZWFyTW9ja3M6IHRydWUsXG4gICAgXG4gICAgLy8gXHU2NjJGXHU1NDI2XHU1NzI4XHU2QkNGXHU0RTJBXHU2RDRCXHU4QkQ1XHU1MjREXHU5MUNEXHU3RjZFIG1vY2tcbiAgICBtb2NrUmVzZXQ6IGZhbHNlLFxuICAgIFxuICAgIC8vIFx1NjYyRlx1NTQyNlx1NTcyOFx1NkJDRlx1NEUyQVx1NkQ0Qlx1OEJENVx1NTI0RFx1NjA2Mlx1NTkwRCBtb2NrXG4gICAgcmVzdG9yZU1vY2tzOiBmYWxzZSxcbiAgICBcbiAgICAvLyBcdTZENEJcdThCRDVcdTk2OTRcdTc5QkJcbiAgICBpc29sYXRlOiBmYWxzZSxcbiAgICBcbiAgICAvLyBcdTc2RDFcdTg5QzZcdTZBMjFcdTVGMEZcdTkxNERcdTdGNkVcbiAgICB3YXRjaDogZmFsc2UsXG4gICAgXG4gICAgLy8gXHU2MkE1XHU1NDRBXHU1NjY4XG4gICAgcmVwb3J0ZXJzOiBbJ2RlZmF1bHQnLCAndmVyYm9zZSddLFxuICAgIFxuICAgIC8vIFx1NTIyQlx1NTQwRFxuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgJ0Bjb21wb25lbnRzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL2NvbXBvbmVudHMnKSxcbiAgICAgICdAaG9va3MnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvaG9va3MnKSxcbiAgICAgICdAc2VydmljZXMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvc2VydmljZXMnKSxcbiAgICAgICdAc3RvcmVzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3N0b3JlcycpLFxuICAgICAgJ0B1dGlscyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy91dGlscycpLFxuICAgICAgJ0B0eXBlcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy90eXBlcycpLFxuICAgICAgJ0BzdHlsZXMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvc3R5bGVzJyksXG4gICAgICAnQGFzc2V0cyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy9hc3NldHMnKSxcbiAgICAgICdAdGF1cmktYXBwcy9hcGkvdGF1cmknOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvdGVzdHMvbW9ja3MvdGF1cmktYXBpLnRzJyksXG4gICAgICAnQHRhdXJpLWFwcHMvYXBpL2NvcmUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvdGVzdHMvbW9ja3MvdGF1cmktYXBpLnRzJyksXG4gICAgfSxcbiAgfSxcbiAgXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcbiAgICAgICdAY29tcG9uZW50cyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy9jb21wb25lbnRzJyksXG4gICAgICAnQGhvb2tzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL2hvb2tzJyksXG4gICAgICAnQHNlcnZpY2VzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3NlcnZpY2VzJyksXG4gICAgICAnQHN0b3Jlcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy9zdG9yZXMnKSxcbiAgICAgICdAdXRpbHMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvdXRpbHMnKSxcbiAgICAgICdAdHlwZXMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvdHlwZXMnKSxcbiAgICAgICdAc3R5bGVzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3N0eWxlcycpLFxuICAgICAgJ0Bhc3NldHMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvYXNzZXRzJyksXG4gICAgICAnQHRhdXJpLWFwcHMvYXBpL3RhdXJpJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3Rlc3RzL21vY2tzL3RhdXJpLWFwaS50cycpLFxuICAgICAgJ0B0YXVyaS1hcHBzL2FwaS9jb3JlJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3Rlc3RzL21vY2tzL3RhdXJpLWFwaS50cycpLFxuICAgIH0sXG4gIH0sXG59KTtcblxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE2USxTQUFTLG9CQUFvQjtBQUMxUyxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBRmpCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sd0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUVqQixNQUFNO0FBQUE7QUFBQSxJQUVKLGFBQWE7QUFBQTtBQUFBLElBR2IsU0FBUztBQUFBO0FBQUEsSUFHVCxVQUFVO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixVQUFVLENBQUMsUUFBUSxRQUFRLFFBQVEsTUFBTTtBQUFBLE1BQ3pDLFNBQVMsQ0FBQyxtQkFBbUI7QUFBQSxNQUM3QixTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsS0FBSztBQUFBLE1BQ0wsWUFBWTtBQUFBLFFBQ1YsT0FBTztBQUFBLFFBQ1AsV0FBVztBQUFBLFFBQ1gsVUFBVTtBQUFBLFFBQ1YsWUFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUE7QUFBQSxJQUdBLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQTtBQUFBLElBR0EsU0FBUztBQUFBLE1BQ1A7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQTtBQUFBLElBR0EsWUFBWSxDQUFDLHNCQUFzQjtBQUFBO0FBQUEsSUFHbkMsYUFBYTtBQUFBO0FBQUEsSUFHYixhQUFhO0FBQUE7QUFBQSxJQUdiLFlBQVk7QUFBQTtBQUFBLElBR1osV0FBVztBQUFBO0FBQUEsSUFHWCxjQUFjO0FBQUE7QUFBQSxJQUdkLFNBQVM7QUFBQTtBQUFBLElBR1QsT0FBTztBQUFBO0FBQUEsSUFHUCxXQUFXLENBQUMsV0FBVyxTQUFTO0FBQUE7QUFBQSxJQUdoQyxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDcEMsZUFBZSxLQUFLLFFBQVEsa0NBQVcsa0JBQWtCO0FBQUEsTUFDekQsVUFBVSxLQUFLLFFBQVEsa0NBQVcsYUFBYTtBQUFBLE1BQy9DLGFBQWEsS0FBSyxRQUFRLGtDQUFXLGdCQUFnQjtBQUFBLE1BQ3JELFdBQVcsS0FBSyxRQUFRLGtDQUFXLGNBQWM7QUFBQSxNQUNqRCxVQUFVLEtBQUssUUFBUSxrQ0FBVyxhQUFhO0FBQUEsTUFDL0MsVUFBVSxLQUFLLFFBQVEsa0NBQVcsYUFBYTtBQUFBLE1BQy9DLFdBQVcsS0FBSyxRQUFRLGtDQUFXLGNBQWM7QUFBQSxNQUNqRCxXQUFXLEtBQUssUUFBUSxrQ0FBVyxjQUFjO0FBQUEsTUFDakQseUJBQXlCLEtBQUssUUFBUSxrQ0FBVyxnQ0FBZ0M7QUFBQSxNQUNqRix3QkFBd0IsS0FBSyxRQUFRLGtDQUFXLGdDQUFnQztBQUFBLElBQ2xGO0FBQUEsRUFDRjtBQUFBLEVBRUEsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQ3BDLGVBQWUsS0FBSyxRQUFRLGtDQUFXLGtCQUFrQjtBQUFBLE1BQ3pELFVBQVUsS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUMvQyxhQUFhLEtBQUssUUFBUSxrQ0FBVyxnQkFBZ0I7QUFBQSxNQUNyRCxXQUFXLEtBQUssUUFBUSxrQ0FBVyxjQUFjO0FBQUEsTUFDakQsVUFBVSxLQUFLLFFBQVEsa0NBQVcsYUFBYTtBQUFBLE1BQy9DLFVBQVUsS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUMvQyxXQUFXLEtBQUssUUFBUSxrQ0FBVyxjQUFjO0FBQUEsTUFDakQsV0FBVyxLQUFLLFFBQVEsa0NBQVcsY0FBYztBQUFBLE1BQ2pELHlCQUF5QixLQUFLLFFBQVEsa0NBQVcsZ0NBQWdDO0FBQUEsTUFDakYsd0JBQXdCLEtBQUssUUFBUSxrQ0FBVyxnQ0FBZ0M7QUFBQSxJQUNsRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
