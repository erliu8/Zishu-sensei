import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  SupportedLanguage, 
  SUPPORTED_LANGUAGES, 
  changeLanguage, 
  getCurrentLanguage, 
  getLanguageInfo,
  detectSystemLanguage 
} from '../locales';
import { useSettings } from './useSettings';
import { useTauriCommand } from './useTauriCommand';

interface LanguageState {
  currentLanguage: SupportedLanguage;
  isChanging: boolean;
  error: string | null;
}

interface UseLanguageReturn {
  // 状态
  currentLanguage: SupportedLanguage;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  isChanging: boolean;
  error: string | null;
  
  // 方法
  changeLanguage: (language: SupportedLanguage) => Promise<void>;
  resetToSystem: () => Promise<void>;
  getLanguageInfo: (code: SupportedLanguage) => typeof SUPPORTED_LANGUAGES[number] | undefined;
  
  // i18n 方法
  t: (key: string, options?: any) => string;
  i18n: any;
}

export const useLanguage = (): UseLanguageReturn => {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { execute: saveLanguageToBackend } = useTauriCommand('save_language_setting');
  
  const [state, setState] = useState<LanguageState>({
    currentLanguage: getCurrentLanguage(),
    isChanging: false,
    error: null
  });

  // 监听语言变化事件
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      setState(prev => ({
        ...prev,
        currentLanguage: event.detail.language,
        isChanging: false,
        error: null
      }));
    };

    window.addEventListener('languageChanged', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, []);

  // 同步设置中的语言
  useEffect(() => {
    if (settings.language && settings.language !== state.currentLanguage) {
      handleChangeLanguage(settings.language as SupportedLanguage);
    }
  }, [settings.language]);

  // 切换语言
  const handleChangeLanguage = useCallback(async (language: SupportedLanguage) => {
    if (language === state.currentLanguage) {
      return;
    }

    setState(prev => ({
      ...prev,
      isChanging: true,
      error: null
    }));

    try {
      // 切换 i18n 语言
      await changeLanguage(language);
      
      // 保存到设置
      await updateSettings({
        ...settings,
        language
      });
      
      // 保存到后端
      try {
        await saveLanguageToBackend({ language });
      } catch (backendError) {
        console.warn('Failed to save language to backend:', backendError);
        // 不阻塞前端切换
      }
      
      setState(prev => ({
        ...prev,
        currentLanguage: language,
        isChanging: false
      }));
      
    } catch (error) {
      console.error('Failed to change language:', error);
      setState(prev => ({
        ...prev,
        isChanging: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      throw error;
    }
  }, [state.currentLanguage, settings, updateSettings, saveLanguageToBackend]);

  // 重置为系统语言
  const resetToSystem = useCallback(async () => {
    const systemLanguage = detectSystemLanguage();
    await handleChangeLanguage(systemLanguage);
  }, [handleChangeLanguage]);

  // 获取语言信息
  const getLanguageInfoWrapper = useCallback((code: SupportedLanguage) => {
    return getLanguageInfo(code);
  }, []);

  return {
    // 状态
    currentLanguage: state.currentLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isChanging: state.isChanging,
    error: state.error,
    
    // 方法
    changeLanguage: handleChangeLanguage,
    resetToSystem,
    getLanguageInfo: getLanguageInfoWrapper,
    
    // i18n 方法
    t,
    i18n
  };
};

// 语言设置 Hook
export const useLanguageSettings = () => {
  const { currentLanguage, supportedLanguages, changeLanguage, resetToSystem } = useLanguage();
  const { t } = useTranslation('settings');
  
  return {
    currentLanguage,
    supportedLanguages,
    changeLanguage,
    resetToSystem,
    
    // 设置相关的翻译
    labels: {
      language: t('general.language'),
      selectLanguage: t('general.language'),
      resetToSystem: t('actions.reset')
    }
  };
};

// 语言检测 Hook
export const useLanguageDetection = () => {
  const [detectedLanguage, setDetectedLanguage] = useState<SupportedLanguage | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  
  const detectLanguage = useCallback(async () => {
    setIsDetecting(true);
    try {
      const detected = detectSystemLanguage();
      setDetectedLanguage(detected);
      return detected;
    } catch (error) {
      console.error('Language detection failed:', error);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);
  
  useEffect(() => {
    detectLanguage();
  }, [detectLanguage]);
  
  return {
    detectedLanguage,
    isDetecting,
    detectLanguage
  };
};

// 翻译 Hook（简化版）
export const useT = (namespace?: string) => {
  const { t } = useTranslation(namespace);
  return t;
};

// 多命名空间翻译 Hook
export const useMultiT = (namespaces: string[]) => {
  const { t } = useTranslation(namespaces);
  return t;
};
