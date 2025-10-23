/**
 * 语言切换组件
 */

'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '../hooks';
import { SUPPORTED_LOCALES, getLocaleInfo } from '../config';
import type { Locale } from '../types';

/**
 * 语言切换组件属性
 */
export interface LanguageSwitcherProps {
  /** 组件类型 */
  variant?: 'dropdown' | 'modal' | 'inline';
  /** 是否显示国旗 */
  showFlag?: boolean;
  /** 是否显示语言名称 */
  showName?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 切换语言后的回调 */
  onChange?: (locale: Locale) => void;
}

/**
 * 语言切换组件
 * 
 * @example
 * ```tsx
 * // 下拉菜单形式
 * <LanguageSwitcher variant="dropdown" />
 * 
 * // 内联形式
 * <LanguageSwitcher variant="inline" showFlag showName />
 * 
 * // 模态框形式
 * <LanguageSwitcher variant="modal" />
 * ```
 */
export function LanguageSwitcher({
  variant = 'dropdown',
  showFlag = true,
  showName = true,
  className = '',
  style,
  onChange,
}: LanguageSwitcherProps) {
  const { locale: currentLocale, changeLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const handleChangeLocale = useCallback(
    (newLocale: Locale) => {
      changeLocale(newLocale);
      setIsOpen(false);
      onChange?.(newLocale);
    },
    [changeLocale, onChange]
  );

  const currentLocaleInfo = getLocaleInfo(currentLocale);

  if (variant === 'inline') {
    return (
      <div
        className={`flex items-center gap-2 ${className}`}
        style={style}
      >
        {SUPPORTED_LOCALES.map((locale) => {
          const localeInfo = getLocaleInfo(locale);
          const isActive = locale === currentLocale;

          return (
            <button
              key={locale}
              onClick={() => handleChangeLocale(locale)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md
                transition-colors duration-200
                ${isActive
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
              aria-label={`切换到${localeInfo.name}`}
              aria-current={isActive ? 'true' : undefined}
            >
              {showFlag && <span className="text-lg">{localeInfo.flag}</span>}
              {showName && (
                <span className="text-sm font-medium">{localeInfo.name}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-md
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors duration-200
            ${className}
          `}
          style={style}
          aria-label="切换语言"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          {showFlag && <span className="text-lg">{currentLocaleInfo.flag}</span>}
          {showName && (
            <span className="text-sm font-medium">{currentLocaleInfo.name}</span>
          )}
        </button>

        {isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="language-modal-title"
            >
              <h2
                id="language-modal-title"
                className="text-xl font-semibold mb-4"
              >
                选择语言 / Select Language
              </h2>
              <div className="space-y-2">
                {SUPPORTED_LOCALES.map((locale) => {
                  const localeInfo = getLocaleInfo(locale);
                  const isActive = locale === currentLocale;

                  return (
                    <button
                      key={locale}
                      onClick={() => handleChangeLocale(locale)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-md
                        transition-colors duration-200
                        ${isActive
                          ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }
                      `}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <span className="text-2xl">{localeInfo.flag}</span>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{localeInfo.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {localeInfo.nameEn}
                        </span>
                      </div>
                      {isActive && (
                        <svg
                          className="ml-auto w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                关闭 / Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 默认: dropdown 形式
  return (
    <div className={`relative ${className}`} style={style}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-3 py-2 rounded-md
          hover:bg-gray-100 dark:hover:bg-gray-800
          transition-colors duration-200
        "
        aria-label="切换语言"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {showFlag && <span className="text-lg">{currentLocaleInfo.flag}</span>}
        {showName && (
          <span className="text-sm font-medium">{currentLocaleInfo.name}</span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="
              absolute right-0 mt-2 w-48 z-20
              bg-white dark:bg-gray-900
              rounded-md shadow-lg border border-gray-200 dark:border-gray-700
              py-1
            "
            role="listbox"
            aria-label="语言选项"
          >
            {SUPPORTED_LOCALES.map((locale) => {
              const localeInfo = getLocaleInfo(locale);
              const isActive = locale === currentLocale;

              return (
                <button
                  key={locale}
                  onClick={() => handleChangeLocale(locale)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2
                    transition-colors duration-200
                    ${isActive
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                  role="option"
                  aria-selected={isActive}
                >
                  <span className="text-lg">{localeInfo.flag}</span>
                  <span className="text-sm">{localeInfo.name}</span>
                  {isActive && (
                    <svg
                      className="ml-auto w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default LanguageSwitcher;
