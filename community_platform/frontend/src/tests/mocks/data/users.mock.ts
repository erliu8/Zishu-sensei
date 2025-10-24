/**
 * 模拟用户数据
 */

import { MockUser } from '../factories/user.factory';

export const mockUsers: MockUser[] = [
  {
    id: '1',
    username: 'john_doe',
    email: 'john@example.com',
    displayName: 'John Doe',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
    bio: 'Passionate learner and content creator',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    followersCount: 150,
    followingCount: 80,
    isFollowing: false,
  },
  {
    id: '2',
    username: 'jane_smith',
    email: 'jane@example.com',
    displayName: 'Jane Smith',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane',
    bio: 'Tech enthusiast | Lifelong learner',
    createdAt: '2024-01-05T00:00:00.000Z',
    updatedAt: '2024-01-20T00:00:00.000Z',
    followersCount: 320,
    followingCount: 150,
    isFollowing: true,
  },
  {
    id: '3',
    username: 'alex_chen',
    email: 'alex@example.com',
    displayName: 'Alex Chen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    bio: 'Developer & educator',
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-25T00:00:00.000Z',
    followersCount: 500,
    followingCount: 200,
    isFollowing: false,
  },
];

export const currentUser: MockUser = mockUsers[0];

