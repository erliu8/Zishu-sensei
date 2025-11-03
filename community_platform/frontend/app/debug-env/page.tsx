'use client';

import { useEffect } from 'react';
import { apiClient } from '@/infrastructure/api/client';

export default function DebugEnvPage() {
  useEffect(() => {
    console.log('=== 环境变量调试 ===');
    console.log('process.env.NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
    console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
    console.log('apiClient.defaults.baseURL:', apiClient.defaults.baseURL);
    console.log('window.location.origin:', typeof window !== 'undefined' ? window.location.origin : 'undefined');
    
    // 检查是否在浏览器环境
    console.log('typeof window:', typeof window);
    console.log('是否在浏览器环境:', typeof window !== 'undefined');
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>环境变量调试页面</h1>
      <p>请打开浏览器控制台查看输出</p>
      <div>
        <h2>客户端环境变量:</h2>
        <p>NEXT_PUBLIC_API_URL: {process.env.NEXT_PUBLIC_API_URL || '未定义'}</p>
        <p>NODE_ENV: {process.env.NODE_ENV || '未定义'}</p>
      </div>
      <div>
        <h2>API客户端配置:</h2>
        <p>baseURL: {apiClient.defaults.baseURL}</p>
      </div>
    </div>
  );
}
