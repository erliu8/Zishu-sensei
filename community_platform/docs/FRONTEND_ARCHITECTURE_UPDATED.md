# 🏗️ Zishu Community Platform - 企业级前端架构设计 (更新版)

## 📋 更新说明

**更新日期**: 2025-10-22  
**更新内容**: 基于完整项目需求补充缺失模块，完善文件结构

**主要更新**:
- ✅ 添加角色(Character)模块
- ✅ 完善适配器(Adapter)模块细节
- ✅ 添加评论(Comment)模块
- ✅ 添加社交(Social)功能模块
- ✅ 补充共享组件
- ✅ 完善基础设施层
- ✅ 优化路由结构
- ✅ 完善测试结构

---

## 📦 完整目录结构

```
community-frontend/
├── .github/                           # GitHub配置
│   ├── workflows/                    # CI/CD流程
│   │   ├── ci.yml                   # 持续集成
│   │   ├── cd.yml                   # 持续部署
│   │   └── test.yml                 # 测试流程
│   ├── ISSUE_TEMPLATE/              # Issue模板
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── question.md
│   └── PULL_REQUEST_TEMPLATE.md     # PR模板
│
├── .husky/                           # Git hooks
│   ├── pre-commit                   # 提交前检查
│   ├── pre-push                     # 推送前检查
│   └── commit-msg                   # 提交信息检查
│
├── public/                           # 静态资源
│   ├── images/
│   │   ├── logo.svg
│   │   ├── default-avatar.png
│   │   └── placeholders/
│   ├── fonts/
│   │   └── custom-fonts/
│   ├── icons/
│   │   ├── favicon.ico
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── manifest.json                # PWA配置
│
├── src/
│   ├── app/                         # Next.js App Router
│   │   │
│   │   ├── (auth)/                  # 认证路由组
│   │   │   ├── login/
│   │   │   │   ├── page.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── register/
│   │   │   │   ├── page.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   ├── reset-password/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx           # 认证布局
│   │   │
│   │   ├── (main)/                  # 主应用路由组
│   │   │   │
│   │   │   ├── posts/               # 帖子
│   │   │   │   ├── page.tsx         # 帖子列表
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx     # 帖子详情
│   │   │   │   │   ├── edit/
│   │   │   │   │   │   └── page.tsx # 编辑帖子
│   │   │   │   │   └── loading.tsx
│   │   │   │   ├── create/
│   │   │   │   │   └── page.tsx     # 创建帖子
│   │   │   │   └── loading.tsx
│   │   │   │
│   │   │   ├── adapters/            # 适配器市场
│   │   │   │   ├── page.tsx         # 适配器列表
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx     # 适配器详情
│   │   │   │   │   ├── versions/
│   │   │   │   │   │   └── page.tsx # 版本历史
│   │   │   │   │   └── loading.tsx
│   │   │   │   ├── upload/
│   │   │   │   │   └── page.tsx     # 上传适配器
│   │   │   │   ├── categories/
│   │   │   │   │   └── [slug]/
│   │   │   │   │       └── page.tsx # 分类页面
│   │   │   │   └── loading.tsx
│   │   │   │
│   │   │   ├── characters/          # 🆕 角色系统
│   │   │   │   ├── page.tsx         # 角色列表
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx     # 角色详情
│   │   │   │   │   ├── edit/
│   │   │   │   │   │   └── page.tsx # 编辑角色
│   │   │   │   │   └── loading.tsx
│   │   │   │   ├── create/
│   │   │   │   │   └── page.tsx     # 创建角色
│   │   │   │   └── loading.tsx
│   │   │   │
│   │   │   ├── packaging/           # 🆕 打包服务
│   │   │   │   ├── page.tsx         # 打包配置页面
│   │   │   │   ├── [taskId]/
│   │   │   │   │   └── page.tsx     # 打包任务详情
│   │   │   │   └── history/
│   │   │   │       └── page.tsx     # 打包历史
│   │   │   │
│   │   │   ├── profile/             # 个人中心
│   │   │   │   ├── page.tsx         # 个人主页
│   │   │   │   ├── settings/
│   │   │   │   │   ├── page.tsx     # 账号设置
│   │   │   │   │   ├── profile/
│   │   │   │   │   │   └── page.tsx # 个人资料
│   │   │   │   │   ├── security/
│   │   │   │   │   │   └── page.tsx # 安全设置
│   │   │   │   │   └── preferences/
│   │   │   │   │       └── page.tsx # 偏好设置
│   │   │   │   ├── posts/
│   │   │   │   │   └── page.tsx     # 我的帖子
│   │   │   │   ├── adapters/
│   │   │   │   │   └── page.tsx     # 我的适配器
│   │   │   │   ├── characters/      # 🆕 我的角色
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── favorites/       # 🆕 收藏
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── posts/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── adapters/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── characters/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── followers/       # 🆕 社交关系
│   │   │   │       ├── page.tsx     # 粉丝列表
│   │   │   │       └── following/
│   │   │   │           └── page.tsx # 关注列表
│   │   │   │
│   │   │   ├── search/              # 🆕 搜索
│   │   │   │   └── page.tsx         # 搜索结果页
│   │   │   │
│   │   │   ├── notifications/       # 🆕 通知中心
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── users/               # 用户主页
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   └── layout.tsx           # 主应用布局
│   │   │
│   │   ├── api/                     # 🆕 API Routes
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts     # NextAuth.js
│   │   │   ├── upload/
│   │   │   │   ├── image/
│   │   │   │   │   └── route.ts     # 图片上传
│   │   │   │   ├── file/
│   │   │   │   │   └── route.ts     # 文件上传
│   │   │   │   └── avatar/
│   │   │   │       └── route.ts     # 头像上传
│   │   │   └── webhook/
│   │   │       └── route.ts         # Webhook处理
│   │   │
│   │   ├── layout.tsx               # 根布局
│   │   ├── page.tsx                 # 首页
│   │   ├── globals.css              # 全局样式
│   │   ├── error.tsx                # 错误页
│   │   ├── loading.tsx              # 加载页
│   │   ├── not-found.tsx            # 404页
│   │   └── robots.ts                # 🆕 Robots.txt配置
│   │
│   ├── features/                    # 功能模块（DDD）
│   │   │
│   │   ├── auth/                    # 认证模块
│   │   │   ├── api/
│   │   │   │   ├── AuthApiClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   ├── ForgotPasswordForm.tsx
│   │   │   │   ├── ResetPasswordForm.tsx
│   │   │   │   ├── SocialLogin.tsx
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── User.ts
│   │   │   │   ├── AuthService.ts
│   │   │   │   └── AuthRepository.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useLogin.ts
│   │   │   │   ├── useRegister.ts
│   │   │   │   ├── useLogout.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── AuthService.ts
│   │   │   ├── store/
│   │   │   │   └── authStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── post/                    # 帖子模块
│   │   │   ├── api/
│   │   │   │   ├── PostApiClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── PostCard.tsx
│   │   │   │   ├── PostList.tsx
│   │   │   │   ├── PostDetail.tsx
│   │   │   │   ├── PostForm.tsx
│   │   │   │   ├── PostEditor.tsx
│   │   │   │   ├── PostActions.tsx
│   │   │   │   ├── PostStats.tsx
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── Post.ts
│   │   │   │   ├── PostRepository.ts
│   │   │   │   └── PostService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── usePosts.ts
│   │   │   │   ├── usePost.ts
│   │   │   │   ├── useCreatePost.ts
│   │   │   │   ├── useUpdatePost.ts
│   │   │   │   ├── useDeletePost.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── PostService.ts
│   │   │   ├── store/
│   │   │   │   └── postStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── adapter/                 # 适配器模块（增强）
│   │   │   ├── api/
│   │   │   │   ├── AdapterApiClient.ts
│   │   │   │   ├── AdapterVersionApiClient.ts      # 🆕
│   │   │   │   ├── AdapterCategoryApiClient.ts     # 🆕
│   │   │   │   ├── AdapterRatingApiClient.ts       # 🆕
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── marketplace/                    # 🆕 市场组件
│   │   │   │   │   ├── AdapterMarket.tsx
│   │   │   │   │   ├── CategoryFilter.tsx
│   │   │   │   │   ├── MarketSearchBar.tsx
│   │   │   │   │   ├── SortOptions.tsx
│   │   │   │   │   └── FeaturedAdapters.tsx
│   │   │   │   ├── detail/                         # 🆕 详情组件
│   │   │   │   │   ├── AdapterDetail.tsx
│   │   │   │   │   ├── VersionHistory.tsx
│   │   │   │   │   ├── DependencyTree.tsx
│   │   │   │   │   ├── RatingSection.tsx
│   │   │   │   │   ├── ReviewList.tsx
│   │   │   │   │   ├── DownloadStats.tsx
│   │   │   │   │   └── CompatibilityInfo.tsx
│   │   │   │   ├── upload/                         # 🆕 上传组件
│   │   │   │   │   ├── AdapterUpload.tsx
│   │   │   │   │   ├── VersionPublish.tsx
│   │   │   │   │   ├── MetadataEditor.tsx
│   │   │   │   │   ├── DependencyManager.tsx
│   │   │   │   │   └── FileUploadZone.tsx
│   │   │   │   ├── AdapterCard.tsx
│   │   │   │   ├── AdapterList.tsx
│   │   │   │   ├── AdapterBadge.tsx                # 🆕
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── Adapter.ts
│   │   │   │   ├── AdapterVersion.ts               # 🆕
│   │   │   │   ├── AdapterCategory.ts              # 🆕
│   │   │   │   ├── AdapterDependency.ts            # 🆕
│   │   │   │   ├── AdapterRating.ts                # 🆕
│   │   │   │   ├── AdapterRepository.ts
│   │   │   │   └── AdapterService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useAdapters.ts
│   │   │   │   ├── useAdapter.ts
│   │   │   │   ├── useAdapterVersions.ts           # 🆕
│   │   │   │   ├── useAdapterCategories.ts         # 🆕
│   │   │   │   ├── useAdapterDownload.ts           # 🆕
│   │   │   │   ├── useAdapterRating.ts             # 🆕
│   │   │   │   ├── useCreateAdapter.ts
│   │   │   │   ├── useUpdateAdapter.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── AdapterService.ts
│   │   │   ├── store/
│   │   │   │   └── adapterStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── character/               # 🆕 角色模块
│   │   │   ├── api/
│   │   │   │   ├── CharacterApiClient.ts
│   │   │   │   ├── PersonalityApiClient.ts
│   │   │   │   ├── ExpressionApiClient.ts
│   │   │   │   ├── VoiceApiClient.ts
│   │   │   │   ├── ModelApiClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── CharacterCard.tsx
│   │   │   │   ├── CharacterList.tsx
│   │   │   │   ├── CharacterDetail.tsx
│   │   │   │   ├── CharacterCreator.tsx
│   │   │   │   ├── PersonalityEditor.tsx
│   │   │   │   │   ├── MBTISelector.tsx
│   │   │   │   │   ├── BigFiveTraits.tsx
│   │   │   │   │   └── BehaviorSettings.tsx
│   │   │   │   ├── ExpressionManager.tsx
│   │   │   │   │   ├── ExpressionList.tsx
│   │   │   │   │   ├── ExpressionEditor.tsx
│   │   │   │   │   └── TriggerConfig.tsx
│   │   │   │   ├── VoiceConfig.tsx
│   │   │   │   │   ├── VoiceSelector.tsx
│   │   │   │   │   └── TTSSettings.tsx
│   │   │   │   ├── ModelManager.tsx
│   │   │   │   │   ├── Live2DUpload.tsx
│   │   │   │   │   ├── ModelPreview.tsx
│   │   │   │   │   └── PhysicsConfig.tsx
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── Character.ts
│   │   │   │   ├── Personality.ts
│   │   │   │   ├── Expression.ts
│   │   │   │   ├── Voice.ts
│   │   │   │   ├── Model.ts
│   │   │   │   ├── CharacterRepository.ts
│   │   │   │   └── CharacterService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useCharacters.ts
│   │   │   │   ├── useCharacter.ts
│   │   │   │   ├── useCreateCharacter.ts
│   │   │   │   ├── useUpdateCharacter.ts
│   │   │   │   ├── usePersonality.ts
│   │   │   │   ├── useExpressions.ts
│   │   │   │   ├── useVoices.ts
│   │   │   │   ├── useModels.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── CharacterService.ts
│   │   │   ├── store/
│   │   │   │   └── characterStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── comment/                 # 🆕 评论模块
│   │   │   ├── api/
│   │   │   │   ├── CommentApiClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── CommentList.tsx
│   │   │   │   ├── CommentItem.tsx
│   │   │   │   ├── CommentForm.tsx
│   │   │   │   ├── CommentThread.tsx
│   │   │   │   ├── CommentActions.tsx
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── Comment.ts
│   │   │   │   ├── CommentRepository.ts
│   │   │   │   └── CommentService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useComments.ts
│   │   │   │   ├── useComment.ts
│   │   │   │   ├── useCreateComment.ts
│   │   │   │   ├── useUpdateComment.ts
│   │   │   │   ├── useDeleteComment.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── CommentService.ts
│   │   │   ├── store/
│   │   │   │   └── commentStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── social/                  # 🆕 社交功能模块
│   │   │   ├── api/
│   │   │   │   ├── FollowApiClient.ts
│   │   │   │   ├── LikeApiClient.ts
│   │   │   │   ├── FavoriteApiClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── FollowButton.tsx
│   │   │   │   ├── LikeButton.tsx
│   │   │   │   ├── FavoriteButton.tsx
│   │   │   │   ├── FollowerList.tsx
│   │   │   │   ├── FollowingList.tsx
│   │   │   │   ├── ShareButton.tsx
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── Follow.ts
│   │   │   │   ├── Like.ts
│   │   │   │   ├── Favorite.ts
│   │   │   │   └── SocialService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useFollow.ts
│   │   │   │   ├── useLike.ts
│   │   │   │   ├── useFavorite.ts
│   │   │   │   ├── useFollowers.ts
│   │   │   │   ├── useFollowing.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── SocialService.ts
│   │   │   ├── store/
│   │   │   │   └── socialStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── user/                    # 用户模块
│   │   │   ├── api/
│   │   │   │   ├── UserApiClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── UserCard.tsx
│   │   │   │   ├── UserProfile.tsx
│   │   │   │   ├── UserAvatar.tsx
│   │   │   │   ├── UserSettings.tsx
│   │   │   │   ├── ProfileEditor.tsx
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── User.ts
│   │   │   │   ├── UserRepository.ts
│   │   │   │   └── UserService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useUser.ts
│   │   │   │   ├── useUsers.ts
│   │   │   │   ├── useUpdateUser.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── UserService.ts
│   │   │   ├── store/
│   │   │   │   └── userStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── packaging/               # 打包服务模块
│   │   │   ├── api/
│   │   │   │   ├── PackagingApiClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── ConfigForm.tsx
│   │   │   │   ├── PackagingProgress.tsx
│   │   │   │   ├── DownloadButton.tsx
│   │   │   │   ├── TaskHistory.tsx
│   │   │   │   ├── PackagePreview.tsx
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── PackageConfig.ts
│   │   │   │   ├── PackagingTask.ts
│   │   │   │   ├── PackagingRepository.ts
│   │   │   │   └── PackagingService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useCreatePackage.ts
│   │   │   │   ├── usePackagingStatus.ts
│   │   │   │   ├── usePackagingHistory.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── PackagingService.ts
│   │   │   ├── store/
│   │   │   │   └── packagingStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── notification/            # 通知模块
│   │   │   ├── api/
│   │   │   │   ├── NotificationApiClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── NotificationList.tsx
│   │   │   │   ├── NotificationItem.tsx
│   │   │   │   ├── NotificationBadge.tsx
│   │   │   │   ├── NotificationCenter.tsx
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── Notification.ts
│   │   │   │   ├── NotificationRepository.ts
│   │   │   │   └── NotificationService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useNotifications.ts
│   │   │   │   ├── useMarkAsRead.ts
│   │   │   │   ├── useUnreadCount.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── NotificationService.ts
│   │   │   ├── store/
│   │   │   │   └── notificationStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   └── search/                  # 🆕 搜索模块
│   │       ├── api/
│   │       │   ├── SearchApiClient.ts
│   │       │   └── types.ts
│   │       ├── components/
│   │       │   ├── SearchBar.tsx
│   │       │   ├── SearchResults.tsx
│   │       │   ├── SearchFilters.tsx
│   │       │   ├── SearchHistory.tsx
│   │       │   └── index.ts
│   │       ├── domain/
│   │       │   ├── SearchQuery.ts
│   │       │   ├── SearchResult.ts
│   │       │   └── SearchService.ts
│   │       ├── hooks/
│   │       │   ├── useSearch.ts
│   │       │   ├── useSearchHistory.ts
│   │       │   └── index.ts
│   │       ├── services/
│   │       │   └── SearchService.ts
│   │       ├── store/
│   │       │   └── searchStore.ts
│   │       ├── types/
│   │       │   └── index.ts
│   │       └── index.ts
│   │
│   ├── shared/                      # 共享代码
│   │   │
│   │   ├── components/              # 通用UI组件
│   │   │   │
│   │   │   ├── ui/                  # 基础组件（Shadcn/ui）
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── textarea.tsx               # 🆕
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── badge.tsx                  # 🆕
│   │   │   │   ├── tabs.tsx                   # 🆕
│   │   │   │   ├── dropdown-menu.tsx          # 🆕
│   │   │   │   ├── select.tsx                 # 🆕
│   │   │   │   ├── checkbox.tsx               # 🆕
│   │   │   │   ├── radio-group.tsx            # 🆕
│   │   │   │   ├── switch.tsx                 # 🆕
│   │   │   │   ├── slider.tsx                 # 🆕
│   │   │   │   ├── progress.tsx               # 🆕
│   │   │   │   ├── skeleton.tsx               # 🆕
│   │   │   │   ├── toast.tsx                  # 🆕
│   │   │   │   ├── alert.tsx                  # 🆕
│   │   │   │   ├── separator.tsx              # 🆕
│   │   │   │   ├── tooltip.tsx                # 🆕
│   │   │   │   ├── popover.tsx                # 🆕
│   │   │   │   ├── command.tsx                # 🆕
│   │   │   │   ├── calendar.tsx               # 🆕
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── layout/              # 布局组件
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── Navigation.tsx
│   │   │   │   ├── Container.tsx              # 🆕
│   │   │   │   ├── Grid.tsx                   # 🆕
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── common/              # 通用组件
│   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   ├── LoadingSpinner.tsx
│   │   │   │   ├── Pagination.tsx
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   ├── Avatar.tsx
│   │   │   │   ├── FileUploader.tsx           # 🆕 文件上传
│   │   │   │   ├── ImageUploader.tsx          # 🆕 图片上传
│   │   │   │   ├── MarkdownEditor.tsx         # 🆕 Markdown编辑器
│   │   │   │   ├── MarkdownViewer.tsx         # 🆕 Markdown渲染
│   │   │   │   ├── CodeBlock.tsx              # 🆕 代码块
│   │   │   │   ├── ImageGallery.tsx           # 🆕 图片画廊
│   │   │   │   ├── TagInput.tsx               # 🆕 标签输入
│   │   │   │   ├── RatingStars.tsx            # 🆕 星级评分
│   │   │   │   ├── ProgressBar.tsx            # 🆕 进度条
│   │   │   │   ├── EmptyState.tsx             # 🆕 空状态
│   │   │   │   ├── ErrorState.tsx             # 🆕 错误状态
│   │   │   │   ├── Breadcrumb.tsx             # 🆕 面包屑
│   │   │   │   ├── CopyButton.tsx             # 🆕 复制按钮
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── index.ts
│   │   │
│   │   ├── hooks/                   # 通用Hooks
│   │   │   ├── useDebounce.ts
│   │   │   ├── useLocalStorage.ts
│   │   │   ├── useMediaQuery.ts
│   │   │   ├── useClickOutside.ts
│   │   │   ├── useIntersectionObserver.ts     # 🆕
│   │   │   ├── useClipboard.ts                # 🆕
│   │   │   ├── useToggle.ts                   # 🆕
│   │   │   ├── usePagination.ts               # 🆕
│   │   │   ├── useScrollPosition.ts           # 🆕
│   │   │   ├── useAsync.ts                    # 🆕
│   │   │   └── index.ts
│   │   │
│   │   ├── utils/                   # 工具函数
│   │   │   ├── cn.ts                # className合并
│   │   │   ├── format.ts            # 数据格式化
│   │   │   ├── validate.ts          # 验证函数
│   │   │   ├── date.ts              # 日期处理
│   │   │   ├── string.ts            # 🆕 字符串处理
│   │   │   ├── number.ts            # 🆕 数字处理
│   │   │   ├── file.ts              # 🆕 文件处理
│   │   │   ├── url.ts               # 🆕 URL处理
│   │   │   ├── array.ts             # 🆕 数组操作
│   │   │   ├── object.ts            # 🆕 对象操作
│   │   │   └── index.ts
│   │   │
│   │   ├── constants/               # 🆕 常量定义
│   │   │   ├── routes.ts            # 路由常量
│   │   │   ├── api.ts               # API端点
│   │   │   ├── config.ts            # 配置常量
│   │   │   └── index.ts
│   │   │
│   │   └── types/                   # 共享类型
│   │       ├── common.ts
│   │       ├── api.ts
│   │       ├── ui.ts                # 🆕
│   │       └── index.ts
│   │
│   ├── infrastructure/              # 基础设施层
│   │   │
│   │   ├── api/                     # API基础设施
│   │   │   ├── client.ts            # Axios配置
│   │   │   ├── interceptors.ts      # 拦截器
│   │   │   ├── error-handler.ts     # 错误处理
│   │   │   ├── retry.ts             # 🆕 重试逻辑
│   │   │   ├── cache.ts             # 🆕 HTTP缓存
│   │   │   └── types.ts
│   │   │
│   │   ├── config/                  # 配置管理
│   │   │   ├── env.ts               # 环境变量
│   │   │   ├── features.ts          # 功能开关
│   │   │   ├── constants.ts         # 常量定义
│   │   │   └── index.ts
│   │   │
│   │   ├── providers/               # Context提供者
│   │   │   ├── QueryProvider.tsx    # TanStack Query
│   │   │   ├── AuthProvider.tsx     # 认证Provider
│   │   │   ├── ThemeProvider.tsx    # 主题Provider
│   │   │   ├── WebSocketProvider.tsx # 🆕 WebSocket Provider
│   │   │   ├── I18nProvider.tsx     # 🆕 国际化Provider
│   │   │   └── index.ts
│   │   │
│   │   ├── store/                   # 全局状态
│   │   │   ├── authStore.ts
│   │   │   ├── uiStore.ts
│   │   │   ├── themeStore.ts        # 🆕
│   │   │   └── index.ts
│   │   │
│   │   ├── websocket/               # WebSocket
│   │   │   ├── client.ts
│   │   │   ├── events.ts
│   │   │   ├── hooks.ts             # 🆕 WebSocket Hooks
│   │   │   └── types.ts             # 🆕
│   │   │
│   │   ├── storage/                 # 🆕 存储管理
│   │   │   ├── localStorage.ts      # 本地存储封装
│   │   │   ├── sessionStorage.ts    # 会话存储封装
│   │   │   ├── indexedDB.ts         # IndexedDB（大文件缓存）
│   │   │   └── types.ts
│   │   │
│   │   ├── monitoring/              # 🆕 监控系统
│   │   │   ├── sentry.ts            # Sentry错误监控
│   │   │   ├── analytics.ts         # Google Analytics
│   │   │   ├── performance.ts       # Web Vitals性能监控
│   │   │   └── logger.ts            # 日志系统
│   │   │
│   │   └── i18n/                    # 🆕 国际化
│   │       ├── config.ts
│   │       ├── locales/
│   │       │   ├── zh-CN/
│   │       │   │   ├── common.json
│   │       │   │   ├── auth.json
│   │       │   │   ├── post.json
│   │       │   │   ├── adapter.json
│   │       │   │   └── character.json
│   │       │   ├── en-US/
│   │       │   │   └── ...
│   │       │   └── ja-JP/
│   │       │       └── ...
│   │       ├── hooks/
│   │       │   └── useTranslation.ts
│   │       └── types.ts
│   │
│   ├── styles/                      # 样式文件
│   │   ├── globals.css
│   │   ├── themes/
│   │   │   ├── light.css
│   │   │   ├── dark.css
│   │   │   └── custom.css           # 🆕
│   │   ├── animations.css
│   │   └── variables.css            # 🆕 CSS变量
│   │
│   └── tests/                       # 测试文件
│       │
│       ├── unit/                    # 单元测试
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   │   ├── domain/
│       │   │   │   │   └── User.test.ts
│       │   │   │   ├── services/
│       │   │   │   │   └── AuthService.test.ts
│       │   │   │   └── hooks/
│       │   │   │       └── useAuth.test.ts
│       │   │   ├── post/
│       │   │   │   └── ...
│       │   │   ├── adapter/
│       │   │   │   └── ...
│       │   │   ├── character/                 # 🆕
│       │   │   │   ├── domain/
│       │   │   │   │   ├── Character.test.ts
│       │   │   │   │   └── Personality.test.ts
│       │   │   │   └── services/
│       │   │   │       └── CharacterService.test.ts
│       │   │   ├── user/
│       │   │   │   └── ...
│       │   │   ├── packaging/
│       │   │   │   └── ...
│       │   │   ├── comment/                   # 🆕
│       │   │   │   └── ...
│       │   │   └── social/                    # 🆕
│       │   │       └── ...
│       │   ├── shared/
│       │   │   ├── components/
│       │   │   │   └── ...
│       │   │   ├── hooks/
│       │   │   │   └── ...
│       │   │   └── utils/
│       │   │       └── ...
│       │   └── infrastructure/
│       │       └── ...
│       │
│       ├── integration/              # 集成测试
│       │   ├── api/
│       │   │   ├── auth.test.ts
│       │   │   ├── posts.test.ts
│       │   │   ├── adapters.test.ts
│       │   │   ├── characters.test.ts         # 🆕
│       │   │   ├── comments.test.ts           # 🆕
│       │   │   ├── social.test.ts             # 🆕
│       │   │   └── packaging.test.ts
│       │   └── websocket/                     # 🆕
│       │       └── packaging.test.ts
│       │
│       ├── e2e/                     # E2E测试
│       │   ├── auth/
│       │   │   ├── login.spec.ts
│       │   │   └── register.spec.ts
│       │   ├── post/
│       │   │   ├── create-post.spec.ts
│       │   │   └── comment-on-post.spec.ts
│       │   ├── adapter/
│       │   │   ├── browse-market.spec.ts
│       │   │   ├── download-adapter.spec.ts
│       │   │   └── upload-adapter.spec.ts
│       │   ├── character/                     # 🆕
│       │   │   ├── create-character.spec.ts
│       │   │   └── customize-personality.spec.ts
│       │   ├── social/                        # 🆕
│       │   │   ├── follow-user.spec.ts
│       │   │   └── like-post.spec.ts
│       │   └── packaging/
│       │       └── create-package.spec.ts
│       │
│       ├── mocks/                   # Mock数据
│       │   ├── handlers/            # MSW handlers
│       │   │   ├── auth.ts
│       │   │   ├── post.ts
│       │   │   ├── adapter.ts
│       │   │   ├── character.ts               # 🆕
│       │   │   ├── comment.ts                 # 🆕
│       │   │   ├── user.ts
│       │   │   ├── social.ts                  # 🆕
│       │   │   └── packaging.ts
│       │   ├── data/                # Mock数据
│       │   │   ├── posts.ts
│       │   │   ├── adapters.ts
│       │   │   ├── characters.ts              # 🆕
│       │   │   ├── comments.ts                # 🆕
│       │   │   └── users.ts
│       │   └── browser.ts           # MSW浏览器配置
│       │
│       ├── fixtures/                # 测试固件
│       │   └── ...
│       │
│       └── setup.ts                 # 测试配置
│
├── docs/                            # 文档
│   ├── ARCHITECTURE.md              # 架构文档
│   ├── FRONTEND_ARCHITECTURE.md     # 前端架构（本文档）
│   ├── API.md                       # API接口文档
│   ├── COMPONENTS.md                # 组件文档
│   ├── DEVELOPMENT.md               # 开发指南
│   ├── DEPLOYMENT.md                # 部署指南
│   ├── TESTING.md                   # 🆕 测试指南
│   ├── I18N.md                      # 🆕 国际化指南
│   └── CONTRIBUTING.md              # 🆕 贡献指南
│
├── .github/
├── .husky/
├── public/
├── .env.example
├── .env.local
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts             # 🆕 Playwright配置
├── package.json
└── README.md
```

