# 搜索模块 - 项目结构

## 📁 完整文件树

```
src/features/search/
│
├── 📂 domain/                          # 领域层 - 业务逻辑和数据模型
│   ├── 📄 search.types.ts              # 类型定义（400行）
│   │   ├── SearchType                  # 搜索类型枚举
│   │   ├── SearchSortBy                # 排序方式枚举
│   │   ├── SearchSortOrder             # 排序顺序枚举
│   │   ├── SearchFilters               # 筛选器接口
│   │   ├── SearchParams                # 搜索参数接口
│   │   ├── SearchResultPost            # 帖子结果类型
│   │   ├── SearchResultAdapter         # 适配器结果类型
│   │   ├── SearchResultCharacter       # 角色结果类型
│   │   ├── SearchResultUser            # 用户结果类型
│   │   ├── SearchResult                # 搜索结果接口
│   │   ├── SearchSuggestion            # 搜索建议接口
│   │   ├── SearchHistoryItem           # 搜索历史项接口
│   │   └── TrendingSearchItem          # 热门搜索项接口
│   │
│   ├── 📄 search.model.ts              # Domain 模型（250行）
│   │   ├── SearchParamsBuilder         # 搜索参数构建器
│   │   ├── SearchHistoryManager        # 搜索历史管理器
│   │   ├── SearchResultHelper          # 搜索结果辅助类
│   │   └── SearchQueryOptimizer        # 搜索查询优化器
│   │
│   └── 📄 index.ts                     # Domain 层导出
│
├── 📂 api/                             # API 层 - 后端通信
│   ├── 📄 search.api.ts                # API Client（300行）
│   │   ├── SearchApiClient             # 搜索 API 客户端类
│   │   │   ├── search()                # 执行搜索
│   │   │   ├── getSuggestions()        # 获取搜索建议
│   │   │   └── getTrending()           # 获取热门搜索
│   │   └── searchApiClient             # 默认客户端实例
│   │
│   └── 📄 index.ts                     # API 层导出
│
├── 📂 hooks/                           # Hooks 层 - React 自定义钩子
│   ├── 📄 useSearch.ts                 # 搜索 Hook（150行）
│   │   ├── searchKeys                  # Query Key 工厂
│   │   ├── useSearch                   # 搜索查询 Hook
│   │   ├── useSearchSuggestions        # 搜索建议 Hook
│   │   ├── useTrendingSearch           # 热门搜索 Hook
│   │   └── useInvalidateSearch         # 缓存失效 Hook
│   │
│   ├── 📄 useSearchHistory.ts          # 搜索历史 Hook（120行）
│   │   ├── useSearchHistory            # 历史管理 Hook
│   │   └── useSearchHistorySync        # 历史同步 Hook
│   │
│   └── 📄 index.ts                     # Hooks 层导出
│
├── 📂 components/                      # 组件层 - UI 组件
│   ├── 📄 SearchBar.tsx                # 搜索栏组件（300行）
│   │   ├── SearchBarProps              # 组件 Props
│   │   └── SearchBar                   # 搜索栏组件
│   │       ├── 搜索输入框
│   │       ├── 搜索建议下拉
│   │       ├── 搜索历史显示
│   │       ├── 热门搜索显示
│   │       └── 键盘导航支持
│   │
│   ├── 📄 SearchResults.tsx            # 搜索结果组件（400行）
│   │   ├── SearchResultsProps          # 组件 Props
│   │   ├── SearchResults               # 主组件
│   │   ├── PostResultItem              # 帖子结果项
│   │   ├── AdapterResultItem           # 适配器结果项
│   │   ├── CharacterResultItem         # 角色结果项
│   │   ├── UserResultItem              # 用户结果项
│   │   └── SearchResultsSkeleton       # 加载骨架屏
│   │
│   ├── 📄 SearchFilters.tsx            # 筛选器组件（250行）
│   │   ├── SearchFiltersProps          # 组件 Props
│   │   └── SearchFilters               # 筛选器组件
│   │       ├── 搜索类型筛选
│   │       ├── 标签筛选
│   │       ├── 日期范围筛选
│   │       ├── 评分范围筛选
│   │       ├── 已验证筛选
│   │       └── 特色内容筛选
│   │
│   ├── 📄 SearchHistory.tsx            # 搜索历史组件（150行）
│   │   ├── SearchHistoryProps          # 组件 Props
│   │   └── SearchHistory               # 历史记录组件
│   │       ├── 历史列表显示
│   │       ├── 删除单条记录
│   │       ├── 清空所有记录
│   │       └── 空状态提示
│   │
│   └── 📄 index.ts                     # 组件层导出
│
├── 📂 examples/                        # 示例代码
│   └── 📄 usage-examples.tsx           # 使用示例（400行）
│       ├── BasicSearchPage             # 基础搜索页面
│       ├── PostSearchPage              # 帖子搜索页面
│       ├── AutocompleteSearch          # 自动完成搜索
│       ├── TrendingSearchWidget        # 热门搜索组件
│       ├── SearchHistoryPanel          # 历史面板
│       ├── AdvancedSearchForm          # 高级搜索表单
│       ├── NavbarSearch                # 导航栏搜索
│       └── MobileSearch                # 移动端搜索
│
├── 📄 index.ts                         # 主导出文件
│
├── 📄 README.md                        # 完整文档（500行）
│   ├── 概述
│   ├── 目录结构
│   ├── 核心功能
│   ├── 使用示例
│   ├── API 参考
│   ├── 组件 Props
│   ├── 工具类说明
│   └── 常见问题
│
├── 📄 FEATURES.md                      # 功能清单（400行）
│   ├── 已完成功能
│   ├── UI/UX 特性
│   ├── 技术特性
│   ├── 代码统计
│   └── 下一步计划
│
├── 📄 QUICKSTART.md                    # 快速开始（300行）
│   ├── 5分钟上手
│   ├── 完整示例
│   ├── 常见场景
│   ├── 配置选项
│   └── 故障排除
│
├── 📄 SUMMARY.md                       # 项目总结（500行）
│   ├── 项目信息
│   ├── 完成情况
│   ├── 交付物
│   ├── 代码统计
│   ├── 核心功能
│   ├── 架构设计
│   └── 亮点特性
│
├── 📄 INTEGRATION.md                   # 集成指南（400行）
│   ├── 集成步骤
│   ├── 依赖验证
│   ├── 后端 API 配置
│   ├── 可选配置
│   ├── 测试集成
│   └── 故障排除
│
└── 📄 STRUCTURE.md                     # 项目结构（本文件）
```

