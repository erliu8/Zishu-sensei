"""
Zishu AI Community Platform - Backend API
紫舒老师社区平台 - 后端 API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os

# 创建 FastAPI 应用
app = FastAPI(
    title="Zishu AI Community Platform API",
    description="紫舒老师社区平台后端 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# 配置 CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Welcome to Zishu AI Community Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "service": "zishu-backend",
        "version": "1.0.0"
    }


@app.get("/api/status")
async def api_status():
    """API 状态端点"""
    return {
        "status": "running",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "database": "connected",  # TODO: 实际检查数据库连接
        "redis": "connected",     # TODO: 实际检查 Redis 连接
    }


# API 路由
@app.get("/api/v1/hello")
async def hello():
    """测试端点"""
    return {
        "message": "Hello from Zishu AI!",
        "description": "这是紫舒老师社区平台的测试接口"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

