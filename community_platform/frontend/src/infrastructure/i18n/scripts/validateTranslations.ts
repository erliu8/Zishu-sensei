/**
 * 翻译文件验证脚本
 * 检查所有语言的翻译文件是否完整
 */

import { SUPPORTED_LOCALES } from '../config';
import type { Locale } from '../types';

/**
 * 翻译文件名列表
 */
const TRANSLATION_FILES = [
  'common',
  'auth',
  'user',
  'post',
  'adapter',
  'character',
  'comment',
  'social',
  'settings',
  'error',
  'validation',
  'notification',
  'packaging',
  'profile',
  'search',
] as const;

/**
 * 获取对象的所有键路径
 */
function getKeyPaths(obj: any, prefix = ''): string[] {
  const paths: string[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...getKeyPaths(value, path));
    } else {
      paths.push(path);
    }
  }
  
  return paths;
}

/**
 * 验证翻译完整性
 */
export async function validateTranslations() {
  console.log('🔍 开始验证翻译文件...\n');
  
  const results: {
    locale: Locale;
    file: string;
    status: 'ok' | 'missing' | 'extra' | 'error';
    missingKeys?: string[];
    extraKeys?: string[];
    error?: string;
  }[] = [];
  
  // 使用第一个语言作为基准
  const baseLocale: Locale = 'zh-CN';
  const baseTranslations: Record<string, any> = {};
  
  // 加载基准语言的所有翻译文件
  for (const file of TRANSLATION_FILES) {
    try {
      const module = await import(`../locales/${baseLocale}/${file}.json`);
      baseTranslations[file] = module.default;
    } catch (error) {
      console.error(`❌ 无法加载基准文件: ${baseLocale}/${file}.json`);
      results.push({
        locale: baseLocale,
        file,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  // 验证每个语言的翻译文件
  for (const locale of SUPPORTED_LOCALES) {
    console.log(`📋 验证 ${locale} 的翻译文件...`);
    
    for (const file of TRANSLATION_FILES) {
      try {
        const module = await import(`../locales/${locale}/${file}.json`);
        const translation = module.default;
        
        // 如果是基准语言,跳过
        if (locale === baseLocale) {
          results.push({
            locale,
            file,
            status: 'ok',
          });
          continue;
        }
        
        // 获取所有键路径
        const baseKeys = new Set(getKeyPaths(baseTranslations[file]));
        const translationKeys = new Set(getKeyPaths(translation));
        
        // 检查缺失的键
        const missingKeys = Array.from(baseKeys).filter(
          (key) => !translationKeys.has(key)
        );
        
        // 检查多余的键
        const extraKeys = Array.from(translationKeys).filter(
          (key) => !baseKeys.has(key)
        );
        
        if (missingKeys.length > 0 || extraKeys.length > 0) {
          results.push({
            locale,
            file,
            status: missingKeys.length > 0 ? 'missing' : 'extra',
            missingKeys: missingKeys.length > 0 ? missingKeys : undefined,
            extraKeys: extraKeys.length > 0 ? extraKeys : undefined,
          });
          
          if (missingKeys.length > 0) {
            console.log(`  ⚠️  ${file}.json 缺少 ${missingKeys.length} 个键`);
          }
          if (extraKeys.length > 0) {
            console.log(`  ⚠️  ${file}.json 有 ${extraKeys.length} 个多余的键`);
          }
        } else {
          results.push({
            locale,
            file,
            status: 'ok',
          });
          console.log(`  ✅ ${file}.json 完整`);
        }
      } catch (error) {
        console.error(`  ❌ 无法加载 ${locale}/${file}.json`);
        results.push({
          locale,
          file,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    console.log('');
  }
  
  // 输出汇总
  console.log('📊 验证汇总:');
  console.log('─'.repeat(60));
  
  const summary: Record<Locale, { ok: number; missing: number; extra: number; error: number }> = {
    'zh-CN': { ok: 0, missing: 0, extra: 0, error: 0 },
    'en-US': { ok: 0, missing: 0, extra: 0, error: 0 },
    'ja-JP': { ok: 0, missing: 0, extra: 0, error: 0 },
  };
  
  for (const result of results) {
    summary[result.locale][result.status]++;
  }
  
  for (const locale of SUPPORTED_LOCALES) {
    const { ok, missing, extra, error } = summary[locale];
    const total = TRANSLATION_FILES.length;
    const status = ok === total ? '✅' : '⚠️';
    
    console.log(
      `${status} ${locale}: ${ok}/${total} 完整, ${missing} 缺失, ${extra} 多余, ${error} 错误`
    );
  }
  
  console.log('─'.repeat(60));
  
  // 详细报告
  const problemResults = results.filter((r) => r.status !== 'ok');
  
  if (problemResults.length > 0) {
    console.log('\n⚠️  发现问题:');
    console.log('─'.repeat(60));
    
    for (const result of problemResults) {
      console.log(`\n${result.locale}/${result.file}.json:`);
      
      if (result.error) {
        console.log(`  ❌ 错误: ${result.error}`);
      }
      
      if (result.missingKeys && result.missingKeys.length > 0) {
        console.log(`  缺少的键 (${result.missingKeys.length}):`);
        result.missingKeys.slice(0, 10).forEach((key) => {
          console.log(`    - ${key}`);
        });
        if (result.missingKeys.length > 10) {
          console.log(`    ... 还有 ${result.missingKeys.length - 10} 个`);
        }
      }
      
      if (result.extraKeys && result.extraKeys.length > 0) {
        console.log(`  多余的键 (${result.extraKeys.length}):`);
        result.extraKeys.slice(0, 10).forEach((key) => {
          console.log(`    - ${key}`);
        });
        if (result.extraKeys.length > 10) {
          console.log(`    ... 还有 ${result.extraKeys.length - 10} 个`);
        }
      }
    }
  } else {
    console.log('\n✅ 所有翻译文件都是完整的!');
  }
  
  return results;
}

// 如果直接运行此脚本
if (require.main === module) {
  validateTranslations()
    .then(() => {
      console.log('\n✅ 验证完成!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 验证失败:', error);
      process.exit(1);
    });
}

