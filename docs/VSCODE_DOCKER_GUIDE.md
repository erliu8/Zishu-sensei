# VS Code + Docker 开发指南

本指南将帮助你在 VS Code 中使用 Docker 环境开发 Zishu-sensei 项目。

## 🚀 快速开始

### 1. 安装必要的扩展

在 VS Code 中安装以下扩展（项目已配置自动推荐）：

**核心扩展**：
- **Python** - Python 语言支持
- **Docker** - Docker 支持
- **Remote - Containers** - 容器内开发
- **Pylance** - Python 智能提示

**推荐扩展**：
- **Jupyter** - Notebook 支持
- **GitLens** - Git 增强
- **Thunder Client** - API 测试

### 2. 三种开发方式

#### 方式一：本地开发 + Docker 服务（推荐新手）

1. **启动 Docker 服务**：
   ```bash
   # 使用 VS Code 任务
   Ctrl+Shift+P → "Tasks: Run Task" → "Docker: Start All Services"
   
   # 或使用终端
   .\scripts\dev-docker.ps1 start-all
   ```

2. **在本地 VS Code 中开发**：
   - 代码在本地编辑
   - 数据库、Redis、API 在 Docker 中运行
   - 热重载自动生效

#### 方式二：Remote-Containers 开发（推荐高级用户）

1. **启动容器**：
   ```bash
   .\scripts\dev-docker.ps1 start-all
   ```

2. **连接到容器**：
   - `Ctrl+Shift+P` → `Remote-Containers: Attach to Running Container`
   - 选择 `zishu-api-dev` 容器
   - VS Code 会在容器内打开项目

#### 方式三：Dev Container 开发（推荐团队协作）

1. **打开项目**：
   ```bash
   code Zishu-sensei.code-workspace
   ```

2. **重新在容器中打开**：
   - VS Code 会提示 "Reopen in Container"
   - 或手动：`Ctrl+Shift+P` → `Remote-Containers: Reopen in Container`

## 🛠️ 开发工作流

### VS Code 任务快捷操作

使用 `Ctrl+Shift+P` 然后输入 "Tasks: Run Task"，选择：

| 任务 | 描述 |
|------|------|
| `Docker: Setup Dev Environment` | 初始化开发环境 |
| `Docker: Start All Services` | 启动所有服务 |
| `Docker: Stop All Services` | 停止所有服务 |
| `Docker: View Logs` | 查看服务日志 |
| `Docker: Show Status` | 显示服务状态 |
| `Docker: Health Check` | 健康检查 |
| `Docker: Enter API Container` | 进入 API 容器 |
| `Python: Run Tests` | 运行测试 |
| `Python: Format Code` | 格式化代码 |

### 调试配置

项目提供了多种调试配置：

#### 1. Docker 容器调试
- **配置**: `Python: FastAPI App (Docker)`
- **端口**: 5678
- **用途**: 调试运行在 Docker 中的 API

#### 2. 本地文件调试
- **配置**: `Python: Current File (Local)`
- **用途**: 调试当前打开的 Python 文件

#### 3. 测试调试
- **配置**: `Python: Tests`
- **用途**: 调试 pytest 测试

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+P` | 命令面板 |
| `Ctrl+Shift+` | 打开终端 |
| `F5` | 开始调试 |
| `Ctrl+F5` | 运行不调试 |
| `Ctrl+Shift+F5` | 重启调试 |

## 📊 服务访问

启动 Docker 环境后，可以在 VS Code 中直接访问：

### 内置浏览器
- `Ctrl+Shift+P` → `Simple Browser: Show`
- 输入地址，如：`http://localhost:8000/docs`

### 端口转发
VS Code 会自动转发以下端口：
- `8000` - API 服务
- `8888` - Jupyter Lab
- `5050` - pgAdmin
- `8081` - Redis Commander
- `8025` - MailHog

查看转发的端口：`View` → `Open View...` → `Ports`

## 🔧 开发技巧

### 1. 代码智能提示

确保在 VS Code 底部状态栏选择了正确的 Python 解释器：
- 本地开发：选择本地虚拟环境
- 容器开发：选择 `/usr/local/bin/python`

### 2. 自动格式化

代码保存时自动格式化（已配置）：
- **Black** - 代码格式化
- **isort** - import 排序
- **自动保存** - 1秒延迟

