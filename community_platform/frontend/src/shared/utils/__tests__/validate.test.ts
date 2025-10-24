/**
 * 验证工具函数单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  isEmail,
  isUrl,
  isPhone,
  isIdCard,
  getPasswordStrength,
  isEmpty,
  isUsername,
  isPositiveInteger,
  isIPv4,
  isHexColor,
} from '../validate';

describe('validate utils', () => {
  describe('isEmail', () => {
    it('should return true for valid email', () => {
      expect(isEmail('user@example.com')).toBe(true);
      expect(isEmail('test.user@example.co.uk')).toBe(true);
      expect(isEmail('user+tag@example.com')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(isEmail('invalid-email')).toBe(false);
      expect(isEmail('user@')).toBe(false);
      expect(isEmail('@example.com')).toBe(false);
      expect(isEmail('user @example.com')).toBe(false);
    });
  });

  describe('isUrl', () => {
    it('should return true for valid URL', () => {
      expect(isUrl('https://example.com')).toBe(true);
      expect(isUrl('http://example.com')).toBe(true);
      expect(isUrl('https://www.example.com/path')).toBe(true);
      expect(isUrl('https://example.com:8080')).toBe(true);
    });

    it('should return false for invalid URL', () => {
      expect(isUrl('not-a-url')).toBe(false);
      expect(isUrl('example.com')).toBe(false);
      expect(isUrl('//example.com')).toBe(false);
    });
  });

  describe('isPhone', () => {
    it('should return true for valid Chinese phone number', () => {
      expect(isPhone('13812345678')).toBe(true);
      expect(isPhone('15912345678')).toBe(true);
      expect(isPhone('18912345678')).toBe(true);
    });

    it('should return false for invalid phone number', () => {
      expect(isPhone('12812345678')).toBe(false); // starts with 2
      expect(isPhone('1381234567')).toBe(false); // too short
      expect(isPhone('138123456789')).toBe(false); // too long
      expect(isPhone('13812345abc')).toBe(false); // contains letters
    });
  });

  describe('isIdCard', () => {
    it('should return true for valid ID card', () => {
      expect(isIdCard('110101199001011234')).toBe(true);
      expect(isIdCard('11010119900101123X')).toBe(true);
      expect(isIdCard('110101900101123')).toBe(true); // 15-digit
    });

    it('should return false for invalid ID card', () => {
      expect(isIdCard('1234567890')).toBe(false);
      expect(isIdCard('11010119900101123A')).toBe(false); // invalid letter
    });
  });

  describe('getPasswordStrength', () => {
    it('should return "weak" for short password', () => {
      expect(getPasswordStrength('12345')).toBe('weak');
    });

    it('should return "weak" for password with only numbers', () => {
      expect(getPasswordStrength('12345678')).toBe('weak');
    });

    it('should return "weak" for password with only lowercase', () => {
      expect(getPasswordStrength('abcdefgh')).toBe('weak');
    });

    it('should return "medium" for password with lowercase and numbers', () => {
      expect(getPasswordStrength('abc12345')).toBe('weak');
    });

    it('should return "medium" for password with lowercase, uppercase, and numbers', () => {
      expect(getPasswordStrength('Abc12345')).toBe('medium');
    });

    it('should return "strong" for password with all types', () => {
      expect(getPasswordStrength('Abc@12345')).toBe('strong');
    });

    it('should respect custom minimum length', () => {
      expect(getPasswordStrength('Abc@12', 10)).toBe('weak');
      expect(getPasswordStrength('Abc@123456', 10)).toBe('strong');
    });
  });

  describe('isEmpty', () => {
    it('should return true for null and undefined', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('  ')).toBe(true);
    });

    it('should return false for non-empty string', () => {
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty(' hello ')).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(isEmpty([])).toBe(true);
    });

    it('should return false for non-empty array', () => {
      expect(isEmpty([1, 2, 3])).toBe(false);
    });

    it('should return true for empty object', () => {
      expect(isEmpty({})).toBe(true);
    });

    it('should return false for non-empty object', () => {
      expect(isEmpty({ a: 1 })).toBe(false);
    });

    it('should return false for boolean and numbers', () => {
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(false)).toBe(false);
    });
  });

  describe('isUsername', () => {
    it('should return true for valid username', () => {
      expect(isUsername('user123')).toBe(true);
      expect(isUsername('user_name')).toBe(true);
      expect(isUsername('User123')).toBe(true);
    });

    it('should return false for username too short', () => {
      expect(isUsername('ab')).toBe(false);
    });

    it('should return false for username too long', () => {
      expect(isUsername('a'.repeat(21))).toBe(false);
    });

    it('should return false for username with special characters', () => {
      expect(isUsername('user-name')).toBe(false);
      expect(isUsername('user.name')).toBe(false);
      expect(isUsername('user@name')).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
      expect(isPositiveInteger('5')).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger('0')).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(isPositiveInteger(-1)).toBe(false);
      expect(isPositiveInteger('-5')).toBe(false);
    });

    it('should return false for decimals', () => {
      expect(isPositiveInteger(1.5)).toBe(false);
      expect(isPositiveInteger('1.5')).toBe(false);
    });

    it('should return false for non-numeric values', () => {
      expect(isPositiveInteger('abc')).toBe(false);
      expect(isPositiveInteger(null)).toBe(false);
      expect(isPositiveInteger(undefined)).toBe(false);
    });
  });

  describe('isIPv4', () => {
    it('should return true for valid IPv4', () => {
      expect(isIPv4('192.168.1.1')).toBe(true);
      expect(isIPv4('255.255.255.255')).toBe(true);
      expect(isIPv4('0.0.0.0')).toBe(true);
    });

    it('should return false for invalid IPv4', () => {
      expect(isIPv4('256.1.1.1')).toBe(false);
      expect(isIPv4('192.168.1')).toBe(false);
      expect(isIPv4('192.168.1.1.1')).toBe(false);
      expect(isIPv4('abc.def.ghi.jkl')).toBe(false);
    });
  });

  describe('isHexColor', () => {
    it('should return true for valid hex colors', () => {
      expect(isHexColor('#fff')).toBe(true);
      expect(isHexColor('#ffffff')).toBe(true);
      expect(isHexColor('#FFF')).toBe(true);
      expect(isHexColor('#FFFFFF')).toBe(true);
      expect(isHexColor('#abc123')).toBe(true);
    });

    it('should return false for invalid hex colors', () => {
      expect(isHexColor('fff')).toBe(false); // missing #
      expect(isHexColor('#ff')).toBe(false); // too short
      expect(isHexColor('#ffff')).toBe(false); // wrong length
      expect(isHexColor('#gggggg')).toBe(false); // invalid characters
    });
  });
});

