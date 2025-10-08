# Zishu-sensei Docker开发环境管理脚本 (PowerShell版本)
# 提供完整的Docker开发环境管理功能

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$Service = ""
)

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    switch ($Color) {
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Blue" { Write-Host $Message -ForegroundColor Blue }
        "Magenta" { Write-Host $Message -ForegroundColor Magenta }
        "Cyan" { Write-Host $Message -ForegroundColor Cyan }
        default { Write-Host $Message }
    }
}

function Write-Info { param([string]$Message) Write-ColorOutput "[INFO] $Message" "Blue" }
function Write-Success { param([string]$Message) Write-ColorOutput "[SUCCESS] $Message" "Green" }
function Write-Warning { param([string]$Message) Write-ColorOutput "[WARNING] $Message" "Yellow" }
function Write-Error { param([string]$Message) Write-ColorOutput "[ERROR] $Message" "Red" }

function Write-Header {
    param([string]$Message)
    Write-ColorOutput "========================================" "Magenta"
    Write-ColorOutput $Message "Magenta"
    Write-ColorOutput "========================================" "Magenta"
}

# 项目配置
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ComposeFile = Join-Path $ProjectRoot "docker-compose.dev.yml"
$EnvFile = Join-Path $ProjectRoot ".env.dev"

# 检查依赖
function Test-Dependencies {
    Write-Info "检查系统依赖..."
    
    # 检查Docker
    try {
        $null = docker --version
        Write-Success "Docker 已安装"
    }
    catch {
        Write-Error "Docker 未安装，请先安装 Docker Desktop"
        exit 1
    }
    
    # 检查Docker Compose
    try {
        $null = docker-compose --version
        Write-Success "Docker Compose 已安装"
    }
    catch {
        Write-Error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    }
    
    # 检查Docker是否运行
    try {
        $null = docker info 2>$null
        Write-Success "Docker 服务运行正常"
    }
    catch {
        Write-Error "Docker 服务未运行，请启动 Docker Desktop"
        exit 1
    }
    
    Write-Success "依赖检查通过"
}

# 创建必要的目录
function New-ProjectDirectories {
    Write-Info "创建必要的目录..."
    
    $Directories = @(
        "data", "logs", "cache", "notebooks", "models", "training",
        "data\postgres", "data\redis", "data\qdrant",
        "docker\postgres", "docker\jupyter"
    )
    
    foreach ($Dir in $Directories) {
        $FullPath = Join-Path $ProjectRoot $Dir
        if (!(Test-Path $FullPath)) {
            New-Item -ItemType Directory -Path $FullPath -Force | Out-Null
        }
    }
    
    Write-Success "目录创建完成"
}

# 创建环境配置文件
function New-EnvFile {
    if (!(Test-Path $EnvFile)) {
        Write-Info "创建开发环境配置文件..."
        
        $EnvContent = @"
# Zishu-sensei 开发环境配置

# 应用配置
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# 数据库配置
POSTGRES_DB=zishu_dev
POSTGRES_USER=zishu
POSTGRES_PASSWORD=zishu123
DATABASE_URL=postgresql://zishu:zishu123@postgres-dev:5432/zishu_dev

# Redis配置
REDIS_PASSWORD=zishu123
REDIS_URL=redis://:zishu123@redis-dev:6379/0

# Qdrant配置
QDRANT_URL=http://qdrant-dev:6333

# API配置
API_HOST=0.0.0.0
API_PORT=8000
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production

# 模型配置
MODEL_PATH=/app/models
CACHE_DIR=/app/cache

# 开发工具配置
JUPYTER_TOKEN=dev-token
PGADMIN_EMAIL=admin@zishu.dev
PGADMIN_PASSWORD=admin

# 邮件测试配置
SMTP_HOST=mailhog-dev
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
"@
        
        Set-Content -Path $EnvFile -Value $EnvContent -Encoding UTF8
        Write-Success "环境配置文件已创建: $EnvFile"
    }
    else {
        Write-Info "环境配置文件已存在: $EnvFile"
    }
}

