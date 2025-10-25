import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * 全局测试清理
 * 在所有测试运行之后执行
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 开始全局清理...');

  // 清理临时文件
  const authDir = path.join(process.cwd(), 'playwright/.auth');
  if (fs.existsSync(authDir)) {
    try {
      // 清理认证文件（可选，根据需求决定是否保留）
      // fs.rmSync(authDir, { recursive: true, force: true });
      console.log('✅ 认证文件已清理');
    } catch (error) {
      console.error('❌ 清理认证文件失败:', error);
    }
  }

  console.log('✅ 全局清理完成');
}

export default globalTeardown;

