# Dev Container 配置

这个 Dev Container 配置允许您在 Docker 容器中开发 Zishu-sensei 项目。

## 使用方法

1. 确保您已经安装了：
   - Docker Desktop
   - VS Code
   - Dev Containers 扩展

2. 确保 Docker 镜像存在：
   ```bash
   docker images | grep zishu-sensei-zishu-api
   ```

3. 在 VS Code 中打开项目

4. 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)

5. 选择 "Dev Containers: Reopen in Container"

## 配置详情

- **镜像**: `zishu-sensei-zishu-api:latest`
- **工作目录**: `/app`
- **转发端口**: 
  - 8000 (API Server)
  - 8888 (Jupyter Lab)
- **预装扩展**: Python, Pylance, Black, isort, Jupyter, Docker, GitLens

## 环境变量

- `PYTHONPATH`: `/app`
- `ENVIRONMENT`: `development`
- `DEBUG`: `true`

## 挂载点

- 项目根目录挂载到 `/app`
- VS Code 设置挂载到 `/app/.vscode`

## 后续步骤

容器启动后会自动执行：
```bash
pip install --upgrade pip && pip install -r requirements.txt
```