# 创建数据库初始化脚本
function New-DbInitScript {
    $InitFile = Join-Path $ProjectRoot "docker\postgres\01-init-db.sql"
    
    if (!(Test-Path $InitFile)) {
        Write-Info "创建数据库初始化脚本..."
        
        $SqlContent = @"
-- Zishu-sensei 数据库初始化脚本

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- 创建开发用户（如果不存在）
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'zishu_dev') THEN
        CREATE ROLE zishu_dev WITH LOGIN PASSWORD 'zishu123';
    END IF;
END
`$`$;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE zishu_dev TO zishu_dev;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zishu_dev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zishu_dev;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zishu_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zishu_dev;
"@
        
        Set-Content -Path $InitFile -Value $SqlContent -Encoding UTF8
        Write-Success "数据库初始化脚本已创建"
    }
}

# 创建Jupyter配置
function New-JupyterConfig {
    $ConfigFile = Join-Path $ProjectRoot "docker\jupyter\jupyter_lab_config.py"
    
    if (!(Test-Path $ConfigFile)) {
        Write-Info "创建Jupyter Lab配置..."
        
        $ConfigContent = @'
# Jupyter Lab 开发环境配置

c = get_config()

# 基本配置
c.ServerApp.ip = '0.0.0.0'
c.ServerApp.port = 8888
c.ServerApp.open_browser = False
c.ServerApp.allow_root = True
c.ServerApp.token = 'dev-token'
c.ServerApp.password = ''

# 允许所有来源
c.ServerApp.allow_origin = '*'
c.ServerApp.allow_remote_access = True

# 工作目录
c.ServerApp.root_dir = '/app/workspace'

# 启用扩展
c.ServerApp.jpserver_extensions = {
    'jupyterlab': True,
    'jupyterlab_git': True,
}

# 内核配置
c.MappingKernelManager.default_kernel_name = 'python3'

# 文件管理
c.ContentsManager.allow_hidden = True
c.ContentsManager.hide_globs = ['__pycache__', '*.pyc', '*.pyo', '.DS_Store', '*.so', '*.dylib']

# 日志配置
c.Application.log_level = 'INFO'
'@
        
        Set-Content -Path $ConfigFile -Value $ConfigContent -Encoding UTF8
        Write-Success "Jupyter Lab配置已创建"
    }
}

# 构建镜像
function Build-Images {
    Write-Info "构建开发环境镜像..."
    
    Set-Location $ProjectRoot
    
    Write-Info "构建API镜像..."
    docker-compose -f $ComposeFile build zishu-api-dev
    
    Write-Info "构建Jupyter镜像..."
    docker-compose -f $ComposeFile build jupyter-dev
    
    Write-Success "镜像构建完成"
}

# 启动服务
function Start-Services {
    Write-Info "启动开发环境服务..."
    
    Set-Location $ProjectRoot
    
    Write-Info "启动数据库和缓存服务..."
    docker-compose -f $ComposeFile up -d postgres-dev redis-dev qdrant-dev
    
    Write-Info "等待数据库启动..."
    Start-Sleep -Seconds 10
    
    Write-Info "启动API服务..."
    docker-compose -f $ComposeFile up -d zishu-api-dev
    
    Write-Success "核心服务启动完成"
}

# 启动开发工具
function Start-DevTools {
    Write-Info "启动开发工具..."
    
    Set-Location $ProjectRoot
    
    docker-compose -f $ComposeFile up -d jupyter-dev pgadmin-dev redis-commander-dev mailhog-dev
    
    Write-Success "开发工具启动完成"
}

# 停止服务
function Stop-Services {
    Write-Info "停止开发环境服务..."
    
    Set-Location $ProjectRoot
    docker-compose -f $ComposeFile down
    
    Write-Success "服务已停止"
}

# 重启服务
function Restart-Services {
    Write-Info "重启开发环境服务..."
    Stop-Services
    Start-Sleep -Seconds 2
    Start-Services
    Write-Success "服务重启完成"
}

# 显示服务状态
function Show-Status {
    Write-Header "开发环境服务状态"
    
    Set-Location $ProjectRoot
    docker-compose -f $ComposeFile ps
}

