/**
 * E2E 测试全局清理
 * 在所有测试运行后执行一次
 */

async function globalTeardown() {
  console.log('\n🧹 正在清理 E2E 测试环境...');
  
  // 清理环境变量
  delete process.env.E2E_TEST;
  
  console.log('✅ E2E 测试环境清理完成');
}

export default globalTeardown;
