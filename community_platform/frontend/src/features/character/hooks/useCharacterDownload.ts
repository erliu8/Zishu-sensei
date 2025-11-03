/**
 * 角色下载 Hook
 * 处理角色打包和下载的完整流程
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/shared/hooks/use-toast';
import { isDesktopApp, downloadCharacterToDesktop } from '@/shared/utils/desktop';
import { apiClient } from '@/infrastructure/api/client';
import { useAuth } from '@/features/auth/hooks';

/**
 * 打包配置
 */
interface PackagingConfig {
  app_name: string;
  version: string;
  models: string[];
  adapters: string[];
  character?: any;
  settings?: Record<string, any>;
  branding?: Record<string, any>;
}

/**
 * 打包任务创建请求
 */
interface PackagingTaskCreate {
  config: PackagingConfig;
  platform: 'windows' | 'macos' | 'linux';
}

/**
 * 打包任务
 */
interface PackagingTask {
  id: string;
  userId: string;
  config: PackagingConfig;
  platform: string;
  status: 'pending' | 'packaging' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  fileSize?: number;
  fileHash?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * API 响应类型
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * 检测当前操作系统平台
 */
function detectPlatform(): 'windows' | 'macos' | 'linux' {
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('win')) {
    return 'windows';
  } else if (userAgent.includes('mac')) {
    return 'macos';
  } else {
    return 'linux';
  }
}

/**
 * 创建打包任务
 */
async function createPackagingTask(data: PackagingTaskCreate): Promise<PackagingTask> {
  console.log('Creating packaging task with data:', data);
  console.log('API Client baseURL:', apiClient.defaults.baseURL);
  
  try {
    // apiClient的baseURL已经是/api，所以这里只需要相对路径
    const response = await apiClient.post<ApiResponse<PackagingTask>>('/packaging/', data);
    
    // 调试日志
    console.log('Create packaging task - Full response:', response);
    console.log('Create packaging task - Response status:', response.status);
    console.log('Create packaging task - Response data:', response.data);
    console.log('Create packaging task - Response data type:', typeof response.data);
    const respContentType = (response.headers as any)?.['content-type'] || '';
    const respDataUnknown = response.data as unknown;

    // 如果拿到的是 HTML/非 JSON（很可能命中了 Next 页面路由），直接抛出更明确的错误
    if (typeof respDataUnknown === 'string' || (respContentType && !respContentType.includes('application/json'))) {
      console.error('[Packaging] 非 JSON 响应，疑似命中页面路由而非 API', {
        contentType: respContentType,
        url: response.config?.url,
        baseURL: response.config?.baseURL,
        snippet: typeof respDataUnknown === 'string' ? (respDataUnknown as string).slice(0, 200) : respDataUnknown,
      });
      throw new Error('打包任务创建失败：请求未命中 API（收到 HTML/非JSON 响应），请检查 NEXT_PUBLIC_API_URL 或代理配置');
    }
    
    // 检查响应结构
    if (!response.data) {
      console.error('API response.data is empty');
      throw new Error('API 响应为空');
    }
    
    // 检查是否是 ApiResponse 格式
    if (typeof response.data === 'object' && 'data' in response.data) {
      console.log('Response follows ApiResponse format');
      console.log('Response.data.data:', response.data.data);
      
      const task = response.data.data;
      
      if (!task) {
        console.error('Task data is null/undefined in ApiResponse');
        console.error('Full response.data:', JSON.stringify(response.data, null, 2));
        throw new Error(`打包任务创建失败：${response.data.message || '返回数据为空'}`);
      }
      
      if (!task.id) {
        console.error('Task is missing id field:', task);
        throw new Error('打包任务创建失败：任务ID缺失');
      }
      
      console.log('Successfully created task with id:', task.id);
      return task;
    } else {
      // 直接返回的是 task 对象
      console.log('Response is direct task object');
      const task = response.data as any;
      
      if (!task.id) {
        console.error('Direct task response missing id:', task);
        throw new Error('打包任务创建失败：返回数据格式错误');
      }
      
      return task;
    }
  } catch (error: any) {
    console.error('Error creating packaging task:', error);
    console.error('Error response:', error.response);
    console.error('Error response data:', error.response?.data);
    
    // 处理401认证错误
    if (error.response?.status === 401) {
      throw new Error('请先登录后再下载角色。点击右上角登录按钮进行登录。');
    }
    
    // 处理其他HTTP错误
    if (error.response?.status) {
      const status = error.response.status;
      switch (status) {
        case 403:
          throw new Error('您没有权限下载此角色');
        case 404:
          throw new Error('角色不存在或已被删除');
        case 429:
          throw new Error('请求过于频繁，请稍后重试');
        case 500:
          throw new Error('服务器内部错误，请稍后重试');
        default:
          throw new Error(`请求失败 (${status})，请稍后重试`);
      }
    }
    
    throw error;
  }
}

