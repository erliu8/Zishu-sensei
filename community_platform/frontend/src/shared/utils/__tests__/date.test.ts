/**
 * 日期工具函数单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatDate,
  getDaysBetween,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  isThisYear,
  startOfDay,
  endOfDay,
  addDays,
  addMonths,
  addYears,
  isLeapYear,
  getDaysInMonth,
} from '../date';

describe('date utils', () => {
  describe('formatDate', () => {
    it('should format date with default format', () => {
      const date = new Date('2024-01-15T10:30:45');
      const result = formatDate(date);
      expect(result).toBe('2024-01-15 10:30:45');
    });

    it('should format date with custom format', () => {
      const date = new Date('2024-01-15T10:30:45');
      const result = formatDate(date, 'YYYY-MM-DD');
      expect(result).toBe('2024-01-15');
    });

    it('should format date with Chinese format', () => {
      const date = new Date('2024-01-15T10:30:45');
      const result = formatDate(date, 'YYYY年MM月DD日 HH:mm');
      expect(result).toBe('2024年01月15日 10:30');
    });

    it('should handle timestamp input', () => {
      const timestamp = new Date('2024-01-15').getTime();
      const result = formatDate(timestamp, 'YYYY-MM-DD');
      expect(result).toBe('2024-01-15');
    });

    it('should handle string input', () => {
      const result = formatDate('2024-01-15', 'YYYY-MM-DD');
      expect(result).toBe('2024-01-15');
    });

    it('should return "Invalid Date" for invalid input', () => {
      const result = formatDate('invalid-date');
      expect(result).toBe('Invalid Date');
    });

    it('should pad single digit months and days', () => {
      const date = new Date('2024-01-05T08:09:07');
      const result = formatDate(date);
      expect(result).toBe('2024-01-05 08:09:07');
    });
  });

  describe('getDaysBetween', () => {
    it('should calculate days between two dates', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-10');
      const result = getDaysBetween(date1, date2);
      expect(result).toBe(9);
    });

    it('should return absolute value', () => {
      const date1 = new Date('2024-01-10');
      const date2 = new Date('2024-01-01');
      const result = getDaysBetween(date1, date2);
      expect(result).toBe(9);
    });

    it('should handle same date', () => {
      const date = new Date('2024-01-01');
      const result = getDaysBetween(date, date);
      expect(result).toBe(0);
    });

    it('should handle timestamp inputs', () => {
      const timestamp1 = new Date('2024-01-01').getTime();
      const timestamp2 = new Date('2024-01-05').getTime();
      const result = getDaysBetween(timestamp1, timestamp2);
      expect(result).toBe(4);
    });
  });

  describe('isToday', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00'));
    });

    it('should return true for today', () => {
      const today = new Date('2024-01-15T10:00:00');
      expect(isToday(today)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date('2024-01-14T10:00:00');
      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date('2024-01-16T10:00:00');
      expect(isToday(tomorrow)).toBe(false);
    });
  });

  describe('isYesterday', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00'));
    });

    it('should return true for yesterday', () => {
      const yesterday = new Date('2024-01-14T10:00:00');
      expect(isYesterday(yesterday)).toBe(true);
    });

    it('should return false for today', () => {
      const today = new Date('2024-01-15T10:00:00');
      expect(isYesterday(today)).toBe(false);
    });

    it('should return false for two days ago', () => {
      const twoDaysAgo = new Date('2024-01-13T10:00:00');
      expect(isYesterday(twoDaysAgo)).toBe(false);
    });
  });

  describe('isThisWeek', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Set to Monday, 2024-01-15
      vi.setSystemTime(new Date('2024-01-15T12:00:00'));
    });

    it('should return true for date in current week', () => {
      const dateInWeek = new Date('2024-01-16T10:00:00');
      expect(isThisWeek(dateInWeek)).toBe(true);
    });

    it('should return false for date in previous week', () => {
      const lastWeek = new Date('2024-01-08T10:00:00');
      expect(isThisWeek(lastWeek)).toBe(false);
    });
  });

  describe('isThisMonth', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00'));
    });

    it('should return true for date in current month', () => {
      const dateInMonth = new Date('2024-01-20T10:00:00');
      expect(isThisMonth(dateInMonth)).toBe(true);
    });

    it('should return false for date in previous month', () => {
      const lastMonth = new Date('2023-12-15T10:00:00');
      expect(isThisMonth(lastMonth)).toBe(false);
    });

    it('should return false for date in next month', () => {
      const nextMonth = new Date('2024-02-15T10:00:00');
      expect(isThisMonth(nextMonth)).toBe(false);
    });
  });

  describe('isThisYear', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00'));
    });

    it('should return true for date in current year', () => {
      const dateInYear = new Date('2024-06-15T10:00:00');
      expect(isThisYear(dateInYear)).toBe(true);
    });

    it('should return false for date in previous year', () => {
      const lastYear = new Date('2023-01-15T10:00:00');
      expect(isThisYear(lastYear)).toBe(false);
    });

    it('should return false for date in next year', () => {
      const nextYear = new Date('2025-01-15T10:00:00');
      expect(isThisYear(nextYear)).toBe(false);
    });
  });

  describe('startOfDay', () => {
    it('should return start of day', () => {
      const date = new Date('2024-01-15T14:30:45.123');
      const result = startOfDay(date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve the date', () => {
      const date = new Date('2024-01-15T14:30:45');
      const result = startOfDay(date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe('endOfDay', () => {
    it('should return end of day', () => {
      const date = new Date('2024-01-15T10:30:45');
      const result = endOfDay(date);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    it('should preserve the date', () => {
      const date = new Date('2024-01-15T10:30:45');
      const result = endOfDay(date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const date = new Date('2024-01-15');
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });

    it('should add negative days', () => {
      const date = new Date('2024-01-15');
      const result = addDays(date, -5);
      expect(result.getDate()).toBe(10);
    });

    it('should handle month overflow', () => {
      const date = new Date('2024-01-30');
      const result = addDays(date, 5);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(4);
    });
  });

  describe('addMonths', () => {
    it('should add positive months', () => {
      const date = new Date('2024-01-15');
      const result = addMonths(date, 3);
      expect(result.getMonth()).toBe(3); // April
    });

    it('should add negative months', () => {
      const date = new Date('2024-05-15');
      const result = addMonths(date, -3);
      expect(result.getMonth()).toBe(1); // February
    });

    it('should handle year overflow', () => {
      const date = new Date('2024-11-15');
      const result = addMonths(date, 3);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe('addYears', () => {
    it('should add positive years', () => {
      const date = new Date('2024-01-15');
      const result = addYears(date, 5);
      expect(result.getFullYear()).toBe(2029);
    });

    it('should add negative years', () => {
      const date = new Date('2024-01-15');
      const result = addYears(date, -5);
      expect(result.getFullYear()).toBe(2019);
    });

    it('should preserve month and day', () => {
      const date = new Date('2024-06-15');
      const result = addYears(date, 1);
      expect(result.getMonth()).toBe(5); // June
      expect(result.getDate()).toBe(15);
    });
  });

  describe('isLeapYear', () => {
    it('should return true for leap years divisible by 4', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2020)).toBe(true);
    });

    it('should return false for years not divisible by 4', () => {
      expect(isLeapYear(2023)).toBe(false);
      expect(isLeapYear(2021)).toBe(false);
    });

    it('should return false for years divisible by 100 but not 400', () => {
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2100)).toBe(false);
    });

    it('should return true for years divisible by 400', () => {
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2400)).toBe(true);
    });
  });

  describe('getDaysInMonth', () => {
    it('should return 31 for January', () => {
      expect(getDaysInMonth(2024, 1)).toBe(31);
    });

    it('should return 29 for February in leap year', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29);
    });

    it('should return 28 for February in non-leap year', () => {
      expect(getDaysInMonth(2023, 2)).toBe(28);
    });

    it('should return 30 for April', () => {
      expect(getDaysInMonth(2024, 4)).toBe(30);
    });

    it('should return 31 for December', () => {
      expect(getDaysInMonth(2024, 12)).toBe(31);
    });
  });
});

