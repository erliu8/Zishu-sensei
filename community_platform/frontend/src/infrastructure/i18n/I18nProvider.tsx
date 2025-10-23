'use client';

/**
 * I18n Provider - 国际化上下文提供者
 */

import React, { createContext, useCallback, useEffect, useState } from 'react';
import type { Locale, I18nContext } from './types';
import {
  DEFAULT_LOCALE,
  getBrowserLocale,
  getAllLocalesInfo,
} from './config';
import {
  getStoredLocale,
  setStoredLocale,
  setLocaleToCookie,
  formatMessage,
  getNestedValue,
  getDirection,
} from './utils';

/**
 * I18n 上下文
 */
export const I18nContext = createContext<I18nContext | null>(null);

/**
 * Provider Props
 */
interface I18nProviderProps {
  children: React.ReactNode;
  /** 初始语言 */
  initialLocale?: Locale;
  /** 翻译数据 */
  messages: Record<string, any>;
}

/**
 * I18n Provider 组件
 */
export function I18nProvider({
  children,
  initialLocale,
  messages,
}: I18nProviderProps) {
  // 确定初始语言：优先级为 initialLocale > 存储的语言 > 浏览器语言 > 默认语言
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale) {
      return initialLocale;
    }
    const stored = getStoredLocale();
    if (stored) {
      return stored;
    }
    return getBrowserLocale();
  });

  const [currentMessages, setCurrentMessages] =
    useState<Record<string, any>>(messages);

  /**
   * 切换语言
   */
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
    setLocaleToCookie(newLocale);

    // 更新 HTML lang 属性
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
      document.documentElement.dir = getDirection(newLocale);
    }

    // 动态加载翻译文件
    loadMessages(newLocale);
  }, []);

  /**
   * 动态加载翻译文件
   */
  const loadMessages = async (locale: Locale) => {
    try {
      // 加载所有翻译文件
      const modules = await Promise.all([
        import(`./locales/${locale}/common.json`),
        import(`./locales/${locale}/auth.json`),
        import(`./locales/${locale}/post.json`),
        import(`./locales/${locale}/adapter.json`),
        import(`./locales/${locale}/character.json`),
        import(`./locales/${locale}/comment.json`),
        import(`./locales/${locale}/social.json`),
        import(`./locales/${locale}/search.json`),
        import(`./locales/${locale}/notification.json`),
        import(`./locales/${locale}/packaging.json`),
        import(`./locales/${locale}/profile.json`),
        import(`./locales/${locale}/settings.json`),
        import(`./locales/${locale}/validation.json`),
        import(`./locales/${locale}/error.json`),
      ]);

      const [
        common,
        auth,
        post,
        adapter,
        character,
        comment,
        social,
        search,
        notification,
        packaging,
        profile,
        settings,
        validation,
        error,
      ] = modules;

      setCurrentMessages({
        common: common.default,
        auth: auth.default,
        post: post.default,
        adapter: adapter.default,
        character: character.default,
        comment: comment.default,
        social: social.default,
        search: search.default,
        notification: notification.default,
        packaging: packaging.default,
        profile: profile.default,
        settings: settings.default,
        validation: validation.default,
        error: error.default,
      });
    } catch (error) {
      console.error(`Failed to load messages for locale ${locale}:`, error);
    }
  };

  /**
   * 翻译函数
   */
  const t = useCallback(
    (key: string, values?: Record<string, string | number>): string => {
      // 支持 namespace.key 格式，例如 "common.welcome"
      const value = getNestedValue(currentMessages, key);

      if (!value) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }

      return formatMessage(value, values);
    },
    [currentMessages]
  );

  /**
   * 初始化时设置语言属性
   */
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = getDirection(locale);
    }
  }, [locale]);

  /**
   * 当 locale 变化时重新加载翻译
   */
  useEffect(() => {
    if (locale !== initialLocale) {
      loadMessages(locale);
    }
  }, [locale, initialLocale]);

  const contextValue: I18nContext = {
    locale,
    t,
    setLocale,
    locales: getAllLocalesInfo(),
  };

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
}

