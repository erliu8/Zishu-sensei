# 适配器功能模块 (Adapter Feature Module)

本模块实现了 Zishu 社区平台的适配器市场功能，支持三种类型的适配器：

1. **软适配器 (Soft Adapters)** - 基于提示词工程和RAG技术
2. **硬适配器 (Hard Adapters)** - 基于原生代码实现
3. **智能硬适配器 (Intelligent Hard Adapters)** - 基于专业微调模型

## 📁 目录结构

```
src/features/adapter/
├── domain/              # 领域模型和类型定义
│   ├── adapter.types.ts # 适配器相关类型
│   └── index.ts         # 导出
├── api/                 # API 客户端
│   ├── AdapterApiClient.ts            # 适配器 API
│   ├── AdapterVersionApiClient.ts     # 版本 API
│   ├── AdapterCategoryApiClient.ts    # 分类 API
│   ├── AdapterRatingApiClient.ts      # 评分 API
│   ├── AdapterDependencyApiClient.ts  # 依赖 API
│   └── index.ts                       # 导出
├── hooks/               # React Query Hooks
│   ├── useAdapters.ts             # 适配器相关 Hooks
│   ├── useAdapterVersions.ts      # 版本相关 Hooks
│   ├── useAdapterCategories.ts    # 分类相关 Hooks
│   ├── useAdapterRatings.ts       # 评分相关 Hooks
│   ├── useAdapterDependencies.ts  # 依赖相关 Hooks
│   └── index.ts                   # 导出
├── components/          # UI 组件（待实现）
├── services/            # 业务服务（待实现）
├── store/              # 状态管理（待实现）
└── README.md           # 本文档
```

## 🎯 核心功能

### 1. 适配器类型系统

```typescript
import { AdapterType } from '@/features/adapter';

// 三种适配器类型
const types = {
  SOFT: AdapterType.SOFT,           // 软适配器
  HARD: AdapterType.HARD,           // 硬适配器
  INTELLIGENT: AdapterType.INTELLIGENT, // 智能硬适配器
};
```

### 2. 能力等级

```typescript
import { CapabilityLevel } from '@/features/adapter';

// 四个能力等级
const levels = {
  BASIC: CapabilityLevel.BASIC,           // 基础
  INTERMEDIATE: CapabilityLevel.INTERMEDIATE, // 中级
  ADVANCED: CapabilityLevel.ADVANCED,       // 高级
  EXPERT: CapabilityLevel.EXPERT,          // 专家级
};
```

## 📖 使用示例

### 获取适配器列表

```typescript
import { useAdapters } from '@/features/adapter';

function AdapterList() {
  const { data, isLoading, error } = useAdapters({
    page: 1,
    pageSize: 20,
    type: AdapterType.INTELLIGENT, // 只显示智能硬适配器
    sortBy: 'downloads',
    sortOrder: 'desc',
  });

  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;

  return (
    <div>
      {data?.data.map(adapter => (
        <AdapterCard key={adapter.id} adapter={adapter} />
      ))}
    </div>
  );
}
```

### 获取适配器详情

```typescript
import { useAdapter } from '@/features/adapter';

function AdapterDetail({ id }: { id: string }) {
  const { data: adapter, isLoading } = useAdapter(id);

  if (isLoading) return <Loading />;

  return (
    <div>
      <h1>{adapter.displayName}</h1>
      <p>类型: {adapter.type}</p>
      <p>描述: {adapter.description}</p>
      <p>下载次数: {adapter.stats.downloads}</p>
      <p>评分: {adapter.stats.rating} ({adapter.stats.ratingCount}人评分)</p>
    </div>
  );
}
```

### 创建适配器