### 3. Git 集成

VS Code 集成了 Git 功能：
- `Source Control` 面板查看更改
- `GitLens` 扩展提供增强的 Git 信息
- 自动 Git hooks（如果安装）

### 4. Jupyter 开发

访问 Jupyter Lab：
1. 在 VS Code 中：`Ctrl+Shift+P` → `Jupyter: Create New Jupyter Notebook`
2. 或浏览器中：http://localhost:8888 (token: dev-token)

### 5. API 测试

使用内置 REST 客户端：
1. 创建 `.http` 文件
2. 写入 HTTP 请求
3. 点击 "Send Request"

示例：
```http
### 健康检查
GET http://localhost:8000/health

### API 文档
GET http://localhost:8000/docs
```

## 🐛 调试技巧

### 1. API 调试

在 FastAPI 代码中设置断点：
```python
import debugpy
debugpy.listen(("0.0.0.0", 5678))
# debugpy.wait_for_client()  # 可选：等待调试器连接

# 你的代码
def some_function():
    breakpoint()  # 设置断点
    return "Hello World"
```

### 2. 容器内调试

进入容器进行调试：
- 使用任务：`Docker: Enter API Container`
- 或终端：`.\scripts\dev-docker.ps1 shell api`

### 3. 日志查看

实时查看日志：
- VS Code 任务：`Docker: View Logs`
- 或使用 Docker 扩展的日志查看功能

### 4. 数据库调试

连接数据库：
1. 安装 PostgreSQL 扩展
2. 添加连接：
   - Host: localhost
   - Port: 5432
   - Database: zishu_dev
   - Username: zishu
   - Password: zishu123

## 🚨 常见问题

### 1. 端口冲突
**问题**: 端口 8000 被占用
**解决**: 修改 `docker-compose.dev.yml` 中的端口映射

### 2. 容器连接失败
**问题**: 无法连接到容器
**解决**: 
- 确认容器正在运行：`Docker: Show Status`
- 重启服务：`Docker: Stop All Services` → `Docker: Start All Services`

### 3. Python 解释器找不到
**问题**: VS Code 找不到 Python 解释器
**解决**: 
- `Ctrl+Shift+P` → `Python: Select Interpreter`
- 选择正确的解释器路径

### 4. 调试器连接失败
**问题**: 无法连接到 debugpy
**解决**: 
- 确认容器中的 debugpy 服务正在运行
- 检查端口 5678 是否正确转发

### 5. 热重载不工作
**问题**: 代码更改后不自动重启
**解决**: 
- 检查文件挂载是否正确
- 重启 API 容器

## 📚 进阶使用

### 1. 自定义任务

在 `.vscode/tasks.json` 中添加自定义任务：
```json
{
    "label": "My Custom Task",
    "type": "shell",
    "command": "echo",
    "args": ["Hello World"],
    "group": "build"
}
```

### 2. 调试配置

在 `.vscode/launch.json` 中添加调试配置：
```json
{
    "name": "My Debug Config",
    "type": "python",
    "request": "launch",
    "program": "${file}",
    "console": "integratedTerminal"
}
```

### 3. 工作区设置

在 `Zishu-sensei.code-workspace` 中添加工作区级别的设置。

### 4. 扩展推荐

为团队成员推荐扩展，在 `.vscode/extensions.json` 中添加。

## 🎯 开发最佳实践

### 1. 工作流建议

1. **启动**: `Docker: Start All Services`
2. **开发**: 在 VS Code 中编辑代码
3. **测试**: `Python: Run Tests`
4. **调试**: 使用断点和调试器
5. **提交**: 使用 Git 集成提交代码

### 2. 代码质量

- 启用自动格式化
- 使用类型提示
- 运行 linting 检查
- 编写单元测试

### 3. 团队协作

- 使用工作区文件
- 统一开发环境配置
- 共享调试配置
- 使用 Dev Container

---

## 🤝 获取帮助

- **VS Code 文档**: https://code.visualstudio.com/docs
- **Docker 扩展文档**: https://code.visualstudio.com/docs/containers/overview
- **Remote-Containers**: https://code.visualstudio.com/docs/remote/containers

如果遇到问题，请检查：
1. Docker 是否运行
2. 容器是否启动
3. 端口是否被占用
4. VS Code 扩展是否安装
