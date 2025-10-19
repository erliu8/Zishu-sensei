import React, { Suspense, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { SupportedLanguage, loadLanguageResources } from '../../locales';
import { SupportedNamespace } from '../../utils/i18nLoader';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

interface I18nProviderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredNamespaces?: SupportedNamespace[];
  preloadLanguages?: SupportedLanguage[];
}

const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  fallback,
  requiredNamespaces = ['common'],
  preloadLanguages = ['zh', 'en']
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeI18n = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 获取当前语言
        const currentLanguage = i18n.language as SupportedLanguage || 'zh';

        // 加载当前语言的必需命名空间
        await loadLanguageResources(currentLanguage, requiredNamespaces);

        // 预加载其他语言的基础资源
        const preloadPromises = preloadLanguages
          .filter(lang => lang !== currentLanguage)
          .map(lang => 
            loadLanguageResources(lang, ['common']).catch(err => {
              console.warn(`Failed to preload language ${lang}:`, err);
            })
          );

        await Promise.all(preloadPromises);

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize i18n:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    initializeI18n();
  }, [requiredNamespaces, preloadLanguages]);

  // 监听语言变化
  useEffect(() => {
    const handleLanguageChange = async (event: CustomEvent) => {
      const { language } = event.detail;
      
      try {
        setIsLoading(true);
        await loadLanguageResources(language, requiredNamespaces);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load language resources:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    window.addEventListener('languageChanged', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, [requiredNamespaces]);

  if (error) {
    return (
      <div className="i18n-error">
        <h3>语言加载失败</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          刷新页面
        </button>
      </div>
    );
  }

  if (isLoading) {
    return fallback || <LoadingSpinner message="正在加载语言包..." />;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={fallback || <LoadingSpinner message="正在切换语言..." />}>
        {children}
      </Suspense>
    </I18nextProvider>
  );
};

export default I18nProvider;
