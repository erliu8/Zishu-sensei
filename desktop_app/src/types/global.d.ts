/**
 * 全局类型声明文件
 * 用于解决第三方库和全局对象的类型问题
 */

declare global {
  interface Window {
    __TAURI__?: any;
  }
}

// 确保这个文件被视为模块
export {};