## 📂 页面文件

```
src/app/(main)/search/
└── 📄 page.tsx                         # 搜索结果页面（300行）
    ├── 搜索栏集成
    ├── 类型标签切换
    ├── 结果统计显示
    ├── 排序选择器
    ├── 筛选器集成
    ├── 视图模式切换
    ├── 分页组件
    └── URL 参数同步
```

## 📊 文件统计

### 代码文件（13个）

| 目录 | 文件数 | 总行数 | 说明 |
|------|--------|--------|------|
| `domain/` | 3 | ~650 | 领域层 - 类型和模型 |
| `api/` | 2 | ~300 | API 层 - 后端通信 |
| `hooks/` | 3 | ~270 | Hooks 层 - React 钩子 |
| `components/` | 5 | ~1,100 | 组件层 - UI 组件 |
| `examples/` | 1 | ~400 | 示例代码 |
| **总计** | **14** | **~2,720** | 代码文件 |

### 文档文件（6个）

| 文件 | 行数 | 说明 |
|------|------|------|
| `README.md` | ~500 | 完整使用文档 |
| `FEATURES.md` | ~400 | 功能清单 |
| `QUICKSTART.md` | ~300 | 快速开始指南 |
| `SUMMARY.md` | ~500 | 项目总结 |
| `INTEGRATION.md` | ~400 | 集成指南 |
| `STRUCTURE.md` | ~200 | 项目结构（本文件） |
| **总计** | **~2,300** | 文档文件 |

