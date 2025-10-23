# 认证页面与流程

## 📋 概述

本目录包含 Zishu 社区平台的所有认证相关页面，包括登录、注册、忘记密码和重置密码功能。

## 🗂️ 目录结构

```
app/(auth)/
├── layout.tsx                 # 认证布局组件
├── login/                     # 登录页面
│   ├── page.tsx
│   └── loading.tsx
├── register/                  # 注册页面
│   ├── page.tsx
│   └── loading.tsx
├── forgot-password/           # 忘记密码页面
│   ├── page.tsx
│   └── loading.tsx
├── reset-password/            # 重置密码页面
│   ├── page.tsx
│   └── loading.tsx
└── README.md                  # 本文档
```

## 📄 页面说明

### 1. 认证布局 (`layout.tsx`)

**功能特性：**
- 响应式双栏布局设计
- 左侧品牌展示区（桌面端）
- 右侧表单区域
- 统一的页面元数据配置
- 优雅的视觉效果和动画

**使用的技术：**
- Next.js 14 App Router Layout
- Tailwind CSS 渐变和动画效果
- Lucide React 图标

### 2. 登录页面 (`/login`)

**路径：** `/login`

**功能特性：**
- 邮箱和密码登录
- 记住我选项
- 忘记密码链接
- GitHub 和 Google 社交登录
- 会话过期提示
- URL 参数支持（重定向、错误提示）

**URL 参数：**
- `?redirect=/path` - 登录成功后的重定向路径
- `?error=message` - 显示错误信息
- `?session_expired=true` - 显示会话过期提示

**示例：**
```
/login
/login?redirect=/profile
/login?session_expired=true
```

### 3. 注册页面 (`/register`)

**路径：** `/register`

**功能特性：**
- 用户名、邮箱、密码注册
- 密码强度验证
- 服务条款和隐私政策确认
- GitHub 和 Google 社交注册
- 自动登录并重定向

**表单验证：**
- 用户名：3-20 个字符，仅字母、数字、下划线、连字符
- 邮箱：有效的邮箱格式
- 密码：至少 8 个字符，包含大小写字母和数字
- 密码确认：必须与密码一致

**URL 参数：**
- `?redirect=/path` - 注册成功后的重定向路径

**示例：**
```
/register
/register?redirect=/characters/create
```

### 4. 忘记密码页面 (`/forgot-password`)

**路径：** `/forgot-password`

**功能特性：**
- 邮箱验证
- 发送密码重置链接
- 成功状态展示
- 重新发送功能
- 返回登录链接

**流程：**
1. 用户输入注册时使用的邮箱
2. 系统发送包含重置令牌的邮件
3. 显示成功提示和说明
4. 用户可选择重新发送或返回登录

### 5. 重置密码页面 (`/reset-password`)

**路径：** `/reset-password?token=xxx`

**功能特性：**
- 令牌验证
- 新密码设置
- 密码强度要求提示
- 成功后自动跳转登录
- 无效令牌错误处理

**URL 参数：**
- `?token=xxx` - 密码重置令牌（必需）

**流程：**
1. 用户从邮件点击重置链接（包含 token）
2. 验证令牌有效性
3. 设置新密码
4. 成功后 3 秒自动跳转到登录页

**示例：**
```
/reset-password?token=abc123xyz789
```

## 🎨 UI 组件

所有页面使用的表单组件位于：
```
src/features/auth/components/
├── LoginForm.tsx              # 登录表单
├── RegisterForm.tsx           # 注册表单
├── ForgotPasswordForm.tsx     # 忘记密码表单
├── ResetPasswordForm.tsx      # 重置密码表单
└── SocialLogin.tsx            # 社交登录组件
```

## 🔐 认证流程

### 登录流程
```
用户输入凭据 
  → LoginForm 验证 
  → useAuth.login() 
  → NextAuth signIn() 
  → 成功：重定向到目标页面
  → 失败：显示错误信息
```

### 注册流程
```
用户填写信息 
  → RegisterForm 验证 
  → useAuth.register() 
  → 创建账号 
  → 自动登录 
  → 重定向到目标页面
```

### 密码重置流程
```
忘记密码页面
  → 输入邮箱 
  → 发送重置邮件 
  → 用户点击邮件链接 
  → 重置密码页面 
  → 设置新密码 
  → 跳转登录页
```

## 📱 响应式设计

所有页面都完全响应式：

- **桌面端 (≥1024px)：** 双栏布局，左侧品牌展示 + 右侧表单
- **平板端 (768px-1023px)：** 单栏布局，居中表单
- **移动端 (<768px)：** 单栏布局，优化的触摸交互

## 🔧 自定义配置

### 修改社交登录提供商

在 `SocialLogin` 组件中配置：
```tsx
<SocialLogin
  providers={['github', 'google']}  // 可添加更多提供商
  onSocialLogin={handleSocialLogin}
/>
```

### 修改重定向路径

默认重定向到首页 `/`，可通过 URL 参数自定义：
```tsx
// 代码中
const redirectTo = searchParams.get('redirect') || '/';

// URL 中
/login?redirect=/dashboard
```

### 修改服务条款链接

在 `RegisterForm` 组件中：
```tsx
<RegisterForm
  termsUrl="/terms"           // 服务条款 URL
  privacyUrl="/privacy"       // 隐私政策 URL
/>
```

## 🧪 测试

### 手动测试检查清单

#### 登录页面
- [ ] 正确的邮箱和密码可以登录
- [ ] 错误的凭据显示错误信息
- [ ] "记住我"功能正常
- [ ] "忘记密码"链接正常跳转
- [ ] 社交登录按钮正常工作
- [ ] 会话过期提示正常显示
- [ ] 重定向参数正常工作

#### 注册页面
- [ ] 所有字段验证正常
- [ ] 密码强度要求生效
- [ ] 服务条款必须同意
- [ ] 注册成功后自动登录
- [ ] 社交注册按钮正常工作

#### 忘记密码页面
- [ ] 邮箱验证正常
- [ ] 提交后显示成功状态
- [ ] "返回登录"链接正常
- [ ] "重新发送"功能正常

#### 重置密码页面
- [ ] 无 token 时显示错误
- [ ] 密码验证正常
- [ ] 重置成功后自动跳转
- [ ] "返回登录"链接正常

## 🐛 常见问题

### Q: 社交登录不工作？
A: 检查 `app/api/auth/[...nextauth]/route.ts` 中的 NextAuth 配置，确保 OAuth 提供商已正确配置。

### Q: 密码重置邮件发送失败？
A: 检查后端 API 的邮件服务配置，确保 SMTP 设置正确。

### Q: 页面样式不正确？
A: 确保 Tailwind CSS 已正确配置，检查 `tailwind.config.ts`。

### Q: 表单验证不生效？
A: 检查 `src/features/auth/schemas/index.ts` 中的 Zod schema 配置。

## 📚 相关文档

- [NextAuth.js 文档](https://next-auth.js.org/)
- [React Hook Form 文档](https://react-hook-form.com/)
- [Zod 验证库文档](https://zod.dev/)
- [Shadcn/ui 组件文档](https://ui.shadcn.com/)

## 🔄 更新日志

### 2025-10-23
- ✅ 实现认证布局组件
- ✅ 实现登录页面和流程
- ✅ 实现注册页面和流程
- ✅ 实现忘记密码页面和流程
- ✅ 实现重置密码页面和流程
- ✅ 添加所有页面的 loading 状态
- ✅ 完善响应式设计
- ✅ 添加社交登录支持

## 👥 维护者

Zishu Frontend Team

---

**最后更新：** 2025-10-23

