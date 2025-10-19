import i18n from 'i18next';
import { SupportedLanguage } from '../locales';

// 语言包缓存
const languageCache = new Map<string, any>();

// 加载状态跟踪
const loadingPromises = new Map<string, Promise<any>>();

// 支持的命名空间
export const SUPPORTED_NAMESPACES = ['common', 'chat', 'settings'] as const;
export type SupportedNamespace = typeof SUPPORTED_NAMESPACES[number];

/**
 * 懒加载语言包
 */
export const loadLanguageResources = async (
  language: SupportedLanguage,
  namespaces: SupportedNamespace[] = ['common']
): Promise<void> => {
  const loadPromises = namespaces.map(namespace => 
    loadNamespaceResource(language, namespace)
  );
  
  await Promise.all(loadPromises);
};

/**
 * 加载单个命名空间的语言资源
 */
export const loadNamespaceResource = async (
  language: SupportedLanguage,
  namespace: SupportedNamespace
): Promise<any> => {
  const cacheKey = `${language}:${namespace}`;
  
  // 检查缓存
  if (languageCache.has(cacheKey)) {
    return languageCache.get(cacheKey);
  }
  
  // 检查是否正在加载
  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey);
  }
  
  // 创建加载 Promise
  const loadPromise = loadResourceFromFile(language, namespace);
  loadingPromises.set(cacheKey, loadPromise);
  
  try {
    const resource = await loadPromise;
    
    // 缓存资源
    languageCache.set(cacheKey, resource);
    
    // 添加到 i18n 实例
    i18n.addResourceBundle(language, namespace, resource, true, true);
    
    console.log(`Loaded language resource: ${language}:${namespace}`);
    return resource;
  } catch (error) {
    console.error(`Failed to load language resource: ${language}:${namespace}`, error);
    throw error;
  } finally {
    // 清理加载状态
    loadingPromises.delete(cacheKey);
  }
};

/**
 * 从文件加载语言资源
 */
const loadResourceFromFile = async (
  language: SupportedLanguage,
  namespace: SupportedNamespace
): Promise<any> => {
  try {
    // 动态导入语言文件
    const module = await import(`../locales/${language}/${namespace}.json`);
    return module.default || module;
  } catch (error) {
    console.warn(`Failed to load ${language}/${namespace}.json, falling back to default`);
    
    // 回退到默认语言（中文）
    if (language !== 'zh') {
      try {
        const fallbackModule = await import(`../locales/zh/${namespace}.json`);
        return fallbackModule.default || fallbackModule;
      } catch (fallbackError) {
        console.error(`Failed to load fallback resource: zh/${namespace}.json`, fallbackError);
        return {};
      }
    }
    
    return {};
  }
};

/**
 * 预加载语言资源
 */
export const preloadLanguageResources = async (
  languages: SupportedLanguage[],
  namespaces: SupportedNamespace[] = ['common']
): Promise<void> => {
  const preloadPromises: Promise<void>[] = [];
  
  for (const language of languages) {
    for (const namespace of namespaces) {
      preloadPromises.push(
        loadNamespaceResource(language, namespace).catch(error => {
          console.warn(`Failed to preload ${language}:${namespace}`, error);
        })
      );
    }
  }
  
  await Promise.all(preloadPromises);
  console.log(`Preloaded ${languages.length} languages with ${namespaces.length} namespaces`);
};

/**
 * 清理语言缓存
 */
export const clearLanguageCache = (
  language?: SupportedLanguage,
  namespace?: SupportedNamespace
): void => {
  if (language && namespace) {
    const cacheKey = `${language}:${namespace}`;
    languageCache.delete(cacheKey);
    loadingPromises.delete(cacheKey);
  } else if (language) {
    // 清理特定语言的所有缓存
    for (const key of languageCache.keys()) {
      if (key.startsWith(`${language}:`)) {
        languageCache.delete(key);
      }
    }
    for (const key of loadingPromises.keys()) {
      if (key.startsWith(`${language}:`)) {
        loadingPromises.delete(key);
      }
    }
  } else {
    // 清理所有缓存
    languageCache.clear();
    loadingPromises.clear();
  }
};