---

## 🎯 关键更新说明

### 1. 新增核心模块

#### 🆕 Character（角色模块）
- **目的**: 支持完整的AI角色创建、管理和分享功能
- **特性**: 
  - 人格配置（MBTI、大五人格）
  - 表情动画管理
  - 语音TTS配置
  - Live2D模型上传和管理
- **对应后端**: `zishu/models/character.py`

#### 🆕 Comment（评论模块）
- **目的**: 为帖子、适配器、角色提供评论功能
- **特性**: 评论树、回复、点赞
- **UGC能力**: 增强社区互动

#### 🆕 Social（社交模块）
- **目的**: 用户间的社交互动
- **特性**: 关注、点赞、收藏、分享
- **社区建设**: 构建用户关系网络

#### 🆕 Search（搜索模块）
- **目的**: 全站搜索功能
- **特性**: 多类型搜索、高级筛选、搜索历史
- **用户体验**: 快速找到所需内容

### 2. 模块细化和完善

#### Adapter 模块增强
- 拆分为 `marketplace/`、`detail/`、`upload/` 子组件
- 添加版本管理、依赖树、评分系统
- 完善下载统计和兼容性信息

#### 共享组件补充
- 添加 20+ Shadcn/ui 基础组件
- 增加专业组件（Markdown编辑器、代码块、文件上传等）
- 完善布局组件