/**
 * 获取打包任务状态
 */
async function getPackagingTask(taskId: string): Promise<PackagingTask> {
  try {
    // apiClient的baseURL已经是/api，所以这里只需要相对路径
    const response = await apiClient.get<ApiResponse<PackagingTask>>(`/packaging/${taskId}/`);
    
    // 检查响应类型（防止收到 HTML 而不是 JSON）
    const contentType = response.headers?.['content-type'] || '';
    if (typeof response.data === 'string' || !contentType.includes('application/json')) {
      console.error('[Packaging] 非 JSON 响应，疑似命中页面路由而非 API', {
        contentType,
        url: response.config?.url,
        snippet: typeof response.data === 'string' ? (response.data as string).slice(0, 200) : response.data,
      });
      throw new Error('获取任务状态失败：请求未命中 API（收到 HTML/非JSON 响应）');
    }
    
    // 检查响应结构
    if (!response.data || typeof response.data !== 'object') {
      throw new Error('获取任务状态失败：响应数据格式错误');
    }
    
    // 检查是否是 ApiResponse 格式
    if ('data' in response.data) {
      const task = response.data.data;
      if (!task || !task.id) {
        throw new Error('获取任务状态失败：任务数据无效');
      }
      return task;
    } else {
      // 直接返回的是 task 对象
      const task = response.data as any;
      if (!task || !task.id) {
        throw new Error('获取任务状态失败：任务数据无效');
      }
      return task;
    }
  } catch (error: any) {
    console.error('Error getting packaging task:', error);
    
    // 处理HTTP错误
    if (error.response?.status) {
      const status = error.response.status;
      switch (status) {
        case 401:
          throw new Error('认证已过期，请重新登录');
        case 403:
          throw new Error('您没有权限访问此任务');
        case 404:
          throw new Error('任务不存在或已被删除');
        default:
          throw new Error(`获取任务状态失败 (${status})`);
      }
    }
    
    throw error;
  }
}

/**
 * 角色下载 Hook
 */