# 显示日志
function Show-Logs {
    param([string]$ServiceName)
    
    Set-Location $ProjectRoot
    
    if ($ServiceName) {
        Write-Info "显示服务日志: $ServiceName"
        docker-compose -f $ComposeFile logs -f $ServiceName
    }
    else {
        Write-Info "显示所有服务日志"
        docker-compose -f $ComposeFile logs -f
    }
}

# 进入容器
function Enter-Container {
    param([string]$ServiceName)
    
    if (!$ServiceName) {
        Write-Error "请指定服务名称"
        Write-Host "可用服务: api, db, redis, jupyter"
        return
    }
    
    Set-Location $ProjectRoot
    
    switch ($ServiceName) {
        { $_ -in @("api", "zishu-api-dev") } {
            docker-compose -f $ComposeFile exec zishu-api-dev bash
        }
        { $_ -in @("db", "postgres", "postgres-dev") } {
            docker-compose -f $ComposeFile exec postgres-dev psql -U zishu -d zishu_dev
        }
        { $_ -in @("redis", "redis-dev") } {
            docker-compose -f $ComposeFile exec redis-dev redis-cli -a zishu123
        }
        { $_ -in @("jupyter", "jupyter-dev") } {
            docker-compose -f $ComposeFile exec jupyter-dev bash
        }
        default {
            Write-Error "未知服务: $ServiceName"
        }
    }
}

# 清理资源
function Clear-Resources {
    Write-Info "清理开发环境资源..."
    
    Set-Location $ProjectRoot
    
    docker-compose -f $ComposeFile down -v
    docker image prune -f
    docker volume prune -f
    
    Write-Success "清理完成"
}

# 健康检查
function Test-Health {
    Write-Info "执行健康检查..."
    
    $Services = @(
        @{Name="API"; Url="http://localhost:8000/health"},
        @{Name="Jupyter"; Url="http://localhost:8888"},
        @{Name="pgAdmin"; Url="http://localhost:5050"},
        @{Name="Redis Commander"; Url="http://localhost:8081"},
        @{Name="MailHog"; Url="http://localhost:8025"}
    )
    
    foreach ($Svc in $Services) {
        try {
            $Response = Invoke-WebRequest -Uri $Svc.Url -TimeoutSec 5 -ErrorAction Stop
            Write-Success "$($Svc.Name) 服务运行正常 ✓"
        }
        catch {
            Write-Warning "$($Svc.Name) 服务无响应或未启动"
        }
    }
}

# 显示访问信息
function Show-AccessInfo {
    Write-Header "开发环境访问信息"
    
    Write-ColorOutput "🚀 核心服务" "Green"
    Write-Host "  API服务:           " -NoNewline; Write-ColorOutput "http://localhost:8000" "Cyan"
    Write-Host "  API文档:           " -NoNewline; Write-ColorOutput "http://localhost:8000/docs" "Cyan"
    Write-Host "  健康检查:          " -NoNewline; Write-ColorOutput "http://localhost:8000/health" "Cyan"
    Write-Host ""
    Write-ColorOutput "🛠️  开发工具" "Green"
    Write-Host "  Jupyter Lab:       " -NoNewline; Write-ColorOutput "http://localhost:8888" "Cyan"; Write-Host " (token: dev-token)"
    Write-Host "  pgAdmin:           " -NoNewline; Write-ColorOutput "http://localhost:5050" "Cyan"; Write-Host " (admin@zishu.dev / admin)"
    Write-Host "  Redis Commander:   " -NoNewline; Write-ColorOutput "http://localhost:8081" "Cyan"
    Write-Host "  MailHog:           " -NoNewline; Write-ColorOutput "http://localhost:8025" "Cyan"
    Write-Host ""
    Write-ColorOutput "📊 数据库连接" "Green"
    Write-Host "  PostgreSQL:        " -NoNewline; Write-ColorOutput "localhost:5432" "Cyan"; Write-Host " (zishu / zishu123)"
    Write-Host "  Redis:             " -NoNewline; Write-ColorOutput "localhost:6379" "Cyan"; Write-Host " (password: zishu123)"
    Write-Host "  Qdrant:            " -NoNewline; Write-ColorOutput "http://localhost:6333" "Cyan"
    Write-Host ""
    Write-ColorOutput "💡 常用命令" "Blue"
    Write-Host "  查看日志:          " -NoNewline; Write-ColorOutput ".\scripts\dev-docker.ps1 logs [service]" "Yellow"
    Write-Host "  进入容器:          " -NoNewline; Write-ColorOutput ".\scripts\dev-docker.ps1 shell [service]" "Yellow"
    Write-Host "  重启服务:          " -NoNewline; Write-ColorOutput ".\scripts\dev-docker.ps1 restart" "Yellow"
    Write-Host "  健康检查:          " -NoNewline; Write-ColorOutput ".\scripts\dev-docker.ps1 health" "Yellow"
}

