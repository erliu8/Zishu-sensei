# 🧪 分步骤测试指南

## 📊 测试概览
总共 **79个** 单元测试文件，按功能模块分组测试

## 🎯 按模块测试

### 1️⃣ 基础层测试 (Step 1)
```bash
npm run test:step1
```
- **Utils** (9个测试): 工具函数、验证、格式化等
- **Stores** (6个测试): 状态管理、数据存储

### 2️⃣ 服务层测试 (Step 2) 
```bash
npm run test:step2
```
- **Services** (11个测试): API服务、文件服务、加密等
- **Hooks** (15个测试): 自定义React钩子

### 3️⃣ 通用组件测试 (Step 3)
```bash
npm run test:step3
```
- **Common Components** (6个测试): 按钮、输入框、模态框等
- **Layout Components** (6个测试): 布局、侧边栏、标题栏等

### 4️⃣ 核心功能测试 (Step 4)
```bash
npm run test:step4
```
- **Chat Module** (8个测试): 聊天窗口、消息、语音输入
- **Character Module** (11个测试): Live2D角色、动画控制

### 5️⃣ 高级功能测试 (Step 5)
```bash
npm run test:step5
```
- **Settings Module** (3个测试): 设置面板、配置管理
- **Adapter Module** (4个测试): 适配器管理、配置

## 🚀 快速测试命令

### 按类型分组
```bash
# 按文件夹分组
npm run test:hooks        # 15个Hook测试
npm run test:components   # 35个组件测试  
npm run test:services     # 11个服务测试
npm run test:stores       # 6个状态测试
npm run test:utils        # 9个工具测试
```

### 按功能分组
```bash
# 按业务功能分组
npm run test:chat         # 聊天相关测试
npm run test:character    # 角色相关测试
npm run test:settings     # 设置相关测试
npm run test:adapter      # 适配器相关测试
npm run test:layout       # 布局相关测试
npm run test:common       # 通用组件测试
```

### 渐进式测试
```bash
# 一步步执行所有测试
npm run test:progressive

# 或者手动执行每一步
npm run test:step1  # 基础层 (15个测试)
npm run test:step2  # 服务层 (26个测试)  
npm run test:step3  # 通用层 (12个测试)
npm run test:step4  # 核心层 (19个测试)
npm run test:step5  # 高级层 (7个测试)
```

## 💡 测试策略建议

### 🔥 快速验证 (2-3分钟)
```bash
npm run test:utils && npm run test:stores
```

### 🎯 核心功能 (5-8分钟)
```bash
npm run test:chat && npm run test:character
```

### 🔧 完整测试 (10-15分钟)
```bash
npm run test:progressive
```

### 🤫 静默模式
```bash
npm run test:step1 -- --reporter=dot
npm run test:progressive -- --silent
```

## 📈 测试进度追踪

可以创建一个简单的测试脚本来追踪进度：

```bash
# 显示每步测试结果
echo "Step 1: Utils & Stores" && npm run test:step1
echo "Step 2: Services & Hooks" && npm run test:step2  
echo "Step 3: Common & Layout" && npm run test:step3
echo "Step 4: Chat & Character" && npm run test:step4
echo "Step 5: Settings & Adapter" && npm run test:step5
```

这样你就可以根据需要选择合适的测试范围和深度！
useKeyboardShortcuts.test.tsx
usePermission.test.tsx  
useSettings.test.tsx
useTheme.test.tsx
useEncryption.test.tsx