export function useCharacterDownload() {
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const [packagingTaskId, setPackagingTaskId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  /**
   * 处理下载完成
   */
  const handleDownloadComplete = useCallback((task: PackagingTask) => {
    if (!task.downloadUrl) return;

    const characterName = task.config.app_name || 'character';

    // 检测是否在桌面应用中
    if (isDesktopApp()) {
      console.log('[Desktop] 使用深度链接下载到桌面应用');
      
      // 使用深度链接调用桌面应用
      downloadCharacterToDesktop(task.id, characterName, task.downloadUrl);
      
      toast({
        title: '开始下载',
        description: `正在将 ${characterName} 下载到桌面应用...`,
      });
    } else {
      // 浏览器环境，使用传统下载方式
      console.log('[Browser] 使用浏览器下载');
      window.open(task.downloadUrl, '_blank');
      
      toast({
        title: '下载开始',
        description: '文件开始下载，请查看浏览器下载管理器',
      });
    }
  }, [toast]);

  // 创建打包任务的 mutation
  const createTaskMutation = useMutation({
    mutationFn: createPackagingTask,
    onSuccess: (task) => {
      console.log('Mutation onSuccess, task:', task);
      
      if (!task || !task.id) {
        console.error('Task is invalid:', task);
        toast({
          title: '创建打包任务失败',
          description: '返回的任务数据无效',
          variant: 'destructive',
        });
        return;
      }
      
      setPackagingTaskId(task.id);
      setIsPolling(true);
      
      toast({
        title: '开始打包',
        description: '正在为您打包角色，请稍候...',
      });
    },
    onError: (error: any) => {
      console.error('Mutation onError:', error);
      toast({
        title: '创建打包任务失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });

  // 轮询打包任务状态
  const { data: packagingTask, error: pollingError } = useQuery({
    queryKey: ['packaging-task', packagingTaskId],
    queryFn: async () => {
      console.log(`[轮询] 查询任务状态: ${packagingTaskId}`);
      
      // 检查用户登录状态
      if (!isAuthenticated || !user) {
        console.error('[轮询] 用户未登录，停止轮询');
        throw new Error('用户未登录');
      }
      
      try {
        const task = await getPackagingTask(packagingTaskId!);
        console.log(`[轮询] 任务状态: ${task.status}, 进度: ${task.progress}%`);
        return task;
      } catch (error: any) {
        console.error('[轮询] 查询任务状态失败:', error);
        
        // 如果是401错误，提示用户重新登录
        if (error.response?.status === 401) {
          toast({
            title: '登录已过期',
            description: '请重新登录后继续下载',
            variant: 'destructive',
          });
          setIsPolling(false);
        }
        
        throw error;
      }
    },
    enabled: !!packagingTaskId && isPolling && isAuthenticated && !!user,
    refetchInterval: (query) => {
      // 如果任务未完成，每2秒轮询一次
      const task = query?.state?.data;
      // 添加安全检查，防止 task 为 undefined 时访问 task.status
      if (task && task.status && (task.status === 'pending' || task.status === 'packaging')) {
        return 2000;
      }
      // 任务完成或失败，停止轮询
      return false;
    },
    retry: (failureCount, error: any) => {
      // 如果是认证错误，不重试
      if (error?.response?.status === 401) {
        return false;
      }
      // 其他错误重试最多3次
      return failureCount < 3;
    },
  });

  // 监听打包任务状态变化
  if (packagingTask && isPolling) {
    if (packagingTask.status === 'completed' && packagingTask.downloadUrl) {
      // 打包完成，触发下载
      setIsPolling(false);
      handleDownloadComplete(packagingTask);
    } else if (packagingTask.status === 'failed') {
      // 打包失败
      setIsPolling(false);
      toast({
        title: '打包失败',
        description: packagingTask.errorMessage || '打包过程中出现错误',
        variant: 'destructive',
      });
    }
  }

  // 监听轮询错误
  if (pollingError && isPolling) {
    console.error('[轮询错误]', pollingError);
    setIsPolling(false);
    
    // 如果不是认证错误，显示通用错误提示
    if (!(pollingError as any)?.response || (pollingError as any)?.response?.status !== 401) {
      toast({
        title: '查询任务状态失败',
        description: '无法获取打包进度，请稍后重试',
        variant: 'destructive',
      });
    }
  }

  /**
   * 开始下载角色
   * @param character 角色数据
   */
  const downloadCharacter = useCallback(async (character: any) => {
    // 检查用户登录状态
    if (!isAuthenticated || !user) {
      toast({
        title: '请先登录',
        description: '下载角色需要登录账号。请点击右上角登录按钮进行登录。',
        variant: 'destructive',
      });
      return;
    }

    try {
      // 检测平台
      const platform = detectPlatform();

      // 构建打包配置
      const config: PackagingConfig = {
        app_name: character.displayName || character.name,
        version: character.version || '1.0.0',
        models: [], // 从角色配置中提取
        adapters: character.adapters?.map((a: any) => a.id) || [],
        character: {
          id: character.id,
          name: character.name,
          displayName: character.displayName,
          description: character.description,
          avatarUrl: character.avatarUrl,
          coverUrl: character.coverUrl,
          config: character.config,
          personality: character.personality,
          expressions: character.expressions,
          voices: character.voices,
          models: character.models,
        },
        settings: {},
        branding: {
          name: character.displayName || character.name,
          icon: character.avatarUrl,
        },
      };

      // 创建打包任务
      await createTaskMutation.mutateAsync({
        config,
        platform,
      });
    } catch (error: any) {
      console.error('下载角色失败:', error);
      toast({
        title: '下载失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    }
  }, [createTaskMutation, toast, isAuthenticated, user]);

  return {
    downloadCharacter,
    packagingTask,
    isPackaging: createTaskMutation.isPending || (isPolling && packagingTask?.status === 'packaging'),
    progress: packagingTask?.progress || 0,
  };
}