### 页面文件（1个）

| 文件 | 行数 | 说明 |
|------|------|------|
| `app/(main)/search/page.tsx` | ~300 | 搜索结果页面 |

## 🎯 分层架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        Page Layer                            │
│                     (页面层 - 1个文件)                         │
│                                                               │
│  /search/page.tsx - 搜索结果页面                              │
│    ├── SearchBar 集成                                         │
│    ├── SearchFilters 集成                                     │
│    ├── SearchResults 集成                                     │
│    └── URL 参数管理                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Component Layer                          │
│                   (组件层 - 4个组件)                          │
│                                                               │
│  SearchBar.tsx - 全局搜索栏                                   │
│  SearchResults.tsx - 搜索结果展示                             │
│  SearchFilters.tsx - 高级筛选器                               │
│  SearchHistory.tsx - 搜索历史                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       Hooks Layer                            │
│                    (Hooks层 - 6个Hook)                        │
│                                                               │
│  useSearch - 搜索查询                                         │
│  useSearchSuggestions - 搜索建议                              │
│  useTrendingSearch - 热门搜索                                 │
│  useSearchHistory - 搜索历史                                  │
│  useSearchHistorySync - 历史同步                              │
│  useInvalidateSearch - 缓存失效                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│                    (API层 - 1个Client)                        │
│                                                               │
│  SearchApiClient                                             │
│    ├── search() - 执行搜索                                    │
│    ├── getSuggestions() - 获取建议                            │
│    └── getTrending() - 获取热门                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│                  (领域层 - 类型和模型)                         │
│                                                               │
│  Types: 15+ 个类型定义                                        │
│  Models:                                                     │
│    ├── SearchParamsBuilder - 参数构建                         │
│    ├── SearchHistoryManager - 历史管理                        │
│    ├── SearchResultHelper - 结果辅助                          │
│    └── SearchQueryOptimizer - 查询优化                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│                       (外部服务)                              │
│                                                               │
│  ├── Backend API - 搜索服务                                   │
│  ├── TanStack Query - 数据缓存                                │
│  ├── localStorage - 历史存储                                  │
│  └── Shadcn/ui - UI 组件库                                    │
└─────────────────────────────────────────────────────────────┘
```

## 🔗 依赖关系

```
Page (search/page.tsx)
  ├── Components
  │   ├── SearchBar
  │   │   ├── useSearchSuggestions
  │   │   ├── useTrendingSearch
  │   │   └── useSearchHistory
  │   ├── SearchResults
  │   ├── SearchFilters
  │   └── SearchHistory
  │       └── useSearchHistory
  └── Hooks
      └── useSearch

Components
  └── Hooks
      ├── useSearch
      ├── useSearchSuggestions
      ├── useTrendingSearch
      └── useSearchHistory

Hooks
  ├── API
  │   └── SearchApiClient
  └── Domain
      ├── Types
      └── Models

API
  └── Domain
      └── Types

Domain
  └── (独立，无依赖)
```

## 📦 导出结构

### 主导出（index.ts）

```typescript
export * from './domain';      // 所有 Domain 类型和模型
export * from './api';         // API Client
export * from './hooks';       // 所有 Hooks
export * from './components';  // 所有组件
```

### 各层导出

#### Domain 层
```typescript
// domain/index.ts
export * from './search.types';
export * from './search.model';
```

#### API 层
```typescript
// api/index.ts
export * from './search.api';
```

#### Hooks 层
```typescript
// hooks/index.ts
export * from './useSearch';
export * from './useSearchHistory';
```

#### 组件层
```typescript
// components/index.ts
export * from './SearchBar';
export * from './SearchResults';
export * from './SearchFilters';
export * from './SearchHistory';
```

## 🎨 组件层次结构

```
SearchBar
  ├── Input (Shadcn/ui)
  ├── Popover (Shadcn/ui)
  │   ├── SearchSuggestions (内联)
  │   ├── SearchHistory (引用 hook)
  │   └── TrendingSearch (引用 hook)
  └── Button (Shadcn/ui)