/**
 * 获取缓存统计信息
 */
export const getCacheStats = () => {
  return {
    cachedResources: languageCache.size,
    loadingResources: loadingPromises.size,
    cacheKeys: Array.from(languageCache.keys()),
    loadingKeys: Array.from(loadingPromises.keys())
  };
};

/**
 * 检查资源是否已加载
 */
export const isResourceLoaded = (
  language: SupportedLanguage,
  namespace: SupportedNamespace
): boolean => {
  const cacheKey = `${language}:${namespace}`;
  return languageCache.has(cacheKey) || i18n.hasResourceBundle(language, namespace);
};

/**
 * 批量加载多个语言的资源
 */
export const loadMultipleLanguageResources = async (
  requests: Array<{
    language: SupportedLanguage;
    namespaces: SupportedNamespace[];
  }>
): Promise<void> => {
  const loadPromises = requests.flatMap(({ language, namespaces }) =>
    namespaces.map(namespace => loadNamespaceResource(language, namespace))
  );
  
  await Promise.all(loadPromises);
};

/**
 * 智能预加载 - 基于用户行为预测需要的资源
 */
export const smartPreload = async (
  currentLanguage: SupportedLanguage,
  userPreferences?: {
    frequentNamespaces?: SupportedNamespace[];
    fallbackLanguages?: SupportedLanguage[];
  }
): Promise<void> => {
  const { 
    frequentNamespaces = ['common', 'chat'], 
    fallbackLanguages = ['en'] 
  } = userPreferences || {};
  
  // 预加载当前语言的常用命名空间
  await loadLanguageResources(currentLanguage, frequentNamespaces);
  
  // 预加载回退语言的基础资源
  for (const fallbackLang of fallbackLanguages) {
    if (fallbackLang !== currentLanguage) {
      await loadNamespaceResource(fallbackLang, 'common').catch(error => {
        console.warn(`Failed to preload fallback language ${fallbackLang}`, error);
      });
    }
  }
};

/**
 * 资源加载中间件 - 确保在使用前加载必要的资源
 */
export const ensureResourcesLoaded = async (
  language: SupportedLanguage,
  namespaces: SupportedNamespace[]
): Promise<void> => {
  const missingResources = namespaces.filter(
    namespace => !isResourceLoaded(language, namespace)
  );
  
  if (missingResources.length > 0) {
    console.log(`Loading missing resources for ${language}:`, missingResources);
    await loadLanguageResources(language, missingResources);
  }
};

/**
 * 创建资源加载器 Hook
 */
export const createResourceLoader = (
  defaultLanguage: SupportedLanguage = 'zh',
  defaultNamespaces: SupportedNamespace[] = ['common']
) => {
  return {
    loadResources: (language?: SupportedLanguage, namespaces?: SupportedNamespace[]) =>
      loadLanguageResources(
        language || defaultLanguage,
        namespaces || defaultNamespaces
      ),
    
    preloadResources: (languages?: SupportedLanguage[], namespaces?: SupportedNamespace[]) =>
      preloadLanguageResources(
        languages || [defaultLanguage],
        namespaces || defaultNamespaces
      ),
    
    clearCache: clearLanguageCache,
    getCacheStats,
    isLoaded: isResourceLoaded
  };
};

// 默认资源加载器实例
export const defaultResourceLoader = createResourceLoader();

// 自动清理缓存 - 定期清理未使用的资源
let cleanupInterval: NodeJS.Timeout | null = null;

export const startCacheCleanup = (intervalMs: number = 300000) => { // 5分钟
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  cleanupInterval = setInterval(() => {
    const stats = getCacheStats();
    console.log('Language cache stats:', stats);
    
    // 这里可以实现更复杂的清理逻辑
    // 例如：清理长时间未使用的资源
  }, intervalMs);
};

export const stopCacheCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};
