/**
 * 视觉回归测试全局设置
 * 在所有视觉测试运行前执行
 */
export default async function globalSetup() {
  console.log('\n🎨 开始视觉回归测试设置...\n');
  
  // 设置环境变量
  process.env.VISUAL_TEST = 'true';
  
  // 清理旧的截图差异文件
  // 可以在这里添加清理逻辑
  
  console.log('✅ 视觉测试环境准备完成\n');
}