#### 基础设施层完善
- 添加存储管理（localStorage、sessionStorage、IndexedDB）
- 添加监控系统（Sentry、Analytics、Performance）
- 添加国际化支持（i18n）
- 完善 WebSocket 封装

### 3. 路由结构优化

#### 新增页面路由
- `/characters/*` - 角色相关页面
- `/packaging/*` - 打包服务页面
- `/search` - 搜索页面
- `/notifications` - 通知中心
- `/profile/favorites/*` - 收藏页面
- `/profile/followers/*` - 社交关系页面

#### API Routes
- 添加文件上传端点
- 添加 NextAuth.js 集成
- 添加 Webhook 处理

### 4. 测试完善

- 为新模块添加对应测试
- 补充 WebSocket 集成测试
- 添加社交功能 E2E 测试
- 完善 MSW Mock 数据

---

## 📊 模块依赖关系图

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│                       (App Router)                       │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                     Features Layer                       │
│  ┌───────┐ ┌───────┐ ┌──────────┐ ┌─────────┐          │
│  │ Auth  │ │ Post  │ │ Adapter  │ │Character│  🆕      │
│  └───┬───┘ └───┬───┘ └────┬─────┘ └────┬────┘          │
│      │         │           │            │               │
│  ┌───┴───┐ ┌───┴───┐ ┌────┴─────┐ ┌────┴────┐          │
│  │ User  │ │Comment│ │ Social   │ │Packaging│  🆕      │
│  └───────┘ └───────┘ └──────────┘ └─────────┘          │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                   Shared & Infrastructure                │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐               │
│  │Components│ │  Hooks   │ │   Utils    │               │
│  └─────────┘ └──────────┘ └────────────┘               │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐               │
│  │   API   │ │WebSocket │ │  Storage   │  🆕           │
│  └─────────┘ └──────────┘ └────────────┘               │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐               │
│  │Monitoring│ │   i18n   │ │  Providers │  🆕           │
│  └─────────┘ └──────────┘ └────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 下一步行动计划

