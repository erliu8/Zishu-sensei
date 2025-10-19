/**
 * 常用懒加载组件定义
 */
import { enhancedLazy, createLazyComponent } from './LazyComponent';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { SkeletonLoader } from '../common/SkeletonLoader';

// === 页面组件懒加载 ===

/**
 * 聊天页面
 */
export const LazyChatPage = enhancedLazy(
  () => import('../../pages/Chat'),
  {
    fallback: <SkeletonLoader type="chat" />,
    displayName: 'ChatPage',
  }
);

/**
 * 设置页面
 */
export const LazySettingsPage = enhancedLazy(
  () => import('../../pages/Settings'),
  {
    fallback: <SkeletonLoader type="settings" />,
    displayName: 'SettingsPage',
  }
);

/**
 * 角色页面
 */
export const LazyCharacterPage = enhancedLazy(
  () => import('../../pages/Character'),
  {
    fallback: <SkeletonLoader type="character" />,
    displayName: 'CharacterPage',
  }
);

/**
 * 工作流页面
 */
export const LazyWorkflowPage = enhancedLazy(
  () => import('../../pages/Workflow'),
  {
    fallback: <SkeletonLoader type="workflow" />,
    displayName: 'WorkflowPage',
  }
);

/**
 * 适配器管理页面
 */
export const LazyAdapterManagementPage = enhancedLazy(
  () => import('../../pages/AdapterManagement'),
  {
    fallback: <SkeletonLoader type="adapter" />,
    displayName: 'AdapterManagementPage',
  }
);

// === 组件懒加载 ===

/**
 * 工作流编辑器
 */
export const LazyWorkflowEditor = createLazyComponent(
  () => import('../Desktop/WorkflowEditor'),
  {
    fallback: <SkeletonLoader type="editor" />,
    displayName: 'WorkflowEditor',
    enablePreload: true,
    preloadDelay: 2000,
  }
);

/**
 * 主题定制器
 */
export const LazyThemeCustomizer = createLazyComponent(
  () => import('../ThemeCustomizer'),
  {
    fallback: <SkeletonLoader type="customizer" />,
    displayName: 'ThemeCustomizer',
    enablePreload: false,
  }
);

/**
 * 适配器市场
 */
export const LazyAdapterMarket = createLazyComponent(
  () => import('../AdapterMarket'),
  {
    fallback: <SkeletonLoader type="market" />,
    displayName: 'AdapterMarket',
    enablePreload: false,
  }
);

/**
 * Live2D 模型查看器
 */
export const LazyLive2DViewer = createLazyComponent(
  () => import('../Character/Live2D/ModelViewer'),
  {
    fallback: <SkeletonLoader type="model-viewer" />,
    displayName: 'Live2DViewer',
    enablePreload: true,
    preloadDelay: 3000,
  }
);

/**
 * 文件管理器
 */
export const LazyFileManager = createLazyComponent(
  () => import('../FileManager'),
  {
    fallback: <SkeletonLoader type="file-manager" />,
    displayName: 'FileManager',
    enablePreload: false,
  }
);

/**
 * 聊天历史组件
 */
export const LazyChatHistory = createLazyComponent(
  () => import('../Chat/ChatHistory'),
  {
    fallback: <LoadingSpinner message="加载聊天历史..." />,
    displayName: 'ChatHistory',
    enablePreload: true,
    preloadDelay: 1000,
  }
);

/**
 * 消息搜索组件
 */
export const LazyMessageSearch = createLazyComponent(
  () => import('../Chat/MessageSearch'),
  {
    fallback: <LoadingSpinner message="加载搜索功能..." />,
    displayName: 'MessageSearch',
    enablePreload: false,
  }
);

/**
 * 消息导出组件
 */
export const LazyMessageExport = createLazyComponent(
  () => import('../Chat/MessageExport'),
  {
    fallback: <LoadingSpinner message="加载导出功能..." />,
    displayName: 'MessageExport',
    enablePreload: false,
  }
);

/**
 * 快捷键设置面板
 */
export const LazyShortcutsPanel = createLazyComponent(
  () => import('../Settings/ShortcutsPanel'),
  {
    fallback: <SkeletonLoader type="settings-panel" />,
    displayName: 'ShortcutsPanel',
    enablePreload: false,
  }
);

/**
 * 性能监控面板
 */
export const LazyPerformanceMonitor = createLazyComponent(
  () => import('../Performance/RenderingMonitor'),
  {
    fallback: <SkeletonLoader type="monitor" />,
    displayName: 'PerformanceMonitor',
    enablePreload: false,
  }
);

/**
 * 内存监控面板
 */
export const LazyMemoryMonitor = createLazyComponent(
  () => import('../Memory/MemoryMonitorPanel'),
  {
    fallback: <SkeletonLoader type="monitor" />,
    displayName: 'MemoryMonitor',
    enablePreload: false,
  }
);

// === 功能组件懒加载 ===

/**
 * 代码编辑器
 */
