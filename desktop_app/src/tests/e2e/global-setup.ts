/**
 * E2E 测试全局设置
 * 在所有测试运行前执行一次
 */

import fs from 'fs';
import path from 'path';

async function globalSetup() {
  console.log('🚀 正在初始化 E2E 测试环境...');
  
  // 创建必要的目录
  const dirs = [
    'tests/e2e/screenshots',
    'tests/e2e/report',
    'tests/e2e/results',
    'tests/e2e/videos',
  ];
  
  for (const dir of dirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ 创建目录: ${dir}`);
    }
  }
  
  // 清理旧的测试结果
  const cleanDirs = [
    'tests/e2e/screenshots',
    'tests/e2e/results',
    'tests/e2e/videos',
  ];
  
  for (const dir of cleanDirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        fs.unlinkSync(path.join(dirPath, file));
      }
      console.log(`🧹 清理目录: ${dir}`);
    }
  }
  
  // 设置环境变量
  process.env.E2E_TEST = 'true';
  process.env.NODE_ENV = 'test';
  
  console.log('✅ E2E 测试环境初始化完成\n');
}

export default globalSetup;
