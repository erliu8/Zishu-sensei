/**
 * I18n - 国际化模块导出
 */

// 配置
export * from './config';

// 类型
export * from './types';

// Provider
export { I18nProvider } from './I18nProvider';

// Hooks
export {
  useI18n,
  useTranslation,
  type UseI18nReturn,
  type UseTranslationReturn,
  type TranslateFn,
  type Namespace,
} from './hooks';

// Components
export {
  LanguageSwitcher,
  type LanguageSwitcherProps,
} from './components';

// Utils
export * from './utils';