```typescript
import { useCreateAdapter, AdapterType, CapabilityLevel } from '@/features/adapter';

function CreateAdapterForm() {
  const createAdapter = useCreateAdapter();

  const handleSubmit = async (formData: FormData) => {
    try {
      const adapter = await createAdapter.mutateAsync({
        name: 'my-adapter',
        displayName: '我的智能适配器',
        type: AdapterType.INTELLIGENT,
        description: '一个专业的数据分析适配器',
        categoryId: 'data-analysis',
        tags: ['数据分析', 'Python', '机器学习'],
        capabilities: [
          {
            name: '数据清洗',
            description: '智能数据清洗和预处理',
            level: CapabilityLevel.EXPERT,
            inputs: ['csv', 'excel', 'json'],
            outputs: ['cleaned_data'],
          },
        ],
        license: 'MIT',
        systemRequirements: {
          minMemory: 2048,
          pythonVersion: '>=3.8',
        },
        permissions: {
          fileSystemAccess: 'read',
          networkAccess: true,
          codeExecution: true,
        },
      });

      console.log('适配器创建成功:', adapter);
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 安装适配器

```typescript
import { useInstallAdapter } from '@/features/adapter';

function InstallButton({ adapterId }: { adapterId: string }) {
  const installAdapter = useInstallAdapter();

  const handleInstall = async () => {
    try {
      const status = await installAdapter.mutateAsync({
        id: adapterId,
        version: '1.0.0', // 可选，默认安装最新版本
      });

      console.log('安装成功:', status);
    } catch (error) {
      console.error('安装失败:', error);
    }
  };

  return (
    <button 
      onClick={handleInstall}
      disabled={installAdapter.isPending}
    >
      {installAdapter.isPending ? '安装中...' : '安装'}
    </button>
  );
}
```

### 管理版本

```typescript
import { useAdapterVersions, useCreateAdapterVersion } from '@/features/adapter';

function VersionManager({ adapterId }: { adapterId: string }) {
  const { data: versions } = useAdapterVersions(adapterId);
  const createVersion = useCreateAdapterVersion();

  const handlePublishVersion = async (file: File) => {
    try {
      const version = await createVersion.mutateAsync({
        adapterId,
        version: '1.1.0',
        description: '新增功能X',
        changelog: '- 新增功能X\n- 修复bug Y',
        file,
        isStable: true,
      });

      console.log('版本发布成功:', version);
    } catch (error) {
      console.error('发布失败:', error);
    }
  };

  return (
    <div>
      <h2>版本历史</h2>
      {versions?.map(version => (
        <div key={version.id}>
          <h3>v{version.version}</h3>
          <p>{version.description}</p>
          <p>下载次数: {version.downloads}</p>
        </div>
      ))}
    </div>
  );
}
```

### 评分和评论

```typescript
import { 
  useMyAdapterRating, 
  useCreateAdapterRating, 
  useUpdateAdapterRating 
} from '@/features/adapter';

