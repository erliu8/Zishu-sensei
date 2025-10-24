/**
 * 字符串工具函数单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  capitalize,
  camelToKebab,
  kebabToCamel,
  snakeToCamel,
  camelToSnake,
  randomString,
  stripHtml,
  escapeHtml,
  unescapeHtml,
  getByteLength,
  highlightKeyword,
  extractDomain,
  slugify,
  countOccurrences,
} from '../string';

describe('string utils', () => {
  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should lowercase other letters', () => {
      expect(capitalize('hELLO')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });
  });

  describe('camelToKebab', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(camelToKebab('helloWorld')).toBe('hello-world');
    });

    it('should handle multiple uppercase letters', () => {
      expect(camelToKebab('helloWorldFoo')).toBe('hello-world-foo');
    });

    it('should handle numbers', () => {
      expect(camelToKebab('hello2World')).toBe('hello2-world');
    });

    it('should handle already lowercase', () => {
      expect(camelToKebab('hello')).toBe('hello');
    });
  });

  describe('kebabToCamel', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(kebabToCamel('hello-world')).toBe('helloWorld');
    });

    it('should handle multiple hyphens', () => {
      expect(kebabToCamel('hello-world-foo')).toBe('helloWorldFoo');
    });

    it('should handle no hyphens', () => {
      expect(kebabToCamel('hello')).toBe('hello');
    });
  });

  describe('snakeToCamel', () => {
    it('should convert snake_case to camelCase', () => {
      expect(snakeToCamel('hello_world')).toBe('helloWorld');
    });

    it('should handle multiple underscores', () => {
      expect(snakeToCamel('hello_world_foo')).toBe('helloWorldFoo');
    });

    it('should handle no underscores', () => {
      expect(snakeToCamel('hello')).toBe('hello');
    });
  });

  describe('camelToSnake', () => {
    it('should convert camelCase to snake_case', () => {
      expect(camelToSnake('helloWorld')).toBe('hello_world');
    });

    it('should handle multiple uppercase letters', () => {
      expect(camelToSnake('helloWorldFoo')).toBe('hello_world_foo');
    });

    it('should handle numbers', () => {
      expect(camelToSnake('hello2World')).toBe('hello2_world');
    });
  });

  describe('randomString', () => {
    it('should generate string of specified length', () => {
      const result = randomString(10);
      expect(result).toHaveLength(10);
    });

    it('should generate different strings', () => {
      const str1 = randomString(10);
      const str2 = randomString(10);
      expect(str1).not.toBe(str2);
    });

    it('should use custom character set', () => {
      const result = randomString(10, 'ABC');
      expect(result).toMatch(/^[ABC]+$/);
    });

    it('should handle zero length', () => {
      const result = randomString(0);
      expect(result).toBe('');
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('should handle self-closing tags', () => {
      expect(stripHtml('Hello<br/>World')).toBe('HelloWorld');
    });

    it('should handle nested tags', () => {
      expect(stripHtml('<div><p><span>Hello</span></p></div>')).toBe('Hello');
    });

    it('should handle no tags', () => {
      expect(stripHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('escapeHtml', () => {
    it('should escape < and >', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"Hello"')).toBe('&quot;Hello&quot;');
    });

    it('should escape ampersand', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('should escape single quote', () => {
      expect(escapeHtml("It's")).toBe('It&#39;s');
    });

    it('should escape all special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });
  });

  describe('unescapeHtml', () => {
    it('should unescape HTML entities', () => {
      expect(unescapeHtml('&lt;script&gt;')).toBe('<script>');
    });

    it('should unescape quotes', () => {
      expect(unescapeHtml('&quot;Hello&quot;')).toBe('"Hello"');
    });

    it('should unescape ampersand', () => {
      expect(unescapeHtml('A &amp; B')).toBe('A & B');
    });

    it('should unescape single quote', () => {
      expect(unescapeHtml('It&#39;s')).toBe("It's");
    });
  });

  describe('getByteLength', () => {
    it('should count ASCII characters as 1 byte', () => {
      expect(getByteLength('hello')).toBe(5);
    });

    it('should count Chinese characters as 2 bytes', () => {
      expect(getByteLength('你好')).toBe(4);
    });

    it('should count mixed characters correctly', () => {
      expect(getByteLength('hello你好')).toBe(9);
    });

    it('should handle empty string', () => {
      expect(getByteLength('')).toBe(0);
    });
  });

  describe('highlightKeyword', () => {
    it('should highlight keyword with default tag', () => {
      const result = highlightKeyword('Hello World', 'World');
      expect(result).toBe('Hello <mark>World</mark>');
    });

    it('should highlight keyword with custom tag', () => {
      const result = highlightKeyword('Hello World', 'World', 'span');
      expect(result).toBe('Hello <span>World</span>');
    });

    it('should be case insensitive', () => {
      const result = highlightKeyword('Hello World', 'world');
      expect(result).toBe('Hello <mark>World</mark>');
    });

    it('should highlight multiple occurrences', () => {
      const result = highlightKeyword('Hello Hello', 'Hello');
      expect(result).toBe('<mark>Hello</mark> <mark>Hello</mark>');
    });

    it('should handle empty keyword', () => {
      const result = highlightKeyword('Hello World', '');
      expect(result).toBe('Hello World');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
    });

    it('should handle URL without www', () => {
      expect(extractDomain('https://example.com')).toBe('example.com');
    });

    it('should handle URL with port', () => {
      expect(extractDomain('https://example.com:8080/path')).toBe('example.com');
    });

    it('should handle http protocol', () => {
      expect(extractDomain('http://example.com')).toBe('example.com');
    });

    it('should return empty string for invalid URL', () => {
      expect(extractDomain('not-a-url')).toBe('');
    });
  });

  describe('slugify', () => {
    it('should convert string to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Hello   World')).toBe('hello-world');
    });

    it('should trim hyphens', () => {
      expect(slugify('-Hello World-')).toBe('hello-world');
    });

    it('should replace underscores with hyphens', () => {
      expect(slugify('hello_world')).toBe('hello-world');
    });
  });

  describe('countOccurrences', () => {
    it('should count occurrences of substring', () => {
      expect(countOccurrences('hello hello', 'hello')).toBe(2);
    });

    it('should return 0 for no occurrences', () => {
      expect(countOccurrences('hello world', 'foo')).toBe(0);
    });

    it('should handle empty substring', () => {
      expect(countOccurrences('hello', '')).toBe(0);
    });

    it('should handle overlapping matches', () => {
      expect(countOccurrences('aaa', 'aa')).toBe(2);
    });
  });
});

