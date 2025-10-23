/**
 * Tailwind CSS Class Name Utility
 * 用于合并 Tailwind CSS 类名
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