export const LazyCodeEditor = createLazyComponent(
  () => import('../common/CodeEditor'),
  {
    fallback: <SkeletonLoader type="editor" />,
    displayName: 'CodeEditor',
    enablePreload: false,
  }
);

/**
 * 图表组件
 */
export const LazyChart = createLazyComponent(
  () => import('../common/Chart'),
  {
    fallback: <SkeletonLoader type="chart" />,
    displayName: 'Chart',
    enablePreload: false,
  }
);

/**
 * 日历组件
 */
export const LazyCalendar = createLazyComponent(
  () => import('../common/Calendar'),
  {
    fallback: <SkeletonLoader type="calendar" />,
    displayName: 'Calendar',
    enablePreload: false,
  }
);

/**
 * 数据表格组件
 */
export const LazyDataTable = createLazyComponent(
  () => import('../common/DataTable'),
  {
    fallback: <SkeletonLoader type="table" />,
    displayName: 'DataTable',
    enablePreload: false,
  }
);

// === 第三方库懒加载 ===

/**
 * Markdown 编辑器
 */
export const LazyMarkdownEditor = createLazyComponent(
  () => import('@uiw/react-md-editor').then(module => ({ default: module.default })),
  {
    fallback: <SkeletonLoader type="editor" />,
    displayName: 'MarkdownEditor',
    enablePreload: false,
  }
);

// === 预加载组合 ===

/**
 * 核心页面预加载列表
 */
export const CORE_PAGES_PRELOAD = [
  () => import('../../pages/Chat'),
  () => import('../../pages/Settings'),
  () => import('../../pages/Character'),
];

/**
 * 扩展功能预加载列表
 */
export const EXTENDED_FEATURES_PRELOAD = [
  () => import('../Desktop/WorkflowEditor'),
  () => import('../Character/Live2D/ModelViewer'),
  () => import('../Chat/ChatHistory'),
];

/**
 * 工具组件预加载列表
 */
export const UTILITY_COMPONENTS_PRELOAD = [
  () => import('../common/CodeEditor'),
  () => import('../common/Chart'),
  () => import('../common/DataTable'),
];

/**
 * 管理面板预加载列表
 */
export const ADMIN_PANELS_PRELOAD = [
  () => import('../Performance/RenderingMonitor'),
  () => import('../Memory/MemoryMonitorPanel'),
  () => import('../Settings/ShortcutsPanel'),
];

// === 懒加载配置 ===

/**
 * 懒加载策略配置
 */
export const LAZY_LOAD_CONFIG = {
  // 立即预加载的组件
  immediate: CORE_PAGES_PRELOAD,
  
  // 延迟预加载的组件
  deferred: EXTENDED_FEATURES_PRELOAD,
  
  // 按需加载的组件
  onDemand: [
    ...UTILITY_COMPONENTS_PRELOAD,
    ...ADMIN_PANELS_PRELOAD,
  ],
  
  // 预加载延迟时间配置
  delays: {
    core: 0,         // 核心页面立即加载
    extended: 2000,  // 扩展功能2秒后加载
    utility: 5000,   // 工具组件5秒后加载
    admin: 10000,    // 管理面板10秒后加载
  },
} as const;

/**
 * 根据优先级预加载组件
 */
export function preloadComponentsByPriority() {
  // 立即预加载核心页面
  setTimeout(() => {
    LAZY_LOAD_CONFIG.immediate.forEach(importFunc => {
      importFunc().catch(console.error);
    });
  }, LAZY_LOAD_CONFIG.delays.core);

  // 延迟预加载扩展功能
  setTimeout(() => {
    LAZY_LOAD_CONFIG.deferred.forEach(importFunc => {
      importFunc().catch(console.error);
    });
  }, LAZY_LOAD_CONFIG.delays.extended);

  // 可选预加载工具组件
  setTimeout(() => {
    if (navigator.connection && (navigator.connection as any).effectiveType === '4g') {
      LAZY_LOAD_CONFIG.onDemand.slice(0, 3).forEach(importFunc => {
        importFunc().catch(console.error);
      });
    }
  }, LAZY_LOAD_CONFIG.delays.utility);
}

/**
 * 检查网络状态并决定是否预加载
 */
export function smartPreload() {
  // 检查网络连接
  if (!navigator.onLine) {
    console.log('Offline mode: skipping preload');
    return;
  }

  // 检查连接类型
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType;
    
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      console.log('Slow connection: skipping preload');
      return;
    }
  }

  // 检查设备内存
  if ('deviceMemory' in navigator) {
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory && deviceMemory < 4) {
      console.log('Low memory device: limited preload');
      // 只预加载核心组件
      LAZY_LOAD_CONFIG.immediate.forEach(importFunc => {
        importFunc().catch(console.error);
      });
      return;
    }
  }

  // 全量预加载
  preloadComponentsByPriority();
}

// 自动执行智能预加载
if (typeof window !== 'undefined') {
  // 在页面空闲时执行预加载
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(smartPreload, { timeout: 5000 });
  } else {
    // 降级处理
    setTimeout(smartPreload, 3000);
  }
}