SearchResults
  ├── Card (Shadcn/ui)
  │   ├── PostResultItem (内联)
  │   ├── AdapterResultItem (内联)
  │   ├── CharacterResultItem (内联)
  │   └── UserResultItem (内联)
  └── Skeleton (Shadcn/ui)

SearchFilters
  ├── Sheet (Shadcn/ui)
  │   ├── Select (Shadcn/ui)
  │   ├── Input (Shadcn/ui)
  │   ├── Checkbox (Shadcn/ui)
  │   └── Slider (Shadcn/ui)
  └── Badge (Shadcn/ui)

SearchHistory
  ├── Card (Shadcn/ui)
  ├── Badge (Shadcn/ui)
  └── AlertDialog (Shadcn/ui)
```

## 📈 代码复杂度分布

| 层级 | 复杂度 | 说明 |
|------|--------|------|
| Domain | ⭐⭐ | 简单 - 主要是类型定义和简单逻辑 |
| API | ⭐⭐⭐ | 中等 - API 调用和数据转换 |
| Hooks | ⭐⭐⭐ | 中等 - React Hook 逻辑 |
| Components | ⭐⭐⭐⭐ | 较高 - UI 交互和状态管理 |
| Page | ⭐⭐⭐⭐ | 较高 - 完整的页面逻辑 |

## 🔍 代码职责

### Domain 层
- ✅ 定义业务类型
- ✅ 实现业务逻辑
- ✅ 提供工具类
- ❌ 不依赖 React
- ❌ 不依赖外部库

### API 层
- ✅ 封装 HTTP 请求
- ✅ 处理响应数据
- ✅ 错误处理
- ❌ 不包含 UI 逻辑
- ❌ 不直接操作 React 状态

### Hooks 层
- ✅ 封装数据请求
- ✅ 管理缓存
- ✅ 提供 React 接口
- ❌ 不包含 UI
- ❌ 不直接操作 DOM

### 组件层
- ✅ 实现 UI 界面
- ✅ 处理用户交互
- ✅ 管理局部状态
- ❌ 不直接调用 API
- ❌ 通过 Hooks 获取数据

### 页面层
- ✅ 组合组件
- ✅ 管理页面状态
- ✅ 处理路由
- ❌ 不包含复杂业务逻辑
- ❌ 委托给组件和 Hooks

## 📝 命名规范

### 文件命名
- **组件**: PascalCase.tsx (SearchBar.tsx)
- **Hooks**: camelCase.ts (useSearch.ts)
- **类型**: PascalCase.types.ts (search.types.ts)
- **工具**: camelCase.ts (search.model.ts)

### 导出命名
- **组件**: PascalCase (SearchBar)
- **Hooks**: camelCase (useSearch)
- **类型**: PascalCase (SearchType)
- **接口**: PascalCase (SearchFilters)
- **常量**: UPPER_CASE (MAX_HISTORY_SIZE)

## 🎯 设计原则

1. **单一职责** - 每个文件/类/函数只负责一件事
2. **开闭原则** - 对扩展开放，对修改封闭
3. **依赖倒置** - 依赖抽象，不依赖具体实现
4. **接口隔离** - 接口应该小而专注
5. **组合优于继承** - 使用组合而非继承

## 📚 总结

搜索模块采用清晰的分层架构，每一层都有明确的职责：

- **Domain 层**: 纯粹的业务逻辑，不依赖框架
- **API 层**: 封装后端通信，提供类型安全的接口
- **Hooks 层**: 连接 React 和业务逻辑，管理数据和缓存
- **组件层**: 实现 UI 界面，处理用户交互
- **页面层**: 组合组件，实现完整功能

这种架构使得代码：
- ✅ 易于理解和维护
- ✅ 易于测试
- ✅ 易于扩展
- ✅ 高度可复用

---

**版本**: v1.0.0  
**更新日期**: 2025-10-23

