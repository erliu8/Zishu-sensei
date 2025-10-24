/**
 * 模拟内容数据
 */

import { MockContent } from '../factories/content.factory';
import { mockUsers } from './users.mock';

export const mockContents: MockContent[] = [
  {
    id: '1',
    title: 'Introduction to React Testing',
    description: 'Learn the fundamentals of testing React applications',
    content: '# Introduction to React Testing\n\nTesting is a crucial part of software development...',
    author: mockUsers[0],
    tags: ['react', 'testing', 'javascript'],
    category: 'Development',
    likesCount: 45,
    commentsCount: 12,
    viewsCount: 234,
    isLiked: false,
    isBookmarked: false,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
  },
  {
    id: '2',
    title: 'Advanced TypeScript Patterns',
    description: 'Deep dive into TypeScript design patterns',
    content: '# Advanced TypeScript Patterns\n\nTypeScript provides powerful type system features...',
    author: mockUsers[1],
    tags: ['typescript', 'patterns', 'advanced'],
    category: 'Development',
    likesCount: 78,
    commentsCount: 23,
    viewsCount: 456,
    isLiked: true,
    isBookmarked: true,
    createdAt: '2024-01-18T14:30:00.000Z',
    updatedAt: '2024-01-18T14:30:00.000Z',
  },
  {
    id: '3',
    title: 'Building Accessible Web Applications',
    description: 'Best practices for web accessibility',
    content: '# Building Accessible Web Applications\n\nAccessibility should be a priority...',
    author: mockUsers[2],
    tags: ['accessibility', 'a11y', 'web'],
    category: 'Web Design',
    likesCount: 92,
    commentsCount: 18,
    viewsCount: 567,
    isLiked: false,
    isBookmarked: true,
    createdAt: '2024-01-20T09:15:00.000Z',
    updatedAt: '2024-01-20T09:15:00.000Z',
  },
];

