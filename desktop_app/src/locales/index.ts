import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 懒加载支持
import { 
  loadLanguageResources, 
  smartPreload,
  startCacheCleanup 
} from '../utils/i18nLoader';

// 仅导入基础语言资源（用于初始化）
import zhCommon from './zh/common.json';
import enCommon from './en/common.json';

// 支持的语言列表
export const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '中文', nativeName: '中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' }
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// 基础语言资源（仅用于初始化）
const initialResources = {
  zh: {
    common: zhCommon
  },
  en: {
    common: enCommon
  },
  ja: {
    common: {} // 将通过懒加载获取
  },
  ko: {
    common: {} // 将通过懒加载获取
  }
};

// 语言检测配置
const languageDetectorOptions = {
  // 检测顺序
  order: ['localStorage', 'navigator', 'htmlTag'],
  
  // 缓存用户语言设置
  caches: ['localStorage'],
  
  // localStorage 键名
  lookupLocalStorage: 'zishu-language',
  
  // 排除的语言
  excludeCacheFor: ['cimode'],
  
  // 检查白名单
  checkWhitelist: true
};

// 初始化 i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: initialResources,
    
    // 默认语言
    fallbackLng: 'zh',
    
    // 支持的语言白名单
    supportedLngs: SUPPORTED_LANGUAGES.map(lang => lang.code),
    
    // 语言检测配置
    detection: languageDetectorOptions,
    
    // 调试模式（开发环境）
    debug: process.env.NODE_ENV === 'development',
    
    // 插值配置
    interpolation: {
      escapeValue: false // React 已经处理了 XSS
    },
    
    // 默认命名空间
    defaultNS: 'common',
    
    // 命名空间分隔符
    nsSeparator: ':',
    
    // 键分隔符
    keySeparator: '.',
    
    // 复数规则
    pluralSeparator: '_',
    
    // 上下文分隔符
    contextSeparator: '_',
    
    // 懒加载配置
    load: 'languageOnly', // 只加载语言，不加载地区变体
    
    // 预加载命名空间
    preload: ['zh', 'en'], // 预加载中英文
    
    // React 配置
    react: {
      // 使用 Suspense
      useSuspense: true,
      
      // 绑定 i18n 实例到组件
      bindI18n: 'languageChanged',
      
      // 绑定 i18n 存储到组件
      bindI18nStore: 'added removed',
      
      // 转义传递给 Trans 组件的值
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span']
    },
    
    // 保存缺失的键
    saveMissing: process.env.NODE_ENV === 'development',
    
    // 缺失键处理
    missingKeyHandler: (lng, ns, key) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Missing translation key: ${lng}:${ns}:${key}`);
      }
    }
  });

// 语言切换函数（支持懒加载）
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  try {
    // 确保目标语言的资源已加载
    await loadLanguageResources(language, ['common', 'chat', 'settings']);
    
    // 切换语言
    await i18n.changeLanguage(language);
    
    // 保存到 localStorage
    localStorage.setItem('zishu-language', language);
    
    // 智能预加载相关资源
    await smartPreload(language);
    
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language } 
    }));
    
    console.log(`Language changed to: ${language}`);
  } catch (error) {
    console.error('Failed to change language:', error);
    throw error;
  }
};

// 获取当前语言
export const getCurrentLanguage = (): SupportedLanguage => {
  return i18n.language as SupportedLanguage;
};

// 获取语言信息
export const getLanguageInfo = (code: SupportedLanguage) => {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
};

// 检测系统语言
export const detectSystemLanguage = (): SupportedLanguage => {
  const systemLang = navigator.language.toLowerCase();
  
  // 精确匹配
  for (const lang of SUPPORTED_LANGUAGES) {
    if (systemLang === lang.code) {
      return lang.code;
    }
  }
  
  // 前缀匹配
  for (const lang of SUPPORTED_LANGUAGES) {
    if (systemLang.startsWith(lang.code)) {
      return lang.code;
    }
  }
  
  // 特殊处理
  if (systemLang.startsWith('zh')) {
    return 'zh';
  }
  
  // 默认返回中文
  return 'zh';
};

// 格式化相对时间
export const formatRelativeTime = (date: Date, locale?: string): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const currentLocale = locale || getCurrentLanguage();
  
  if (diffMinutes < 1) {
    return i18n.t('time.now');
  } else if (diffMinutes < 60) {
    return i18n.t('time.minutesAgo', { count: diffMinutes });
  } else if (diffHours < 24) {
    return i18n.t('time.hoursAgo', { count: diffHours });
  } else if (diffDays < 7) {
    return i18n.t('time.daysAgo', { count: diffDays });
  } else {
    // 使用本地化日期格式
    return new Intl.DateTimeFormat(currentLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }
};

// 初始化懒加载系统
const initializeLazyLoading = async () => {
  try {
    const currentLang = getCurrentLanguage();
    
    // 启动缓存清理
    startCacheCleanup();
    
    // 智能预加载当前语言资源
    await smartPreload(currentLang);
    
    console.log('I18n lazy loading system initialized');
  } catch (error) {
    console.error('Failed to initialize i18n lazy loading:', error);
  }
};

// 在应用启动时初始化
if (typeof window !== 'undefined') {
  // 延迟初始化，避免阻塞应用启动
  setTimeout(initializeLazyLoading, 1000);
}

// 导出懒加载相关函数
export {
  loadLanguageResources,
  preloadLanguageResources,
  smartPreload,
  startCacheCleanup
} from '../utils/i18nLoader';

// 导出 i18n 实例
export default i18n;