# 显示帮助信息
function Show-Help {
    Write-Host "Zishu-sensei Docker开发环境管理脚本 (PowerShell版本)"
    Write-Host ""
    Write-Host "用法: .\scripts\dev-docker.ps1 [命令] [选项]"
    Write-Host ""
    Write-Host "环境管理:"
    Write-Host "  setup              初始化开发环境"
    Write-Host "  start              启动核心服务"
    Write-Host "  start-tools        启动开发工具"
    Write-Host "  start-all          启动所有服务"
    Write-Host "  stop               停止所有服务"
    Write-Host "  restart            重启所有服务"
    Write-Host ""
    Write-Host "服务管理:"
    Write-Host "  status             显示服务状态"
    Write-Host "  logs [service]     显示日志"
    Write-Host "  shell <service>    进入容器"
    Write-Host "  health             健康检查"
    Write-Host ""
    Write-Host "开发工具:"
    Write-Host "  build              构建镜像"
    Write-Host "  cleanup            清理资源"
    Write-Host "  info               显示访问信息"
    Write-Host ""
    Write-Host "可用服务名称:"
    Write-Host "  api, db, redis, jupyter"
    Write-Host ""
    Write-Host "示例:"
    Write-Host "  .\scripts\dev-docker.ps1 setup           # 初始化环境"
    Write-Host "  .\scripts\dev-docker.ps1 start-all       # 启动所有服务"
    Write-Host "  .\scripts\dev-docker.ps1 logs api        # 查看API日志"
    Write-Host "  .\scripts\dev-docker.ps1 shell db        # 进入数据库"
}

# 主函数
function Main {
    param([string]$Cmd, [string]$Svc)
    
    switch ($Cmd) {
        "setup" {
            Write-Header "初始化Zishu-sensei开发环境"
            Test-Dependencies
            New-ProjectDirectories
            New-EnvFile
            New-DbInitScript
            New-JupyterConfig
            Build-Images
            Write-Success "开发环境初始化完成！"
            Write-Host ""
            Write-Info "下一步："
            Write-Host "  1. 运行 '.\scripts\dev-docker.ps1 start-all' 启动所有服务"
            Write-Host "  2. 运行 '.\scripts\dev-docker.ps1 info' 查看访问信息"
        }
        "start" {
            Start-Services
            Show-AccessInfo
        }
        "start-tools" {
            Start-DevTools
        }
        "start-all" {
            Start-Services
            Start-DevTools
            Show-AccessInfo
        }
        "stop" {
            Stop-Services
        }
        "restart" {
            Restart-Services
        }
        "status" {
            Show-Status
        }
        "logs" {
            Show-Logs $Svc
        }
        "shell" {
            Enter-Container $Svc
        }
        "build" {
            Build-Images
        }
        "cleanup" {
            Clear-Resources
        }
        "health" {
            Test-Health
        }
        "info" {
            Show-AccessInfo
        }
        { $_ -in @("help", "--help", "-h") } {
            Show-Help
        }
        default {
            Write-Error "未知命令: $Cmd"
            Write-Host ""
            Show-Help
        }
    }
}

# 运行主函数
Main $Command $Service
