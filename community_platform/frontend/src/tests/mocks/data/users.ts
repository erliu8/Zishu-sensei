/**
 * Mock 用户数据
 * @module tests/mocks/data/users
 */

export const mockUsers = [
  {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    avatar: 'https://i.pravatar.cc/150?img=1',
    bio: '这是一个测试用户',
    isEmailVerified: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'user-2',
    username: 'janesmith',
    email: 'jane@example.com',
    displayName: 'Jane Smith',
    avatar: 'https://i.pravatar.cc/150?img=2',
    bio: '前端开发工程师',
    isEmailVerified: true,
    createdAt: new Date('2024-01-02').toISOString(),
    updatedAt: new Date('2024-01-02').toISOString(),
  },
  {
    id: 'user-3',
    username: 'bobwilson',
    email: 'bob@example.com',
    displayName: 'Bob Wilson',
    avatar: 'https://i.pravatar.cc/150?img=3',
    bio: '全栈开发者',
    isEmailVerified: true,
    createdAt: new Date('2024-01-03').toISOString(),
    updatedAt: new Date('2024-01-03').toISOString(),
  },
  {
    id: 'user-4',
    username: 'alicejones',
    email: 'alice@example.com',
    displayName: 'Alice Jones',
    avatar: 'https://i.pravatar.cc/150?img=4',
    bio: 'UI/UX 设计师',
    isEmailVerified: false,
    createdAt: new Date('2024-01-04').toISOString(),
    updatedAt: new Date('2024-01-04').toISOString(),
  },
  {
    id: 'user-5',
    username: 'charliebrown',
    email: 'charlie@example.com',
    displayName: 'Charlie Brown',
    avatar: null,
    bio: '',
    isEmailVerified: true,
    createdAt: new Date('2024-01-05').toISOString(),
    updatedAt: new Date('2024-01-05').toISOString(),
  },
];

export default mockUsers;