function RatingForm({ adapterId }: { adapterId: string }) {
  const { data: myRating } = useMyAdapterRating(adapterId);
  const createRating = useCreateAdapterRating();
  const updateRating = useUpdateAdapterRating();

  const handleSubmit = async (rating: number, comment: string) => {
    try {
      if (myRating) {
        // 更新已有评分
        await updateRating.mutateAsync({
          adapterId,
          ratingId: myRating.id,
          data: { rating, comment },
        });
      } else {
        // 创建新评分
        await createRating.mutateAsync({
          adapterId,
          rating,
          comment,
        });
      }
    } catch (error) {
      console.error('提交失败:', error);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 依赖管理

```typescript
import { 
  useAdapterDependencyTree, 
  useCheckAdapterDependencies 
} from '@/features/adapter';

function DependencyViewer({ adapterId }: { adapterId: string }) {
  const { data: dependencyTree } = useAdapterDependencyTree(adapterId);
  const { data: checkResult } = useCheckAdapterDependencies(adapterId);

  return (
    <div>
      <h2>依赖树</h2>
      <DependencyTreeView tree={dependencyTree} />

      {!checkResult?.satisfied && (
        <div className="warning">
          <h3>依赖问题:</h3>
          <ul>
            {checkResult.missing.map(dep => (
              <li key={dep.id}>缺失依赖: {dep.dependencyName}</li>
            ))}
            {checkResult.incompatible.map(({ dependency, reason }) => (
              <li key={dependency.id}>
                版本不兼容: {dependency.dependencyName} - {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### 分类浏览

```typescript
import { 
  useAdapterCategories, 
  useAdapterCategoryTree 
} from '@/features/adapter';

function CategoryBrowser() {
  const { data: categoryTree } = useAdapterCategoryTree();
  const { data: popularCategories } = usePopularCategories(10);

  return (
    <div>
      <h2>分类浏览</h2>
      <CategoryTreeView tree={categoryTree} />

      <h3>热门分类</h3>
      {popularCategories?.map(category => (
        <CategoryCard 
          key={category.id} 
          category={category}
        />
      ))}
    </div>
  );
}
```

## 🔑 查询键 (Query Keys)

本模块使用工厂模式管理查询键，确保缓存一致性：

```typescript
import { 
  adapterKeys,
  adapterVersionKeys,
  adapterCategoryKeys,
  adapterRatingKeys,
  adapterDependencyKeys,
} from '@/features/adapter';

// 手动刷新特定查询
queryClient.invalidateQueries({ 
  queryKey: adapterKeys.detail(adapterId) 
});

// 刷新所有适配器列表
queryClient.invalidateQueries({ 
  queryKey: adapterKeys.lists() 
});
```

## 🎨 类型定义

所有类型定义都在 `domain/adapter.types.ts` 中，包括：

- `Adapter` - 适配器主模型
- `AdapterVersion` - 版本信息
- `AdapterCategory` - 分类信息
- `AdapterDependency` - 依赖关系
- `AdapterRating` - 评分信息
- `AdapterCapability` - 能力描述
- `SystemRequirements` - 系统要求
- `PermissionRequirements` - 权限需求
- 以及各种查询参数和响应类型

## 🚀 最佳实践

### 1. 错误处理

```typescript
import { useAdapter } from '@/features/adapter';

function AdapterDetail({ id }: { id: string }) {
  const { data, error, isLoading } = useAdapter(id, {
    retry: 3, // 失败后重试3次
    onError: (error) => {
      console.error('获取适配器失败:', error);
      toast.error('加载失败，请稍后重试');
    },
  });

  // ...
}
```

### 2. 乐观更新

```typescript
import { useLikeAdapter } from '@/features/adapter';
import { useQueryClient } from '@tanstack/react-query';

function LikeButton({ adapter }: { adapter: Adapter }) {
  const queryClient = useQueryClient();
  const likeAdapter = useLikeAdapter({
    onMutate: async (adapterId) => {
      // 取消相关查询
      await queryClient.cancelQueries({ 
        queryKey: adapterKeys.detail(adapterId) 
      });

      // 保存旧数据
      const previousAdapter = queryClient.getQueryData(
        adapterKeys.detail(adapterId)
      );

      // 乐观更新
      queryClient.setQueryData(adapterKeys.detail(adapterId), (old: Adapter) => ({
        ...old,
        stats: {
          ...old.stats,
          likes: old.stats.likes + 1,
        },
        isLiked: true,
      }));

      return { previousAdapter };
    },
    onError: (err, adapterId, context) => {
      // 回滚
      if (context?.previousAdapter) {
        queryClient.setQueryData(
          adapterKeys.detail(adapterId),
          context.previousAdapter
        );
      }
    },
  });

  return <button onClick={() => likeAdapter.mutate(adapter.id)}>点赞</button>;
}
```

### 3. 缓存配置

```typescript
import { useAdapters } from '@/features/adapter';

function AdapterList() {
  const { data } = useAdapters(undefined, {
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的
    gcTime: 10 * 60 * 1000, // 10分钟后清除缓存
    refetchOnWindowFocus: true, // 窗口获得焦点时重新获取
  });

  // ...
}
```

## 📝 待实现功能

- [ ] 组件库（AdapterCard, AdapterList, AdapterDetail 等）
- [ ] 状态管理（使用 Zustand）
- [ ] 服务层（复杂业务逻辑）
- [ ] WebSocket 实时更新
- [ ] 离线支持
- [ ] 缓存策略优化

## 🤝 贡献指南

1. 遵循项目的代码规范
2. 确保类型定义完整
3. 添加适当的注释
4. 编写单元测试
5. 更新文档

## 📄 许可证

MIT License

