/**
 * 帖子数据层 - Zustand Store
 * @module features/post/store
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Post, PostCategory, PostQueryParams } from '../domain';

/**
 * 帖子视图模式
 */
export type PostViewMode = 'grid' | 'list';

/**
 * 帖子排序方式
 */
export type PostSortBy = 'createdAt' | 'updatedAt' | 'viewCount' | 'likeCount' | 'commentCount';

/**
 * 帖子 Store 状态
 */
interface PostState {
  // UI 状态
  viewMode: PostViewMode;
  selectedCategory: PostCategory | null;
  searchQuery: string;
  sortBy: PostSortBy;
  sortOrder: 'asc' | 'desc';

  // 当前选中的帖子
  selectedPost: Post | null;

  // 编辑器状态
  isEditorOpen: boolean;
  editingPost: Post | null;

  // 草稿状态（持久化到 localStorage）
  drafts: Record<string, Partial<Post>>;
}

/**
 * 帖子 Store 操作
 */
interface PostActions {
  // UI 操作
  setViewMode: (mode: PostViewMode) => void;
  setSelectedCategory: (category: PostCategory | null) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: PostSortBy) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  toggleSortOrder: () => void;

  // 帖子选择
  setSelectedPost: (post: Post | null) => void;

  // 编辑器操作
  openEditor: (post?: Post) => void;
  closeEditor: () => void;
  setEditingPost: (post: Post | null) => void;

  // 草稿操作
  saveDraft: (id: string, draft: Partial<Post>) => void;
  loadDraft: (id: string) => Partial<Post> | undefined;
  deleteDraft: (id: string) => void;
  clearDrafts: () => void;

  // 查询参数生成
  getQueryParams: () => PostQueryParams;

  // 重置状态
  reset: () => void;
}

/**
 * 帖子 Store 类型
 */
type PostStore = PostState & PostActions;

/**
 * 初始状态
 */
const initialState: PostState = {
  viewMode: 'grid',
  selectedCategory: null,
  searchQuery: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  selectedPost: null,
  isEditorOpen: false,
  editingPost: null,
  drafts: {},
};

/**
 * 帖子 Store
 */
export const usePostStore = create<PostStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // UI 操作
        setViewMode: (mode) => set({ viewMode: mode }),
        setSelectedCategory: (category) => set({ selectedCategory: category }),
        setSearchQuery: (query) => set({ searchQuery: query }),
        setSortBy: (sortBy) => set({ sortBy }),
        setSortOrder: (order) => set({ sortOrder: order }),
        toggleSortOrder: () =>
          set((state) => ({
            sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc',
          })),

        // 帖子选择
        setSelectedPost: (post) => set({ selectedPost: post }),

        // 编辑器操作
        openEditor: (post) =>
          set({
            isEditorOpen: true,
            editingPost: post || null,
          }),
        closeEditor: () =>
          set({
            isEditorOpen: false,
            editingPost: null,
          }),
        setEditingPost: (post) => set({ editingPost: post }),

        // 草稿操作
        saveDraft: (id, draft) =>
          set((state) => ({
            drafts: {
              ...state.drafts,
              [id]: {
                ...state.drafts[id],
                ...draft,
              },
            },
          })),
        loadDraft: (id) => {
          const drafts = get().drafts;
          return drafts[id];
        },
        deleteDraft: (id) =>
          set((state) => {
            const { [id]: _, ...rest } = state.drafts;
            return { drafts: rest };
          }),
        clearDrafts: () => set({ drafts: {} }),

        // 查询参数生成
        getQueryParams: () => {
          const state = get();
          return {
            category: state.selectedCategory || undefined,
            search: state.searchQuery || undefined,
            sortBy: state.sortBy,
            sortOrder: state.sortOrder,
          };
        },

        // 重置状态
        reset: () => set(initialState),
      }),
      {
        name: 'post-store',
        // 只持久化部分状态
        partialize: (state) => ({
          viewMode: state.viewMode,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          drafts: state.drafts,
        }),
      }
    ),
    {
      name: 'PostStore',
    }
  )
);

/**
 * 帖子 Store Selectors（用于优化性能）
 */
export const postStoreSelectors = {
  viewMode: (state: PostStore) => state.viewMode,
  selectedCategory: (state: PostStore) => state.selectedCategory,
  searchQuery: (state: PostStore) => state.searchQuery,
  sortBy: (state: PostStore) => state.sortBy,
  sortOrder: (state: PostStore) => state.sortOrder,
  selectedPost: (state: PostStore) => state.selectedPost,
  isEditorOpen: (state: PostStore) => state.isEditorOpen,
  editingPost: (state: PostStore) => state.editingPost,
  queryParams: (state: PostStore) => state.getQueryParams(),
};

