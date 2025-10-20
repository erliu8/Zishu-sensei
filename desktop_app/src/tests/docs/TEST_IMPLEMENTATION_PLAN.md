# 桌面应用测试实施计划

> 本文档详细列出需要创建的所有测试套件、测试文件和测试用例
> 
> **当前状态**: MSW 配置已修复 ✅
> **目标覆盖率**: 80%+
> **更新日期**: 2025-10-18

---

## 📋 目录

- [1. 组件测试 (Components)](#1-组件测试-components)
  - [1.1 Character 组件群](#11-character-组件群)
  - [1.2 Chat 组件群](#12-chat-组件群)
  - [1.3 Settings 组件群](#13-settings-组件群)
  - [1.4 Adapter 组件群](#14-adapter-组件群)
  - [1.5 Layout 组件群](#15-layout-组件群)
  - [1.6 Common 通用组件](#16-common-通用组件)
- [2. Store 状态管理测试](#2-store-状态管理测试)
- [3. Hooks 测试](#3-hooks-测试)
- [4. Services 服务层测试](#4-services-服务层测试)
- [5. Utils 工具函数测试](#5-utils-工具函数测试)
- [6. 集成测试](#6-集成测试)
- [7. E2E 测试](#7-e2e-测试)
- [8. 性能测试](#8-性能测试) ✅

---

## 1. 组件测试 (Components)

### 1.1 Character 组件群

#### 📁 `tests/unit/components/Character/Character.test.tsx`
**主要 Character 组件测试**

测试用例：
- ✅ **渲染测试**
  - [ ] 应该正确渲染角色组件
  - [ ] 当没有角色时应该返回 null
  - [ ] 应该正确传递角色数据到 Live2D 组件
  
- ✅ **配置测试**
  - [ ] 应该正确生成 Hiyori 模型配置
  - [ ] 应该正确设置 Live2D 查看器配置
  - [ ] 配置应该使用 useMemo 缓存
  
- ✅ **交互测试**
  - [ ] 应该处理 Live2D 交互事件
  - [ ] 应该触发 onInteraction 回调
  - [ ] 应该正确传递交互数据
  
- ✅ **生命周期测试**
  - [ ] 应该处理模型加载完成事件
  - [ ] 应该处理模型加载错误
  - [ ] 应该记录错误到控制台

#### 📁 `tests/unit/components/Character/Live2D/Live2DViewer.test.tsx`
**Live2D 查看器组件测试**

测试用例：
- ✅ **初始化测试**
  - [ ] 应该正确初始化 Live2D 引擎
  - [ ] 应该创建 canvas 元素
  - [ ] 应该设置正确的 canvas 尺寸
  - [ ] 应该应用自定义样式和类名
  
- ✅ **模型加载测试**
  - [ ] 应该加载指定的模型配置
  - [ ] 应该显示加载指示器
  - [ ] 加载成功后应该隐藏加载指示器
  - [ ] 加载失败应该显示错误信息
  - [ ] 应该触发 onModelLoad 回调
  
- ✅ **渲染测试**
  - [ ] 应该以指定 FPS 渲染
  - [ ] 应该应用缩放配置
  - [ ] 应该应用位置配置
  - [ ] 应该应用透明度配置
  - [ ] 响应式模式下应该自适应容器大小
  
- ✅ **动画测试**
  - [ ] 应该播放指定动画
  - [ ] 应该支持动画优先级
  - [ ] 应该自动播放空闲动画
  - [ ] 应该根据间隔切换空闲动画
  - [ ] 应该处理动画结束事件
  
- ✅ **表情测试**
  - [ ] 应该切换表情
  - [ ] 应该支持表情淡入淡出
  - [ ] 表情文件不存在时应该优雅降级
  
- ✅ **交互测试**
  - [ ] 应该响应点击事件
  - [ ] 应该检测点击命中区域
  - [ ] 应该播放点击动画
  - [ ] 应该触发 onInteraction 回调
  - [ ] enableInteraction=false 时应该禁用交互
  
- ✅ **性能测试**
  - [ ] 应该监控 FPS
  - [ ] 应该监控内存使用
  - [ ] 应该应用纹理压缩
  - [ ] 应该应用抗锯齿
  - [ ] 低性能时应该降低渲染质量
  
- ✅ **控制面板测试**
  - [ ] 应该显示/隐藏控制面板
  - [ ] 应该支持播放/暂停
  - [ ] 应该支持动画选择
  - [ ] 应该支持表情选择
  - [ ] 应该支持缩放控制
  - [ ] 应该支持重置位置
  - [ ] 应该支持全屏模式
  - [ ] 应该支持自动隐藏
  
- ✅ **清理测试**
  - [ ] 组件卸载时应该释放资源
  - [ ] 应该停止动画循环
  - [ ] 应该清理事件监听器

#### 📁 `tests/unit/components/Character/Live2D/Live2DController.test.tsx`
**Live2D 控制器测试**

测试用例：
- ✅ **API 测试**
  - [ ] loadModel() 应该加载模型
  - [ ] playAnimation() 应该播放动画
  - [ ] setExpression() 应该设置表情
  - [ ] startAutoIdle() 应该启动自动空闲
  - [ ] stopAutoIdle() 应该停止自动空闲
  - [ ] setScale() 应该设置缩放
  - [ ] setPosition() 应该设置位置
  - [ ] resetPosition() 应该重置位置
  
- ✅ **状态管理测试**
  - [ ] 应该跟踪当前动画
  - [ ] 应该跟踪当前表情
  - [ ] 应该跟踪加载状态
  - [ ] 应该跟踪性能指标

#### 📁 `tests/unit/components/Character/Live2D/Live2DControlPanel.test.tsx`
**Live2D 控制面板测试**

测试用例：
- ✅ **UI 测试**
  - [ ] 应该渲染所有控制按钮
  - [ ] 应该根据配置显示/隐藏按钮
  - [ ] 应该应用正确的位置（top/bottom）
  - [ ] 应该支持自动隐藏
  
- ✅ **交互测试**
  - [ ] 点击播放/暂停应该切换状态
  - [ ] 选择动画应该触发回调
  - [ ] 选择表情应该触发回调
  - [ ] 缩放按钮应该改变缩放值
  - [ ] 重置按钮应该重置位置

#### 📁 `tests/unit/components/Character/Live2D/Live2DLoadingIndicator.test.tsx`
**Live2D 加载指示器测试**

测试用例：
- ✅ **显示测试**
  - [ ] loading=true 时应该显示
  - [ ] loading=false 时应该隐藏
  - [ ] 应该显示加载进度
  - [ ] 应该显示加载消息
  
- ✅ **动画测试**
  - [ ] 应该有旋转动画
  - [ ] 应该有淡入淡出效果

#### 📁 `tests/unit/components/Character/Live2D/ModelLoader.test.tsx`
**模型加载器测试**

测试用例：
- ✅ **加载测试**
  - [ ] 应该加载 model3.json 文件
  - [ ] 应该加载纹理资源
  - [ ] 应该加载动画文件
  - [ ] 应该加载表情文件
  - [ ] 应该加载物理文件
  
- ✅ **错误处理**
  - [ ] 模型文件不存在应该抛出错误
  - [ ] 纹理加载失败应该抛出错误
  - [ ] 应该提供详细的错误信息
  
- ✅ **缓存测试**
  - [ ] 应该缓存已加载的模型
  - [ ] 重复加载应该使用缓存

#### 📁 `tests/unit/components/Character/Animations/AnimationController.test.tsx`
**动画控制器测试**

测试用例：
- ✅ **播放控制**
  - [ ] play() 应该播放动画
  - [ ] pause() 应该暂停动画
  - [ ] stop() 应该停止动画
  - [ ] resume() 应该恢复动画
  
- ✅ **队列管理**
  - [ ] 应该支持动画队列
  - [ ] 应该按顺序播放队列中的动画
  - [ ] 应该支持插入高优先级动画
  - [ ] 队列为空时应该播放默认动画
  
- ✅ **混合测试**
  - [ ] 应该支持多个动画混合
  - [ ] 应该正确计算混合权重
  - [ ] 应该平滑过渡动画

#### 📁 `tests/unit/components/Character/Animations/AnimationPlayer.test.tsx`
**动画播放器测试**

测试用例：
- ✅ **播放测试**
  - [ ] 应该从头播放动画
  - [ ] 应该支持循环播放
  - [ ] 应该支持播放到指定时间
  - [ ] 应该触发播放完成回调
  
- ✅ **时间控制**
  - [ ] 应该正确更新时间
  - [ ] 应该支持播放速度调整
  - [ ] 应该支持反向播放

#### 📁 `tests/unit/components/Character/Animations/AnimationQueue.test.tsx`
**动画队列测试**

测试用例：
- ✅ **队列操作**
  - [ ] enqueue() 应该添加动画到队列
  - [ ] dequeue() 应该移除并返回第一个动画
  - [ ] clear() 应该清空队列
  - [ ] peek() 应该返回但不移除第一个动画
  
- ✅ **优先级测试**
  - [ ] 应该按优先级排序
  - [ ] 相同优先级应该按添加顺序
  - [ ] 应该支持插入紧急动画

#### 📁 `tests/unit/components/Character/Animations/AnimationPresets.test.tsx`
**动画预设测试**

测试用例：
- ✅ **预设测试**
  - [ ] 应该提供常用动画预设
  - [ ] 应该包含动画参数
  - [ ] 应该支持自定义预设

#### 📁 `tests/unit/components/Character/Animations/MotionPlayer.test.tsx`
**动作播放器测试**

测试用例：
- ✅ **Motion3.json 支持**
  - [ ] 应该解析 motion3.json 文件
  - [ ] 应该应用动作到模型
  - [ ] 应该处理曲线插值
  - [ ] 应该支持淡入淡出

---

### 1.2 Chat 组件群

#### 📁 `tests/unit/components/Chat/ChatWindow.test.tsx`
**聊天窗口组件测试**

测试用例：
- ✅ **渲染测试**
  - [ ] 应该渲染聊天窗口
  - [ ] 应该显示消息列表
  - [ ] 应该显示输入区域
  - [ ] 应该显示当前角色信息
  
- ✅ **消息测试**
  - [ ] 应该显示历史消息
  - [ ] 应该支持发送文本消息
  - [ ] 应该支持发送语音消息
  - [ ] 新消息应该自动滚动到底部
  - [ ] 应该显示消息发送状态
  
- ✅ **交互测试**
  - [ ] 应该处理输入框输入
  - [ ] Enter 键应该发送消息
  - [ ] Shift+Enter 应该换行
  - [ ] 应该清空已发送的输入
  
- ✅ **状态测试**
  - [ ] 应该显示"正在输入"指示器
  - [ ] 应该显示"正在思考"动画
  - [ ] 连接断开时应该显示提示

#### 📁 `tests/unit/components/Chat/MessageList.test.tsx`
**消息列表组件测试**

测试用例：
- ✅ **渲染测试**
  - [ ] 应该渲染消息列表
  - [ ] 应该区分用户消息和 AI 消息
  - [ ] 应该显示消息时间
  - [ ] 应该显示消息状态（发送中/已发送/失败）
  
- ✅ **格式化测试**
  - [ ] 应该渲染 Markdown 格式
  - [ ] 应该高亮代码块
  - [ ] 应该渲染链接
  - [ ] 应该渲染图片
  
- ✅ **滚动测试**
  - [ ] 新消息应该自动滚动到底部
  - [ ] 用户滚动时应该停止自动滚动
  - [ ] 滚动到底部后应该恢复自动滚动
  
- ✅ **虚拟滚动测试**
  - [ ] 大量消息应该使用虚拟滚动
  - [ ] 应该只渲染可见区域的消息
  - [ ] 滚动应该流畅

#### 📁 `tests/unit/components/Chat/InputArea.test.tsx`
**输入区域组件测试**

测试用例：
- ✅ **输入测试**
  - [ ] 应该渲染输入框
  - [ ] 应该支持多行输入
  - [ ] 应该支持自动调整高度
  - [ ] 应该有最大高度限制
  
- ✅ **按钮测试**
  - [ ] 应该显示发送按钮
  - [ ] 应该显示语音输入按钮
  - [ ] 应该显示附件按钮
  - [ ] 输入为空时发送按钮应该禁用
  
- ✅ **快捷键测试**
  - [ ] Enter 应该发送消息
  - [ ] Shift+Enter 应该换行
  - [ ] Ctrl+Enter 应该发送消息（可配置）
  
- ✅ **限制测试**
  - [ ] 应该限制最大字符数
  - [ ] 超过限制应该显示提示
  - [ ] 应该显示剩余字符数

#### 📁 `tests/unit/components/Chat/VoiceInput.test.tsx`
**语音输入组件测试**

测试用例：
- ✅ **录音测试**
  - [ ] 点击按钮应该开始录音
  - [ ] 应该请求麦克风权限
  - [ ] 权限被拒绝应该显示提示
  - [ ] 应该显示录音动画
  - [ ] 应该显示录音时长
  
- ✅ **停止测试**
  - [ ] 再次点击应该停止录音
  - [ ] 应该自动停止超长录音
  - [ ] 应该发送音频数据
  
- ✅ **取消测试**
  - [ ] 应该支持取消录音
  - [ ] 取消后应该丢弃音频数据
  
- ✅ **错误处理**
  - [ ] 麦克风不可用应该显示错误
  - [ ] 录音失败应该显示错误

#### 📁 `tests/unit/components/Chat/MessageBubble.test.tsx`
**消息气泡组件测试**

测试用例：
- ✅ **样式测试**
  - [ ] 用户消息应该靠右显示
  - [ ] AI 消息应该靠左显示
  - [ ] 应该应用正确的背景色
  - [ ] 应该显示头像
  
- ✅ **内容测试**
  - [ ] 应该渲染纯文本
  - [ ] 应该渲染 Markdown
  - [ ] 应该渲染代码块
  - [ ] 应该支持复制内容
  
- ✅ **操作测试**
  - [ ] 应该显示操作菜单
  - [ ] 应该支持复制消息
  - [ ] 应该支持删除消息
  - [ ] 应该支持重新发送失败的消息

#### 📁 `tests/unit/components/Chat/TypingIndicator.test.tsx`
**输入指示器组件测试**

测试用例：
- ✅ **动画测试**
  - [ ] 应该显示跳动的点
  - [ ] 应该有淡入淡出效果
  - [ ] 应该显示"正在输入..."文本

---

### 1.3 Settings 组件群

#### 📁 `tests/unit/components/Settings/SettingsPanel.test.tsx`
**设置面板组件测试**

测试用例：
- ✅ **渲染测试**
  - [ ] 应该渲染设置面板
  - [ ] 应该显示所有设置分类
  - [ ] 应该支持搜索设置项
  
- ✅ **导航测试**
  - [ ] 应该显示分类导航
  - [ ] 点击分类应该切换内容
  - [ ] 应该高亮当前分类
  
- ✅ **保存测试**
  - [ ] 应该保存设置更改
  - [ ] 应该显示保存状态
  - [ ] 保存失败应该显示错误

#### 📁 `tests/unit/components/Settings/GeneralSettings.test.tsx`
**通用设置测试**

测试用例：
- ✅ **语言设置**
  - [ ] 应该显示语言选择器
  - [ ] 应该切换语言
  - [ ] 应该保存语言选择
  
- ✅ **主题设置**
  - [ ] 应该显示主题选择器
  - [ ] 应该切换主题
  - [ ] 应该支持自动主题
  
- ✅ **启动设置**
  - [ ] 应该设置开机启动
  - [ ] 应该设置启动时最小化

#### 📁 `tests/unit/components/Settings/CharacterSettings.test.tsx`
**角色设置测试**

测试用例：
- ✅ **模型选择**
  - [ ] 应该显示可用模型列表
  - [ ] 应该选择模型
  - [ ] 应该预览模型
  
- ✅ **显示设置**
  - [ ] 应该设置模型尺寸
  - [ ] 应该设置模型位置
  - [ ] 应该设置透明度

#### 📁 `tests/unit/components/Settings/VoiceSettings.test.tsx`
**语音设置测试**

测试用例：
- ✅ **TTS 设置**
  - [ ] 应该选择语音引擎
  - [ ] 应该调整语速
  - [ ] 应该调整音量
  - [ ] 应该测试语音
  
- ✅ **STT 设置**
  - [ ] 应该选择识别引擎
  - [ ] 应该选择输入设备
  - [ ] 应该测试麦克风

#### 📁 `tests/unit/components/Settings/AdapterSettings.test.tsx`
**适配器设置测试**

测试用例：
- ✅ **适配器管理**
  - [ ] 应该显示已安装适配器
  - [ ] 应该启用/禁用适配器
  - [ ] 应该配置适配器参数
  - [ ] 应该卸载适配器

---

### 1.4 Adapter 组件群

#### 📁 `tests/unit/components/Adapter/AdapterManagement.test.tsx`
**适配器管理组件测试**

测试用例：
- ✅ **列表测试**
  - [ ] 应该显示适配器列表
  - [ ] 应该显示适配器状态
  - [ ] 应该显示适配器信息
  
- ✅ **搜索测试**
  - [ ] 应该搜索适配器
  - [ ] 应该过滤适配器
  - [ ] 应该显示搜索结果
  
- ✅ **配置测试**
  - [ ] 应该打开配置对话框
  - [ ] 应该保存配置
  - [ ] 应该验证配置

#### 📁 `tests/unit/components/Adapter/AdapterList.test.tsx`
**适配器列表测试**

测试用例：
- ✅ **渲染测试**
  - [ ] 应该渲染适配器列表
  - [ ] 应该显示适配器图标
  - [ ] 应该显示适配器名称和描述
  - [ ] 应该显示适配器状态
  
- ✅ **操作测试**
  - [ ] 应该启动/停止适配器
  - [ ] 应该打开配置
  - [ ] 应该卸载适配器

#### 📁 `tests/unit/components/Adapter/AdapterSearch.test.tsx`
**适配器搜索测试**

测试用例：
- ✅ **搜索测试**
  - [ ] 应该搜索在线适配器
  - [ ] 应该显示搜索结果
  - [ ] 应该过滤已安装适配器
  
- ✅ **安装测试**
  - [ ] 应该安装适配器
  - [ ] 应该显示安装进度
  - [ ] 安装失败应该显示错误

#### 📁 `tests/unit/components/Adapter/AdapterConfig.test.tsx`
**适配器配置测试**

测试用例：
- ✅ **表单测试**
  - [ ] 应该渲染配置表单
  - [ ] 应该显示所有配置项
  - [ ] 应该验证配置值
  
- ✅ **保存测试**
  - [ ] 应该保存配置
  - [ ] 验证失败应该阻止保存
  - [ ] 应该重启适配器应用配置

---

### 1.5 Layout 组件群

#### 📁 `tests/unit/components/Layout/MainLayout.test.tsx`
**主布局组件测试**

测试用例：
- ✅ **渲染测试**
  - [ ] 应该渲染主布局
  - [ ] 应该包含侧边栏
  - [ ] 应该包含内容区
  - [ ] 应该包含角色区
  
- ✅ **响应式测试**
  - [ ] 小屏幕应该隐藏侧边栏
  - [ ] 应该支持展开/收起侧边栏

#### 📁 `tests/unit/components/Layout/Sidebar.test.tsx`
**侧边栏组件测试**

测试用例：
- ✅ **导航测试**
  - [ ] 应该显示导航菜单
  - [ ] 应该高亮当前页面
  - [ ] 点击应该导航到对应页面
  
- ✅ **用户信息测试**
  - [ ] 应该显示用户信息
  - [ ] 应该显示头像
  - [ ] 点击应该打开用户菜单

#### 📁 `tests/unit/components/Layout/TitleBar.test.tsx`
**标题栏组件测试**

测试用例：
- ✅ **渲染测试**
  - [ ] 应该显示应用标题
  - [ ] 应该显示窗口控制按钮
  
- ✅ **窗口控制测试**
  - [ ] 点击最小化应该最小化窗口
  - [ ] 点击最大化应该最大化窗口
  - [ ] 点击关闭应该关闭窗口
  - [ ] macOS 应该显示红绿灯按钮

---

### 1.6 Common 通用组件

#### 📁 `tests/unit/components/Common/Button.test.tsx`
**按钮组件测试**

测试用例：
- ✅ **样式测试**
  - [ ] 应该应用 primary 样式
  - [ ] 应该应用 secondary 样式
  - [ ] 应该应用 danger 样式
  - [ ] 应该应用 size 变体
  
- ✅ **状态测试**
  - [ ] disabled 时应该禁用
  - [ ] loading 时应该显示加载指示器
  - [ ] loading 时应该禁用点击
  
- ✅ **交互测试**
  - [ ] 点击应该触发 onClick
  - [ ] 应该支持图标

#### 📁 `tests/unit/components/Common/Input.test.tsx`
**输入框组件测试**

测试用例：
- ✅ **基础测试**
  - [ ] 应该渲染输入框
  - [ ] 应该显示 placeholder
  - [ ] 应该显示 label
  
- ✅ **验证测试**
  - [ ] 应该显示错误信息
  - [ ] 应该应用错误样式
  - [ ] 应该显示必填标记
  
- ✅ **类型测试**
  - [ ] 应该支持 text 类型
  - [ ] 应该支持 password 类型
  - [ ] 应该支持 number 类型
  - [ ] 应该支持 email 类型

#### 📁 `tests/unit/components/Common/Modal.test.tsx`
**模态框组件测试**

测试用例：
- ✅ **显示测试**
  - [ ] open=true 应该显示
  - [ ] open=false 应该隐藏
  - [ ] 应该显示遮罩层
  
- ✅ **关闭测试**
  - [ ] 点击遮罩应该关闭（可配置）
  - [ ] 按 ESC 应该关闭（可配置）
  - [ ] 点击关闭按钮应该关闭
  
- ✅ **内容测试**
  - [ ] 应该渲染标题
  - [ ] 应该渲染内容
  - [ ] 应该渲染底部按钮

#### 📁 `tests/unit/components/Common/Select.test.tsx`
**选择器组件测试**

测试用例：
- ✅ **渲染测试**
  - [ ] 应该显示当前选中值
  - [ ] 应该显示占位符
  - [ ] 点击应该展开选项
  
- ✅ **选择测试**
  - [ ] 点击选项应该选中
  - [ ] 应该触发 onChange
  - [ ] 应该关闭下拉框
  
- ✅ **搜索测试**
  - [ ] 应该支持搜索选项
  - [ ] 应该过滤选项
  - [ ] 无匹配应该显示提示

#### 📁 `tests/unit/components/Common/Tooltip.test.tsx`
**工具提示组件测试**

测试用例：
- ✅ **显示测试**
  - [ ] 鼠标悬停应该显示
  - [ ] 鼠标移出应该隐藏
  - [ ] 应该有延迟显示
  
- ✅ **位置测试**
  - [ ] 应该支持 top 位置
  - [ ] 应该支持 bottom 位置
  - [ ] 应该支持 left 位置
  - [ ] 应该支持 right 位置
  - [ ] 应该自动调整位置避免溢出

#### 📁 `tests/unit/components/Common/Loading.test.tsx`
**加载指示器组件测试**

测试用例：
- ✅ **样式测试**
  - [ ] 应该显示旋转动画
  - [ ] 应该支持不同尺寸
  - [ ] 应该支持自定义颜色
  
- ✅ **文本测试**
  - [ ] 应该显示加载文本
  - [ ] 应该支持自定义文本

---

## 2. Store 状态管理测试

### 📁 `tests/unit/stores/adapterStore.test.ts`
**适配器状态管理测试**

测试用例：
- ✅ **初始状态**
  - [ ] adapters 应该为空数组
  - [ ] loading 应该为 false
  - [ ] error 应该为 null
  
- ✅ **获取适配器列表**
  - [ ] fetchAdapters() 应该加载适配器
  - [ ] 应该更新 adapters 状态
  - [ ] 失败应该设置 error
  
- ✅ **安装适配器**
  - [ ] installAdapter() 应该安装适配器
  - [ ] 应该添加到列表
  - [ ] 应该更新状态为 installed
  
- ✅ **卸载适配器**
  - [ ] uninstallAdapter() 应该卸载适配器
  - [ ] 应该从列表移除
  
- ✅ **启动/停止适配器**
  - [ ] startAdapter() 应该启动适配器
  - [ ] stopAdapter() 应该停止适配器
  - [ ] 应该更新状态
  
- ✅ **配置适配器**
  - [ ] configureAdapter() 应该保存配置
  - [ ] 应该验证配置
  - [ ] 应该重启适配器

### 📁 `tests/unit/stores/characterStore.test.ts`
**角色状态管理测试**

测试用例：
- ✅ **初始状态**
  - [ ] currentCharacter 应该为 null
  - [ ] characters 应该为空数组
  
- ✅ **获取角色列表**
  - [ ] fetchCharacters() 应该加载角色
  - [ ] 应该更新 characters 状态
  
- ✅ **选择角色**
  - [ ] selectCharacter() 应该设置当前角色
  - [ ] 应该加载角色模型
  - [ ] 应该触发模型切换
  
- ✅ **角色动画**
  - [ ] playAnimation() 应该播放动画
  - [ ] setExpression() 应该设置表情
  
- ✅ **角色交互**
  - [ ] handleInteraction() 应该处理交互
  - [ ] 应该记录交互历史

### 📁 `tests/unit/stores/chatStore.test.ts`
**聊天状态管理测试**

测试用例：
- ✅ **初始状态**
  - [ ] messages 应该为空数组
  - [ ] isTyping 应该为 false
  - [ ] currentConversation 应该为 null
  
- ✅ **发送消息**
  - [ ] sendMessage() 应该添加用户消息
  - [ ] 应该调用 AI 接口
  - [ ] 应该添加 AI 响应
  - [ ] 失败应该标记消息状态
  
- ✅ **对话管理**
  - [ ] createConversation() 应该创建新对话
  - [ ] switchConversation() 应该切换对话
  - [ ] deleteConversation() 应该删除对话
  
- ✅ **消息操作**
  - [ ] deleteMessage() 应该删除消息
  - [ ] resendMessage() 应该重发失败的消息
  - [ ] clearMessages() 应该清空消息
  
- ✅ **输入状态**
  - [ ] setTyping() 应该设置输入状态
  - [ ] 应该自动清除输入状态

### 📁 `tests/unit/stores/desktopStore.test.ts`
**桌面操作状态管理测试**

测试用例：
- ✅ **初始状态**
  - [ ] windows 应该为空数组
  - [ ] systemResources 应该为 null
  
- ✅ **窗口管理**
  - [ ] getWindows() 应该获取窗口列表
  - [ ] focusWindow() 应该聚焦窗口
  - [ ] closeWindow() 应该关闭窗口
  
- ✅ **系统资源**
  - [ ] getSystemResources() 应该获取系统资源
  - [ ] 应该定期更新资源信息
  
- ✅ **工作流**
  - [ ] executeWorkflow() 应该执行工作流
  - [ ] 应该更新工作流状态
  - [ ] 失败应该记录错误

### 📁 `tests/unit/stores/themeStore.test.ts`
**主题状态管理测试**

测试用例：
- ✅ **初始状态**
  - [ ] theme 应该为系统主题
  - [ ] customColors 应该为默认值
  
- ✅ **切换主题**
  - [ ] setTheme() 应该切换主题
  - [ ] 应该应用到 DOM
  - [ ] 应该保存到本地存储
  
- ✅ **自定义颜色**
  - [ ] setCustomColors() 应该设置自定义颜色
  - [ ] 应该生成 CSS 变量
  - [ ] 应该应用到 DOM

### 📁 `tests/unit/stores/settingsStore.test.ts`
**设置状态管理测试** (已完成 ✅)

---

## 3. Hooks 测试

### 📁 `tests/unit/hooks/useChat.test.tsx`
**聊天 Hook 测试**

测试用例：
- ✅ **发送消息**
  - [ ] sendMessage() 应该发送消息
  - [ ] 应该更新消息列表
  - [ ] 应该返回 AI 响应
  
- ✅ **加载历史**
  - [ ] loadHistory() 应该加载历史消息
  - [ ] 应该支持分页
  
- ✅ **清空对话**
  - [ ] clearConversation() 应该清空消息

### 📁 `tests/unit/hooks/useAdapter.test.tsx`
**适配器 Hook 测试**

测试用例：
- ✅ **获取适配器**
  - [ ] useAdapter(id) 应该返回指定适配器
  - [ ] 适配器不存在应该返回 null
  
- ✅ **适配器操作**
  - [ ] install() 应该安装适配器
  - [ ] uninstall() 应该卸载适配器
  - [ ] start() 应该启动适配器
  - [ ] stop() 应该停止适配器
  
- ✅ **状态监听**
  - [ ] 适配器状态变化应该更新

### 📁 `tests/unit/hooks/useCharacter.test.tsx`
**角色 Hook 测试**

测试用例：
- ✅ **获取角色**
  - [ ] useCharacter() 应该返回当前角色
  - [ ] 应该返回角色操作方法
  
- ✅ **切换角色**
  - [ ] switchCharacter() 应该切换角色
  - [ ] 应该加载新角色模型
  
- ✅ **动画控制**
  - [ ] playAnimation() 应该播放动画
  - [ ] setExpression() 应该设置表情

### 📁 `tests/unit/hooks/useTheme.test.tsx`
**主题 Hook 测试**

测试用例：
- ✅ **获取主题**
  - [ ] useTheme() 应该返回当前主题
  - [ ] 应该返回主题切换方法
  
- ✅ **切换主题**
  - [ ] toggleTheme() 应该切换主题
  - [ ] setTheme() 应该设置指定主题

### 📁 `tests/unit/hooks/useSettings.test.tsx`
**设置 Hook 测试** (已完成 ✅)

### 📁 `tests/unit/hooks/useDebounce.test.tsx`
**防抖 Hook 测试**

测试用例：
- ✅ **防抖测试**
  - [ ] 应该延迟更新值
  - [ ] 快速更新应该只触发一次
  - [ ] 应该使用指定的延迟时间

### 📁 `tests/unit/hooks/useThrottle.test.tsx`
**节流 Hook 测试**

测试用例：
- ✅ **节流测试**
  - [ ] 应该限制更新频率
  - [ ] 应该使用指定的间隔时间

### 📁 `tests/unit/hooks/useLocalStorage.test.tsx`
**本地存储 Hook 测试**

测试用例：
- ✅ **读写测试**
  - [ ] 应该从 localStorage 读取
  - [ ] 应该写入 localStorage
  - [ ] 应该支持 JSON 序列化
  
- ✅ **错误处理**
  - [ ] localStorage 不可用应该降级
  - [ ] 解析失败应该返回默认值

### 📁 `tests/unit/hooks/useWindowSize.test.tsx`
**窗口尺寸 Hook 测试**

测试用例：
- ✅ **尺寸监听**
  - [ ] 应该返回当前窗口尺寸
  - [ ] 窗口调整应该更新尺寸
  - [ ] 应该防抖更新

### 📁 `tests/unit/hooks/useKeyboard.test.tsx`
**键盘 Hook 测试**

测试用例：
- ✅ **快捷键测试**
  - [ ] 应该检测快捷键
  - [ ] 应该支持组合键
  - [ ] 应该支持注册/注销快捷键

---

## 4. Services 服务层测试

### 📁 `tests/unit/services/adapterService.test.ts`
**适配器服务测试**

测试用例：
- ✅ **API 调用**
  - [ ] getAdapters() 应该获取适配器列表
  - [ ] installAdapter() 应该安装适配器
  - [ ] uninstallAdapter() 应该卸载适配器
  - [ ] startAdapter() 应该启动适配器
  - [ ] stopAdapter() 应该停止适配器
  
- ✅ **配置管理**
  - [ ] getConfig() 应该获取配置
  - [ ] setConfig() 应该保存配置
  - [ ] validateConfig() 应该验证配置
  
- ✅ **错误处理**
  - [ ] 网络错误应该重试
  - [ ] 应该返回友好的错误信息

### 📁 `tests/unit/services/chatService.test.ts`
**聊天服务测试**

测试用例：
- ✅ **消息发送**
  - [ ] sendMessage() 应该发送消息
  - [ ] 应该返回 AI 响应
  - [ ] 应该支持流式响应
  
- ✅ **对话管理**
  - [ ] createConversation() 应该创建对话
  - [ ] getConversations() 应该获取对话列表
  - [ ] deleteConversation() 应该删除对话
  
- ✅ **历史记录**
  - [ ] getHistory() 应该获取历史消息
  - [ ] 应该支持分页
  - [ ] 应该支持搜索

### 📁 `tests/unit/services/characterService.test.ts`
**角色服务测试**

测试用例：
- ✅ **角色管理**
  - [ ] getCharacters() 应该获取角色列表
  - [ ] getCharacter() 应该获取单个角色
  - [ ] createCharacter() 应该创建角色
  - [ ] updateCharacter() 应该更新角色
  - [ ] deleteCharacter() 应该删除角色
  
- ✅ **模型管理**
  - [ ] getModels() 应该获取可用模型
  - [ ] loadModel() 应该加载模型
  - [ ] unloadModel() 应该卸载模型

### 📁 `tests/unit/services/voiceService.test.ts`
**语音服务测试**

测试用例：
- ✅ **TTS 测试**
  - [ ] textToSpeech() 应该转换文本为语音
  - [ ] 应该支持不同语音
  - [ ] 应该支持调整语速和音量
  
- ✅ **STT 测试**
  - [ ] speechToText() 应该识别语音
  - [ ] 应该返回文本结果
  - [ ] 应该处理识别错误

### 📁 `tests/unit/services/desktopService.test.ts`
**桌面操作服务测试**

测试用例：
- ✅ **窗口操作**
  - [ ] getWindows() 应该获取窗口列表
  - [ ] focusWindow() 应该聚焦窗口
  - [ ] closeWindow() 应该关闭窗口
  - [ ] minimizeWindow() 应该最小化窗口
  
- ✅ **系统信息**
  - [ ] getSystemInfo() 应该获取系统信息
  - [ ] getSystemResources() 应该获取资源使用
  
- ✅ **工作流**
  - [ ] executeWorkflow() 应该执行工作流
  - [ ] getWorkflows() 应该获取工作流列表

### 📁 `tests/unit/services/apiService.test.ts`
**API 服务测试**

测试用例：
- ✅ **请求测试**
  - [ ] get() 应该发送 GET 请求
  - [ ] post() 应该发送 POST 请求
  - [ ] put() 应该发送 PUT 请求
  - [ ] delete() 应该发送 DELETE 请求
  
- ✅ **拦截器测试**
  - [ ] 应该添加请求拦截器
  - [ ] 应该添加响应拦截器
  - [ ] 应该处理认证
  
- ✅ **错误处理**
  - [ ] 应该处理网络错误
  - [ ] 应该处理超时
  - [ ] 应该重试失败的请求

---

## 5. Utils 工具函数测试

### 📁 `tests/unit/utils/formatters.test.ts`
**格式化工具测试** (已完成 ✅，有 2 个小 bug 需修复)

### 📁 `tests/unit/utils/helpers.test.ts`
**辅助工具测试** (已完成 ✅，有 1 个小 bug 需修复)

### 📁 `tests/unit/utils/validation.test.ts`
**验证工具测试**

测试用例：
- ✅ **字符串验证**
  - [ ] isEmail() 应该验证邮箱
  - [ ] isUrl() 应该验证 URL
  - [ ] isPhoneNumber() 应该验证手机号
  
- ✅ **数字验证**
  - [ ] isInRange() 应该验证范围
  - [ ] isPositive() 应该验证正数
  - [ ] isInteger() 应该验证整数
  
- ✅ **对象验证**
  - [ ] isValidObject() 应该验证对象
  - [ ] hasRequiredFields() 应该检查必填字段

### 📁 `tests/unit/utils/storage.test.ts`
**存储工具测试**

测试用例：
- ✅ **localStorage 操作**
  - [ ] set() 应该保存数据
  - [ ] get() 应该读取数据
  - [ ] remove() 应该删除数据
  - [ ] clear() 应该清空数据
  
- ✅ **序列化测试**
  - [ ] 应该序列化对象
  - [ ] 应该反序列化对象
  - [ ] 解析失败应该返回默认值

### 📁 `tests/unit/utils/eventEmitter.test.ts`
**事件发射器测试**

测试用例：
- ✅ **事件监听**
  - [ ] on() 应该注册监听器
  - [ ] off() 应该移除监听器
  - [ ] once() 应该只触发一次
  
- ✅ **事件发射**
  - [ ] emit() 应该触发所有监听器
  - [ ] 应该传递参数
  - [ ] 监听器错误不应影响其他监听器

---

## 6. 集成测试

### 📁 `tests/integration/chat-flow.test.tsx` ✅
**聊天流程集成测试** (已完成)

测试用例：
- ✅ **完整对话流程**
  - ✅ 用户发送消息 → AI 响应 → 显示结果
  - ✅ 应该更新 UI
  - ✅ 应该保存历史记录
  
- ✅ **多轮对话**
  - ✅ 应该维护对话上下文
  - ✅ 应该支持连续提问

- ✅ **流式响应**
  - ✅ 应该正确处理流式消息
  - ✅ 应该支持停止流式响应

- ✅ **错误处理**
  - ✅ 应该处理网络错误
  - ✅ 应该处理超时错误
  - ✅ 应该支持重新发送失败的消息

- ✅ **消息操作**
  - ✅ 应该支持删除消息
  - ✅ 应该支持清空会话消息
  - ✅ 应该支持编辑并重新发送消息

### 📁 `tests/integration/adapter-workflow.test.tsx` ✅
**适配器工作流集成测试** (已完成)

测试用例：
- ✅ **适配器生命周期**
  - ✅ 搜索 → 安装 → 启动 → 使用 → 停止 → 卸载
  - ✅ 每个阶段应该更新状态
  
- ✅ **适配器通信**
  - ✅ 应该调用适配器 API
  - ✅ 应该处理适配器响应
  - ✅ 应该处理适配器通信错误

- ✅ **适配器配置管理**
  - ✅ 应该正确保存和加载适配器配置
  - ✅ 应该验证适配器配置

- ✅ **适配器更新**
  - ✅ 应该检查并安装适配器更新

- ✅ **批量操作**
  - ✅ 应该支持批量安装适配器
  - ✅ 应该支持批量卸载适配器

### 📁 `tests/integration/character-interaction.test.tsx` ✅
**角色交互集成测试** (已完成)

测试用例：
- ✅ **角色加载和显示**
  - ✅ 选择角色 → 加载模型 → 显示 Live2D
  - ✅ 应该播放默认动画
  - ✅ 应该处理模型加载失败
  
- ✅ **角色交互**
  - ✅ 点击角色应该播放动画
  - ✅ 发送消息应该触发表情变化
  - ✅ 应该支持多种交互类型

- ✅ **动画管理**
  - ✅ 应该支持播放不同的动画
  - ✅ 应该支持动画队列
  - ✅ 应该支持表情切换

- ✅ **角色状态管理**
  - ✅ 应该正确管理角色的活动状态
  - ✅ 应该支持角色可见性切换
  - ✅ 应该保存角色位置和缩放

- ✅ **多角色管理**
  - ✅ 应该支持管理多个角色
  - ✅ 应该支持启用/禁用角色
  - ✅ 应该支持删除角色

### 📁 `tests/integration/settings-persistence.test.tsx` ✅
**设置持久化集成测试** (已完成)

测试用例：
- ✅ **设置保存和加载**
  - ✅ 更改设置 → 保存 → 重启应用 → 设置应该保持
  - ✅ 应该同步到所有组件
  - ✅ 应该支持设置重置
  - ✅ 应该记录设置变更历史

- ✅ **设置同步**
  - ✅ 应该同步到所有组件
  - ✅ 应该处理同步冲突
  - ✅ 应该自动同步定期更改

- ✅ **主题设置**
  - ✅ 应该正确切换主题
  - ✅ 应该支持自定义主题颜色

- ✅ **窗口设置**
  - ✅ 应该保存和恢复窗口状态
  - ✅ 应该限制窗口大小

- ✅ **设置验证**
  - ✅ 应该验证设置值的有效性
  - ✅ 应该验证窗口尺寸

- ✅ **设置导入导出**
  - ✅ 应该支持导出设置
  - ✅ 应该支持导入设置

### 📁 `tests/integration/tauri-commands.test.ts` ✅
**Tauri 命令集成测试** (已完成)

测试用例：
- ✅ **聊天命令**
  - ✅ send_message - 应该发送聊天消息
  - ✅ get_chat_history - 应该获取聊天历史
  - ✅ create_session - 应该创建新会话
  - ✅ delete_session - 应该删除会话

- ✅ **适配器命令**
  - ✅ list_adapters - 应该列出所有适配器
  - ✅ install_adapter - 应该安装适配器
  - ✅ uninstall_adapter - 应该卸载适配器
  - ✅ load_adapter - 应该加载适配器
  - ✅ unload_adapter - 应该卸载适配器
  - ✅ get_adapter_config - 应该获取适配器配置
  - ✅ update_adapter_config - 应该更新适配器配置
  - ✅ search_adapters - 应该搜索适配器市场

- ✅ **设置命令**
  - ✅ get_app_settings - 应该获取应用设置
  - ✅ update_app_settings - 应该更新应用设置
  - ✅ get_window_config - 应该获取窗口配置
  - ✅ update_window_config - 应该更新窗口配置
  - ✅ get_theme_config - 应该获取主题配置
  - ✅ update_theme_config - 应该更新主题配置
  - ✅ get_character_config - 应该获取角色配置
  - ✅ update_character_config - 应该更新角色配置

- ✅ **系统命令**
  - ✅ get_system_info - 应该获取系统信息
  - ✅ get_app_version - 应该获取应用版本
  - ✅ check_for_updates - 应该检查更新

- ✅ **文件系统命令**
  - ✅ read_file - 应该读取文件
  - ✅ write_file - 应该写入文件
  - ✅ delete_file - 应该删除文件
  - ✅ list_directory - 应该列出目录内容

- ✅ **错误处理**
  - ✅ 应该处理命令执行失败
  - ✅ 应该处理参数验证错误

### 📁 `tests/integration/user-workflows.test.tsx` ✅
**用户工作流集成测试** (已完成)

测试用例：
- ✅ **首次启动工作流**
  - ✅ 应该完成首次启动的完整流程
  - ✅ 应该引导用户完成初始设置

- ✅ **日常使用工作流**
  - ✅ 应该完成标准对话流程
  - ✅ 应该支持切换不同会话
  - ✅ 应该支持角色交互

- ✅ **高级功能工作流**
  - ✅ 应该支持安装和使用新适配器
  - ✅ 应该支持导出和导入对话
  - ✅ 应该支持自定义主题

- ✅ **多功能协同工作流**
  - ✅ 应该支持角色、适配器和聊天的完整协同
  - ✅ 应该支持多角色切换和对话

- ✅ **错误恢复工作流**
  - ✅ 应该从网络错误中恢复
  - ✅ 应该从适配器错误中恢复

- ✅ **性能优化工作流**
  - ✅ 应该处理大量消息而不影响性能
  - ✅ 应该正确管理多个会话的内存

---

## 7. E2E 测试

### 📁 `tests/e2e/basic-workflow.spec.ts` ✅
**基础工作流 E2E 测试** (已完成)

测试场景：
- ✅ **启动应用** (5个测试)
  - ✅ 应该显示欢迎界面
  - ✅ 应该加载默认角色
  - ✅ 应该在5秒内完成启动
  - ✅ 应该正确设置应用标题
  - ✅ 不应该显示错误消息
  
- ✅ **基础对话** (11个测试)
  - ✅ 应该发送消息并收到回复
  - ✅ 应该显示输入指示器
  - ✅ 应该支持多轮对话
  - ✅ 应该自动滚动到最新消息
  - ✅ 应该正确显示消息时间戳
  - ✅ 应该支持快捷键发送消息
  - ✅ 应该支持 Shift+Enter 换行
  - ✅ 应该处理空消息
  - ✅ 应该处理超长消息
  - ✅ 应该清空聊天历史
  
- ✅ **设置更改** (8个测试)
  - ✅ 应该打开/关闭设置面板
  - ✅ 应该切换到暗色/亮色主题
  - ✅ 主题切换应该立即生效
  - ✅ 应该保存设置更改
  - ✅ 应该显示和切换设置分类

- ✅ **键盘快捷键** (3个测试)
  - ✅ 应该支持 Ctrl+K 快速打开设置
  - ✅ 应该支持 ESC 关闭弹窗
  - ✅ 应该支持 Ctrl+Shift+C 清空聊天

- ✅ **错误处理** (3个测试)
  - ✅ 应该处理网络错误
  - ✅ 应该处理服务器错误
  - ✅ 应该允许重试失败的消息

- ✅ **性能测试** (2个测试)
  - ✅ 消息列表应该流畅滚动
  - ✅ 应该在3秒内渲染100条消息

**总计**: 35+ 测试用例

### 📁 `tests/e2e/adapter-management.spec.ts` ✅
**适配器管理 E2E 测试** (已完成)

测试场景：
- ✅ **适配器面板** (4个测试)
  - ✅ 应该打开/关闭适配器管理面板
  - ✅ 应该显示已安装的适配器
  - ✅ 应该显示适配器详细信息
  
- ✅ **适配器搜索** (4个测试)
  - ✅ 应该搜索适配器
  - ✅ 应该处理空搜索结果
  - ✅ 应该支持搜索过滤
  - ✅ 应该清除搜索条件

- ✅ **安装适配器** (5个测试)
  - ✅ 应该安装适配器
  - ✅ 应该显示安装进度
  - ✅ 应该处理安装失败
  - ✅ 应该阻止重复安装
  - ✅ 应该验证适配器依赖

- ✅ **配置适配器** (5个测试)
  - ✅ 应该打开配置对话框
  - ✅ 应该保存适配器配置
  - ✅ 应该验证配置参数
  - ✅ 应该显示配置帮助文档
  - ✅ 应该重置配置为默认值

- ✅ **启动和停止适配器** (5个测试)
  - ✅ 应该启动/停止适配器
  - ✅ 应该显示启动进度
  - ✅ 应该处理启动失败
  - ✅ 应该自动重启崩溃的适配器

- ✅ **卸载适配器** (4个测试)
  - ✅ 应该卸载适配器
  - ✅ 应该确认卸载操作
  - ✅ 应该阻止卸载运行中的适配器
  - ✅ 应该清理适配器数据

- ✅ **使用适配器** (4个测试)
  - ✅ 应该通过适配器发送消息
  - ✅ 应该显示适配器响应时间
  - ✅ 应该处理适配器超时
  - ✅ 应该支持切换适配器

- ✅ **适配器更新** (3个测试)
  - ✅ 应该检查适配器更新
  - ✅ 应该更新适配器
  - ✅ 应该显示更新日志

- ✅ **完整工作流** (1个测试)
  - ✅ 应该完成适配器完整生命周期

**总计**: 40+ 测试用例

### 📁 `tests/e2e/character-switch.spec.ts` ✅
**角色切换 E2E 测试** (已完成)

测试场景：
- ✅ **角色选择** (4个测试)
  - ✅ 应该显示角色选择器
  - ✅ 应该显示角色头像和名称
  - ✅ 应该高亮当前选中的角色
  - ✅ 应该支持键盘导航选择角色

- ✅ **角色切换** (5个测试)
  - ✅ 应该切换角色
  - ✅ 应该显示加载指示器
  - ✅ 应该在5秒内完成角色切换
  - ✅ 应该处理模型加载失败
  - ✅ 应该平滑过渡角色

- ✅ **Live2D 模型** (5个测试)
  - ✅ 应该加载 Live2D 模型
  - ✅ 应该显示模型加载进度
  - ✅ 应该正确显示模型尺寸和位置
  - ✅ 应该支持调整模型缩放
  - ✅ 应该支持拖拽调整位置

- ✅ **角色动画** (5个测试)
  - ✅ 应该播放默认空闲动画
  - ✅ 应该在点击时播放交互动画
  - ✅ 应该根据消息内容播放相应动画
  - ✅ 应该支持动画队列
  - ✅ 应该循环播放空闲动画

- ✅ **角色表情** (3个测试)
  - ✅ 应该切换表情
  - ✅ 应该根据对话情绪自动切换表情
  - ✅ 应该平滑过渡表情

- ✅ **角色与对话联动** (3个测试)
  - ✅ 应该保留对话历史
  - ✅ 应该使用新角色的人设回复
  - ✅ 应该显示角色特定的对话UI

- ✅ **角色性能** (3个测试)
  - ✅ 应该流畅渲染角色动画
  - ✅ 应该快速切换角色不卡顿
  - ✅ 角色内存使用应该合理

- ✅ **完整角色切换流程** (1个测试)
  - ✅ 应该完成完整的角色交互流程

- ✅ **错误处理** (3个测试)
  - ✅ 应该处理模型文件缺失
  - ✅ 应该处理纹理加载失败
  - ✅ 应该处理动画播放失败

**总计**: 38+ 测试用例

---

## 8. 性能测试 ✅

### 📁 `tests/performance/render-performance.test.tsx` ✅
**渲染性能测试** (已完成)

测试用例：
- ✅ **组件渲染时间**
  - ✅ ChatWindow 组件首次渲染 < 50ms
  - ✅ ChatWindow 组件少量消息渲染 < 30ms
  - ✅ 重新渲染 < 16ms (60fps)
  
- ✅ **MessageList 组件性能**
  - ✅ 100 条消息渲染 < 200ms
  - ✅ 500 条消息渲染 < 500ms
  - ✅ 1000 条消息(虚拟滚动) < 300ms
  - ✅ 添加新消息 < 16ms
  
- ✅ **大列表滚动性能**
  - ✅ 1000 条消息滚动平均 FPS > 30
  - ✅ 虚拟滚动模式平均 FPS > 50
  
- ✅ **复杂内容渲染**
  - ✅ 长文本消息 < 100ms
  - ✅ 代码块消息 < 50ms
  - ✅ 混合内容 < 80ms
  
- ✅ **并发渲染性能**
  - ✅ 连续添加消息性能稳定
  - ✅ 流式响应更新 < 10ms
  
- ✅ **内存使用优化**
  - ✅ 1000条消息内存 < 50MB
  - ✅ 卸载释放 > 80% 内存

### 📁 `tests/performance/memory-leak.test.tsx` ✅
**内存泄漏测试** (已完成)

测试用例：
- ✅ **事件监听器清理**
  - ✅ ChatWindow 卸载后清理所有监听器
  - ✅ MessageList 清理滚动监听器
  - ✅ 多次挂载不累积监听器
  
- ✅ **定时器清理**
  - ✅ 卸载后清理 setTimeout
  - ✅ 卸载后清理 setInterval
  - ✅ 流式响应定时器清理
  
- ✅ **requestAnimationFrame 清理**
  - ✅ 组件卸载取消所有 RAF
  - ✅ 动画组件正确清理 RAF
  
- ✅ **DOM 引用清理**
  - ✅ 卸载后无残留 DOM 节点
  - ✅ 虚拟滚动清理所有节点
  
- ✅ **长时间运行测试**
  - ✅ 长期运行内存增长 < 20MB
  - ✅ 持续更新释放 > 70% 内存
  
- ✅ **订阅和观察者清理**
  - ✅ IntersectionObserver 正确清理
  - ✅ ResizeObserver 正确清理

### 📁 `tests/performance/README.md` ✅
**性能测试文档** (已完成)

包含内容：
- ✅ 性能测试概述和测试文件说明
- ✅ 性能基准和指标定义
- ✅ 运行性能测试的命令
- ✅ 性能监控工具文档
- ✅ 最佳实践和调试指南
- ✅ 常见问题解答
- ✅ 持续监控建议

### 📁 `tests/performance/vitest.config.ts` ✅
**性能测试配置** (已完成)

配置特性：
- ✅ 更长的超时时间 (30秒)
- ✅ 串行执行避免测试干扰
- ✅ 单进程执行提高准确性
- ✅ 禁用覆盖率收集
- ✅ 性能测试环境变量

---

## 📊 优先级和进度

### 阶段 1: 核心组件 (高优先级) - 当前阶段

- [ ] Character 组件群 (0/12)
  - [ ] Character.test.tsx
  - [ ] Live2DViewer.test.tsx
  - [ ] Live2DController.test.tsx
  - [ ] Live2DControlPanel.test.tsx
  - [ ] Live2DLoadingIndicator.test.tsx
  - [ ] ModelLoader.test.tsx
  - [ ] AnimationController.test.tsx
  - [ ] AnimationPlayer.test.tsx
  - [ ] AnimationQueue.test.tsx
  - [ ] AnimationPresets.test.tsx
  - [ ] MotionPlayer.test.tsx
  - [ ] AnimationControls.test.tsx

- [ ] Chat 组件群 (0/6)
  - [ ] ChatWindow.test.tsx
  - [ ] MessageList.test.tsx
  - [ ] InputArea.test.tsx
  - [ ] VoiceInput.test.tsx
  - [ ] MessageBubble.test.tsx
  - [ ] TypingIndicator.test.tsx

### 阶段 2: 状态管理和业务逻辑 (高优先级)

- [ ] Store 测试 (0/5)
  - [ ] adapterStore.test.ts
  - [ ] characterStore.test.ts
  - [ ] chatStore.test.ts
  - [ ] desktopStore.test.ts
  - [ ] themeStore.test.ts

- [ ] Hooks 测试 (0/10)
  - [ ] useChat.test.tsx
  - [ ] useAdapter.test.tsx
  - [ ] useCharacter.test.tsx
  - [ ] useTheme.test.tsx
  - [ ] useDebounce.test.tsx
  - [ ] useThrottle.test.tsx
  - [ ] useLocalStorage.test.tsx
  - [ ] useWindowSize.test.tsx
  - [ ] useKeyboard.test.tsx

- [ ] Services 测试 (0/6)
  - [ ] adapterService.test.ts
  - [ ] chatService.test.ts
  - [ ] characterService.test.ts
  - [ ] voiceService.test.ts
  - [ ] desktopService.test.ts
  - [ ] apiService.test.ts

### 阶段 3: UI 组件 (中优先级)

- [ ] Settings 组件群 (0/5)
- [ ] Adapter 组件群 (0/4)
- [ ] Layout 组件群 (0/3)
- [ ] Common 组件群 (0/6)

### 阶段 4: 集成和 E2E (中优先级)

- ✅ 集成测试 (6/6) - **已完成**
  - ✅ chat-flow.test.tsx
  - ✅ adapter-workflow.test.tsx
  - ✅ character-interaction.test.tsx
  - ✅ settings-persistence.test.tsx
  - ✅ tauri-commands.test.ts
  - ✅ user-workflows.test.tsx
- ✅ E2E 测试 (3/3) - **已完成**
  - ✅ basic-workflow.spec.ts
  - ✅ adapter-management.spec.ts
  - ✅ character-switch.spec.ts

### 阶段 5: 优化和完善 (低优先级)

- ✅ 性能测试 (2/2) - **已完成**
  - ✅ render-performance.test.tsx
  - ✅ memory-leak.test.tsx
- [ ] 修复现有测试 bug (3 个)
- [ ] 提高覆盖率到 80%+

---

## 📈 测试覆盖率目标

| 类型 | 当前覆盖率 | 目标覆盖率 | 状态 |
|------|-----------|-----------|------|
| 组件 (Components) | ~15% | 80%+ | 🔴 进行中 |
| Store | ~20% | 85%+ | 🟡 部分完成 |
| Hooks | ~10% | 80%+ | 🔴 待开始 |
| Services | ~5% | 75%+ | 🔴 待开始 |
| Utils | ~60% | 85%+ | 🟢 基本完成 |
| **整体** | **~20%** | **80%+** | 🔴 进行中 |

---

## 🛠️ 测试工具和配置

### 已配置的工具

- ✅ Vitest - 测试运行器
- ✅ React Testing Library - React 组件测试
- ✅ MSW - API Mock
- ✅ Testing Library User Event - 用户交互模拟
- ✅ jsdom - DOM 环境
- ✅ @vitest/coverage-v8 - 代码覆盖率

### Mock 工厂

- ✅ `tests/mocks/factories.ts` - 数据工厂函数
- ✅ `tests/mocks/handlers.ts` - MSW 请求处理器
- ✅ `tests/utils/test-utils.tsx` - 测试工具函数

---

## 📝 测试编写指南

### 命名规范

```typescript
// 文件命名: Component.test.tsx 或 function.test.ts
// 测试套件: describe('ComponentName', () => {})
// 测试用例: it('should do something when condition', () => {})
```

### 测试结构

```typescript
describe('ComponentName', () => {
  // 渲染测试
  describe('Rendering', () => {
    it('should render correctly', () => {})
  })
  
  // 交互测试
  describe('Interactions', () => {
    it('should handle click', () => {})
  })
  
  // 状态测试
  describe('State', () => {
    it('should update state', () => {})
  })
  
  // 边界情况
  describe('Edge Cases', () => {
    it('should handle error', () => {})
  })
})
```

### 断言风格

```typescript
// 使用 expect 和语义化的匹配器
expect(result).toBe(expected)
expect(element).toBeInTheDocument()
expect(fn).toHaveBeenCalledWith(arg)
```

---

## 📋 检查清单

在创建每个测试文件时，确保：

- [ ] 覆盖所有公共 API
- [ ] 测试正常情况
- [ ] 测试边界情况
- [ ] 测试错误处理
- [ ] 使用合适的 Mock
- [ ] 清理副作用
- [ ] 添加有意义的断言
- [ ] 测试用例独立
- [ ] 描述清晰明确

---

## 🔄 持续更新

本文档将随着测试的进展持续更新：

- **每完成一个测试文件**: 更新进度
- **每发现新需求**: 添加新的测试用例
- **每周**: 更新覆盖率统计
- **每阶段完成**: 总结经验教训

---

## 📚 参考资源

- [Vitest 文档](https://vitest.dev/)
- [React Testing Library 文档](https://testing-library.com/react)
- [MSW 文档](https://mswjs.io/)
- [测试最佳实践](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## 🎯 基于 IMPROVEMENT_TODO.md 的项目状态分析

### 📊 功能完成度统计

根据 `IMPROVEMENT_TODO.md` 文档分析，项目功能完成度如下：

**✅ 已完成功能模块 (需要测试覆盖)**:

**核心功能 (4/5 完成)**:
- ✅ 键盘快捷键系统 - `hooks/useKeyboardShortcuts.ts`
- ✅ 系统信息采集完善 - `services/monitorService.ts`
- ✅ 桌面信息获取 - `services/desktop.ts`
- ✅ 聊天模型配置持久化 - `services/modelConfigService.ts`
- ⏳ Live2D 角色系统 - `components/Character/*` (ModelLoader 待完善)

**用户界面 (2/3 完成)**:
- ✅ 聊天界面增强功能 - `components/Chat/*`
- ✅ 主题系统扩展 - `components/ThemeCustomizer/*`, `services/themeService.ts`
- ⏳ 虚拟滚动实现 - `components/VirtualList/*` (待集成)

**系统集成 (3/4 完成)**:
- ✅ 适配器市场和管理 - `services/adapterManagementService.ts`, `services/marketService.ts`
- ✅ 系统托盘功能增强 - Rust 后端实现
- ✅ 文件操作系统 - `components/FileManager/*`, `services/fileService.ts`
- ⏳ 工作流系统 - `components/workflow/*` (后端待完善)

**网络与API (3/3 完成)**:
- ✅ 后端API集成完善 - `services/api/*`
- ✅ 实时通信功能 - `services/api/websocket.ts`
- ✅ 数据同步机制 - `services/api/sync.ts`

**安全与隐私 (3/3 完成)**:
- ✅ 数据加密 - `services/encryptionService.ts`
- ✅ 权限管理系统 - `services/permissionService.ts`
- ✅ 隐私保护 - `components/Privacy/*`, `services/privacyService.ts`

**性能优化 (2/3 完成)**:
- ✅ 内存管理 - `services/memoryService.ts`, `components/Memory/*`
- ✅ 渲染优化 - `services/renderingService.ts`, `components/Performance/*`
- ❌ 启动优化 - 待实现

**监控与分析 (2/3 完成)**:
- ✅ 错误监控 - `services/errorMonitoringService.ts`, `components/ErrorMonitor/*`
- ✅ 日志系统 - `services/loggingService.ts`, `components/Logging/*`
- ❌ 性能监控 - 待实现

**国际化 (1/2 完成)**:
- ✅ 区域适配 - `services/regionService.ts`
- ❌ 多语言支持 - 待实现

### 🎯 测试优先级重新规划

**🔴 第一优先级 - 核心业务功能测试**:

1. **聊天系统测试套件**
   - `components/Chat/ChatWindow.test.tsx`
   - `components/Chat/MessageList.test.tsx`
   - `components/Chat/MessageRenderer/MarkdownRenderer.test.tsx`
   - `services/chat.ts.test.ts`
   - `hooks/useChat.test.tsx`

2. **适配器管理测试套件**
   - `services/adapterManagementService.test.ts`
   - `services/marketService.test.ts`
   - `hooks/useAdapter.test.tsx`

3. **安全系统测试套件**
   - `services/encryptionService.test.ts`
   - `services/permissionService.test.ts`
   - `hooks/useEncryption.test.tsx`
   - `hooks/usePermission.test.tsx`

**🟡 第二优先级 - 系统功能测试**:

4. **系统监控测试套件**
   - `services/memoryService.test.ts`
   - `services/errorMonitoringService.test.ts`
   - `services/loggingService.test.ts`
   - `hooks/useMemory.test.tsx`
   - `hooks/useErrorMonitor.test.tsx`

5. **文件和API测试套件**
   - `services/fileService.test.ts`
   - `services/api/index.test.ts`
   - `services/api/websocket.test.ts`
   - `hooks/useFileManager.test.tsx`

**🟢 第三优先级 - 辅助功能测试**:

6. **界面和主题测试套件**
   - `services/themeService.test.ts`
   - `services/renderingService.test.ts`
   - `components/ThemeCustomizer/index.test.tsx`

7. **系统集成测试套件**
   - `services/regionService.test.ts`
   - `services/monitorService.test.ts`
   - `hooks/useKeyboardShortcuts.test.tsx`

### 📅 实施时间表 (基于实际功能状态)

**Week 1-2: 聊天系统测试**
- 聊天组件和服务测试
- Markdown 渲染器测试
- 消息搜索和导出功能测试

**Week 3-4: 适配器和安全系统测试**
- 适配器管理服务测试
- 市场API集成测试
- 加密和权限管理测试

**Week 5-6: 系统监控测试**
- 内存管理系统测试
- 错误监控系统测试
- 日志系统测试

**Week 7-8: 文件和API测试**
- 文件操作系统测试
- API服务层测试
- WebSocket通信测试

**Week 9-10: 界面和性能测试**
- 主题系统测试
- 渲染优化测试
- 性能监控组件测试

**Week 11-12: 系统集成和E2E测试**
- 区域适配测试
- 键盘快捷键测试
- 端到端用户流程测试

### 🎯 测试覆盖率目标调整

基于实际功能完成度，调整测试覆盖率目标：

```typescript
// vitest.config.ts 建议配置
coverage: {
  lines: 85,      // 针对已完成功能
  functions: 85,  // 针对已完成功能
  branches: 80,   // 保持合理水平
  statements: 85, // 针对已完成功能
  
  // 排除未完成的功能模块
  exclude: [
    'src/components/StartupOptimization/**',
    'src/services/startupService.ts',
    'src/components/I18nProvider/**', // 多语言待实现
    'src/components/Update/**', // 更新机制待完善
  ]
}
```

### 🔧 测试环境配置增强

针对已实现的功能，需要配置相应的测试环境：

**Mock 配置增强**:
- Tauri 命令 Mock (17个加密命令、24个适配器命令等)
- WebSocket 连接 Mock
- 文件系统操作 Mock
- Live2D 模型加载 Mock
- 系统信息获取 Mock

**测试数据工厂扩展**:
- 加密数据工厂
- 权限配置工厂
- 内存统计数据工厂
- 错误报告数据工厂
- 日志记录数据工厂

### 📋 关键测试文件清单

基于 `IMPROVEMENT_TODO.md` 分析，以下是需要优先创建的测试文件：

**🔴 第一优先级测试文件 (Week 1-4)**:
```
tests/unit/services/
├── encryptionService.test.ts         # 17个加密命令测试
├── permissionService.test.ts         # 18个权限命令测试
├── adapterManagementService.test.ts  # 17个适配器管理命令测试
├── marketService.test.ts             # 7个市场API命令测试
└── chat.test.ts                      # 聊天服务测试

tests/unit/components/Chat/
├── ChatWindow.test.tsx               # 聊天窗口组件
├── MessageList.test.tsx              # 消息列表组件
├── MessageRenderer/
│   └── MarkdownRenderer.test.tsx     # Markdown渲染器
├── FileUpload/
│   └── FileUploadZone.test.tsx       # 文件上传组件
└── MessageSearch/
    └── MessageSearch.test.tsx        # 消息搜索组件

tests/unit/hooks/
├── useEncryption.test.tsx            # 加密Hook测试
├── usePermission.test.tsx            # 权限Hook测试
├── useAdapter.test.tsx               # 适配器Hook测试
└── useChat.test.tsx                  # 聊天Hook测试
```

**🟡 第二优先级测试文件 (Week 5-8)**:
```
tests/unit/services/
├── memoryService.test.ts             # 13个内存管理命令测试
├── errorMonitoringService.test.ts    # 14个错误监控命令测试
├── loggingService.test.ts            # 16个日志系统命令测试
├── fileService.test.ts               # 15个文件操作命令测试
└── api/
    ├── index.test.ts                 # 核心API客户端
    ├── websocket.test.ts             # WebSocket管理器
    └── sync.test.ts                  # 数据同步管理器

tests/unit/hooks/
├── useMemory.test.tsx                # 内存管理Hook
├── useErrorMonitor.test.tsx          # 错误监控Hook
├── useLogging.test.tsx               # 日志Hook
└── useFileManager.test.tsx           # 文件管理Hook
```

**🟢 第三优先级测试文件 (Week 9-12)**:
```
tests/unit/services/
├── themeService.test.ts              # 主题服务测试
├── renderingService.test.ts          # 8个渲染优化命令测试
├── regionService.test.ts             # 23个区域适配命令测试
└── monitorService.test.ts            # 系统监控服务测试

tests/unit/components/
├── ThemeCustomizer/
│   └── index.test.tsx                # 主题定制器
├── Performance/
│   └── RenderingMonitor.test.tsx     # 性能监控面板
└── FileManager/
    └── FileManagerPanel.test.tsx     # 文件管理面板

tests/integration/
├── tauri-commands.test.ts            # 100+个Tauri命令集成测试
└── user-workflows.test.ts            # 用户流程E2E测试
```

### 🎯 测试实施检查点

**每周检查点**:
- Week 1: 聊天系统测试完成度 ≥ 80%
- Week 2: 安全系统测试完成度 ≥ 80%
- Week 3: 适配器管理测试完成度 ≥ 80%
- Week 4: 第一阶段覆盖率达到 75%
- Week 6: 系统监控测试完成度 ≥ 80%
- Week 8: 第二阶段覆盖率达到 80%
- Week 10: 界面和性能测试完成度 ≥ 80%
- Week 12: 总体覆盖率达到 85%

**质量门禁**:
- 每个测试文件必须包含至少 10 个测试用例
- 每个服务类的公共方法覆盖率 ≥ 90%
- 每个 React 组件的主要功能覆盖率 ≥ 85%
- 每个 Hook 的所有返回值和副作用都有测试
- 所有 Tauri 命令都有对应的集成测试

---

**最后更新**: 2025-10-20
**维护者**: Zishu Team  
**版本**: 2.0.0 (基于 IMPROVEMENT_TODO.md 重新规划)

