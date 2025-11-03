"""
Zishu AI Community Platform - Backend API
紫舒老师社区平台 - 后端 API
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config.settings import settings
from app.db.session import init_db, close_db
from app.db.redis import redis_client
from app.db.qdrant import qdrant_manager
from app.api.v1.api import api_router
from app.middleware import (
    RequestLoggingMiddleware,
    PerformanceLoggingMiddleware,
    RateLimitMiddleware,
    register_exception_handlers,
    setup_logging,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    print("🚀 启动应用...")
    
    # 设置日志配置
    setup_logging(log_level=settings.LOG_LEVEL, log_format=settings.LOG_FORMAT)
    print("✅ 日志已配置")
    
    # 初始化数据库
    await init_db()
    print("✅ 数据库已初始化")
    
    # 连接 Redis
    await redis_client.connect()
    print("✅ Redis 已连接")
    
    # 连接 Qdrant
    await qdrant_manager.connect()
    print("✅ Qdrant 已连接")
    
    yield
    
    # 关闭时
    print("🛑 关闭应用...")
    
    # 关闭数据库连接
    await close_db()
    print("✅ 数据库连接已关闭")
    
    # 断开 Redis
    await redis_client.disconnect()
    print("✅ Redis 已断开")
    
    # 断开 Qdrant
    await qdrant_manager.disconnect()
    print("✅ Qdrant 已断开")


# 创建 FastAPI 应用
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    redirect_slashes=True,  # 启用自动斜杠重定向，统一路由风格
)

# ==================== 注册异常处理器 ====================
register_exception_handlers(app)

# ==================== 添加中间件（注意顺序：后添加的先执行） ====================

# 1. CORS 中间件（最外层）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # 暴露所有响应头
    max_age=600,  # preflight 请求缓存时间（秒）
)

# 2. 请求日志中间件
app.add_middleware(
    RequestLoggingMiddleware,
    exclude_paths=["/health", "/docs", "/redoc", "/openapi.json", "/"],
    log_request_body=settings.DEBUG,  # 仅在调试模式下记录请求体
    log_response_body=False,
)

# 3. 性能日志中间件
app.add_middleware(
    PerformanceLoggingMiddleware,
    slow_request_threshold=1.0,  # 1秒
)

# 4. 限流中间件
app.add_middleware(
    RateLimitMiddleware,
    requests_per_window=settings.RATE_LIMIT_REQUESTS,
    window_seconds=settings.RATE_LIMIT_WINDOW,
    enabled=settings.RATE_LIMIT_ENABLED,
    exclude_paths=["/health", "/docs", "/redoc", "/openapi.json", "/"],
)

# 注册 API 路由
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health")
async def health_check():
    """健康检查端点"""
    # 检查 Redis 连接
    redis_status = "connected" if redis_client.redis else "disconnected"
    
    # 检查 Qdrant 连接
    qdrant_status = "connected" if qdrant_manager.client else "disconnected"
    
    return {
        "status": "healthy",
        "service": "zishu-backend",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected",
        "redis": redis_status,
        "qdrant": qdrant_status,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )

