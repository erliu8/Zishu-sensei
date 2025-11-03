console.log('=== 环境变量测试 ===');
console.log('process.env.NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('typeof window:', typeof window);

// 模拟API客户端创建
const rawBaseURL = process.env.NEXT_PUBLIC_API_URL;
console.log('rawBaseURL:', rawBaseURL);

let resolvedBaseURL = (typeof rawBaseURL === 'string' && rawBaseURL.trim() !== '')
  ? rawBaseURL
  : '/api';

console.log('resolvedBaseURL:', resolvedBaseURL);
