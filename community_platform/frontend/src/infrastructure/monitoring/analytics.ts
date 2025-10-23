/**
 * Google Analytics 集成
 * 提供页面访问跟踪、事件跟踪、自定义维度功能
 */

/**
 * GA 配置选项
 */
export interface AnalyticsConfig {
  measurementId: string;
  enabled: boolean;
  debug?: boolean;
}

/**
 * 事件参数
 */
export interface EventParams {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: any;
}

/**
 * 页面浏览参数
 */
export interface PageViewParams {
  page_title?: string;
  page_location?: string;
  page_path?: string;
  [key: string]: any;
}

/**
 * 用户属性
 */
export interface UserProperties {
  user_id?: string;
  [key: string]: any;
}

declare global {
  interface Window {
    gtag?: (
      command: string,
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}

/**
 * 初始化 Google Analytics
 */
export function initAnalytics(config: AnalyticsConfig): void {
  if (!config.enabled || !config.measurementId) {
    console.warn('Google Analytics is disabled or Measurement ID is not provided');
    return;
  }

  // 加载 gtag.js
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`;
  document.head.appendChild(script);

  // 初始化 dataLayer
  window.dataLayer = window.dataLayer || [];
  
  // 定义 gtag 函数
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments);
  };
  
  // 配置
  window.gtag('js', new Date());
  window.gtag('config', config.measurementId, {
    debug_mode: config.debug,
    send_page_view: false, // 手动控制页面浏览事件
  });
}

/**
 * 跟踪页面浏览
 */
export function trackPageView(params?: PageViewParams): void {
  if (!window.gtag) {
    console.warn('Google Analytics is not initialized');
    return;
  }

  window.gtag('event', 'page_view', {
    page_title: params?.page_title || document.title,
    page_location: params?.page_location || window.location.href,
    page_path: params?.page_path || window.location.pathname,
    ...params,
  });
}

/**
 * 跟踪自定义事件
 */
export function trackEvent(eventName: string, params?: EventParams): void {
  if (!window.gtag) {
    console.warn('Google Analytics is not initialized');
    return;
  }

  window.gtag('event', eventName, params);
}

/**
 * 设置用户属性
 */
export function setUserProperties(properties: UserProperties): void {
  if (!window.gtag) {
    console.warn('Google Analytics is not initialized');
    return;
  }

  window.gtag('set', 'user_properties', properties);
}

/**
 * 设置用户 ID
 */
export function setUserId(userId: string | null): void {
  if (!window.gtag) {
    console.warn('Google Analytics is not initialized');
    return;
  }

  if (userId) {
    window.gtag('config', 'user_id', { user_id: userId });
  }
}

/**
 * 预定义事件跟踪器
 */
export const Analytics = {
  // 用户行为
  user: {
    login: (method: string) => {
      trackEvent('login', { method });
    },
    signup: (method: string) => {
      trackEvent('sign_up', { method });
    },
    logout: () => {
      trackEvent('logout');
    },
  },

  // 帖子相关
  post: {
    view: (postId: string) => {
      trackEvent('view_post', { post_id: postId });
    },
    create: (postId: string) => {
      trackEvent('create_post', { post_id: postId });
    },
    edit: (postId: string) => {
      trackEvent('edit_post', { post_id: postId });
    },
    delete: (postId: string) => {
      trackEvent('delete_post', { post_id: postId });
    },
    like: (postId: string) => {
      trackEvent('like_post', { post_id: postId });
    },
    share: (postId: string, method: string) => {
      trackEvent('share', { content_type: 'post', item_id: postId, method });
    },
  },

  // 适配器相关
  adapter: {
    view: (adapterId: string) => {
      trackEvent('view_adapter', { adapter_id: adapterId });
    },
    download: (adapterId: string, version: string) => {
      trackEvent('download_adapter', { 
        adapter_id: adapterId, 
        version,
        content_type: 'adapter'
      });
    },
    upload: (adapterId: string) => {
      trackEvent('upload_adapter', { adapter_id: adapterId });
    },
    rate: (adapterId: string, rating: number) => {
      trackEvent('rate_adapter', { adapter_id: adapterId, value: rating });
    },
  },

  // 角色相关
  character: {
    view: (characterId: string) => {
      trackEvent('view_character', { character_id: characterId });
    },
    create: (characterId: string) => {
      trackEvent('create_character', { character_id: characterId });
    },
    edit: (characterId: string) => {
      trackEvent('edit_character', { character_id: characterId });
    },
    delete: (characterId: string) => {
      trackEvent('delete_character', { character_id: characterId });
    },
    favorite: (characterId: string) => {
      trackEvent('favorite_character', { character_id: characterId });
    },
  },

  // 评论相关
  comment: {
    create: (targetType: string, targetId: string) => {
      trackEvent('create_comment', { 
        target_type: targetType, 
        target_id: targetId 
      });
    },
    reply: (commentId: string) => {
      trackEvent('reply_comment', { comment_id: commentId });
    },
    like: (commentId: string) => {
      trackEvent('like_comment', { comment_id: commentId });
    },
  },

  // 社交互动
  social: {
    follow: (userId: string) => {
      trackEvent('follow_user', { user_id: userId });
    },
    unfollow: (userId: string) => {
      trackEvent('unfollow_user', { user_id: userId });
    },
    favorite: (contentType: string, contentId: string) => {
      trackEvent('add_to_favorites', { 
        content_type: contentType, 
        item_id: contentId 
      });
    },
  },

  // 搜索
  search: {
    perform: (query: string, resultCount: number) => {
      trackEvent('search', { 
        search_term: query, 
        result_count: resultCount 
      });
    },
    selectResult: (query: string, resultId: string, position: number) => {
      trackEvent('select_content', {
        search_term: query,
        content_id: resultId,
        position,
      });
    },
  },

  // 打包服务
  packaging: {
    start: (taskId: string) => {
      trackEvent('start_packaging', { task_id: taskId });
    },
    complete: (taskId: string, duration: number) => {
      trackEvent('complete_packaging', { 
        task_id: taskId, 
        duration,
      });
    },
    download: (taskId: string) => {
      trackEvent('download_package', { task_id: taskId });
    },
  },

  // 通知
  notification: {
    receive: (type: string) => {
      trackEvent('receive_notification', { notification_type: type });
    },
    click: (type: string, notificationId: string) => {
      trackEvent('notification_click', { 
        notification_type: type,
        notification_id: notificationId,
      });
    },
  },

  // 错误
  error: {
    client: (errorName: string, errorMessage: string) => {
      trackEvent('exception', {
        description: `${errorName}: ${errorMessage}`,
        fatal: false,
      });
    },
    api: (endpoint: string, statusCode: number) => {
      trackEvent('api_error', {
        endpoint,
        status_code: statusCode,
      });
    },
  },
};