### 优先级 P0（核心功能）
1. ✅ 完善认证模块（Auth）
2. ✅ 实现帖子模块（Post）
3. ✅ 实现适配器市场（Adapter）
4. 🆕 实现角色模块（Character）
5. ✅ 实现打包服务（Packaging）

### 优先级 P1（重要功能）
6. 🆕 实现评论系统（Comment）
7. 🆕 实现社交功能（Social）
8. 🆕 实现搜索功能（Search）
9. 🆕 实现通知系统（Notification）
10. ✅ 完善用户模块（User）

### 优先级 P2（增强功能）
11. 🆕 添加国际化支持（i18n）
12. 🆕 集成监控系统（Monitoring）
13. 🆕 性能优化和缓存
14. 🆕 PWA支持
15. 🆕 暗色模式完善

---

## 📚 相关文档

- [后端 API 文档](./API.md)
- [组件使用指南](./COMPONENTS.md)
- [开发指南](./DEVELOPMENT.md)
- [部署指南](./DEPLOYMENT.md)
- [测试指南](./TESTING.md) 🆕
- [国际化指南](./I18N.md) 🆕
- [贡献指南](./CONTRIBUTING.md) 🆕

---

**更新维护者**: Zishu Team  
**最后更新**: 2025-10-22  
**版本**: 2.0.0

