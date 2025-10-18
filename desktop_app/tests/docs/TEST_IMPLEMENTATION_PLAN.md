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
- [8. 性能测试](#8-性能测试)

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

### 📁 `tests/integration/chat-flow.test.tsx`
**聊天流程集成测试**

测试用例：
- ✅ **完整对话流程**
  - [ ] 用户发送消息 → AI 响应 → 显示结果
  - [ ] 应该更新 UI
  - [ ] 应该保存历史记录
  
- ✅ **多轮对话**
  - [ ] 应该维护对话上下文
  - [ ] 应该支持连续提问

### 📁 `tests/integration/adapter-workflow.test.tsx`
**适配器工作流集成测试**

测试用例：
- ✅ **适配器生命周期**
  - [ ] 搜索 → 安装 → 启动 → 使用 → 停止 → 卸载
  - [ ] 每个阶段应该更新状态
  
- ✅ **适配器通信**
  - [ ] 应该调用适配器 API
  - [ ] 应该处理适配器响应

### 📁 `tests/integration/character-interaction.test.tsx`
**角色交互集成测试**

测试用例：
- ✅ **角色加载和显示**
  - [ ] 选择角色 → 加载模型 → 显示 Live2D
  - [ ] 应该播放默认动画
  
- ✅ **角色交互**
  - [ ] 点击角色应该播放动画
  - [ ] 发送消息应该触发表情变化

### 📁 `tests/integration/settings-persistence.test.tsx`
**设置持久化集成测试**

测试用例：
- ✅ **设置保存和加载**
  - [ ] 更改设置 → 保存 → 重启应用 → 设置应该保持
  - [ ] 应该同步到所有组件

---

## 7. E2E 测试

### 📁 `tests/e2e/basic-workflow.spec.ts`
**基础工作流 E2E 测试**

测试场景：
- ✅ **启动应用**
  - [ ] 应该显示欢迎界面
  - [ ] 应该加载默认角色
  
- ✅ **基础对话**
  - [ ] 输入消息并发送
  - [ ] 应该收到 AI 回复
  - [ ] 角色应该有表情变化
  
- ✅ **设置更改**
  - [ ] 打开设置
  - [ ] 更改主题
  - [ ] 应该立即生效

### 📁 `tests/e2e/adapter-management.spec.ts`
**适配器管理 E2E 测试**

测试场景：
- ✅ **安装适配器**
  - [ ] 搜索适配器
  - [ ] 安装适配器
  - [ ] 配置适配器
  - [ ] 启动适配器
  
- ✅ **使用适配器**
  - [ ] 通过适配器发送请求
  - [ ] 应该收到响应

### 📁 `tests/e2e/character-switch.spec.ts`
**角色切换 E2E 测试**

测试场景：
- ✅ **切换角色**
  - [ ] 打开角色选择
  - [ ] 选择新角色
  - [ ] 应该加载新模型
  - [ ] 应该保留对话历史

---

## 8. 性能测试

### 📁 `tests/performance/render-performance.test.tsx`
**渲染性能测试**

测试用例：
- ✅ **组件渲染时间**
  - [ ] Character 组件首次渲染 < 100ms
  - [ ] ChatWindow 组件首次渲染 < 50ms
  - [ ] 重新渲染 < 16ms (60fps)
  
- ✅ **大列表性能**
  - [ ] 1000 条消息滚动应该流畅
  - [ ] 应该使用虚拟滚动

### 📁 `tests/performance/memory-leak.test.tsx`
**内存泄漏测试**

测试用例：
- ✅ **组件卸载**
  - [ ] 卸载后应该清理事件监听器
  - [ ] 卸载后应该清理定时器
  - [ ] 卸载后应该释放 Live2D 资源
  
- ✅ **长时间运行**
  - [ ] 运行 1 小时内存增长 < 100MB

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

- [ ] 集成测试 (0/4)
- [ ] E2E 测试 (0/3)

### 阶段 5: 优化和完善 (低优先级)

- [ ] 性能测试 (0/2)
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

**最后更新**: 2025-10-18
**维护者**: Zishu Team
**版本**: 1.0.0

