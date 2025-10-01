"""
FastAPI server 
"""

import asyncio
import signal
import sys
import time
import traceback
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, Any, Optional, List
import uvicorn
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from zishu.api.dependencies import initialize_dependencies, get_dependencies
from zishu.api.schemas.chat import CharacterConfig
from zishu.utils.logger import setup_logger
from zishu.utils.config_manager import ConfigManager


class ServerState:
    """服务器状态管理"""
    def __init__(self):
        self.startup_time = time.time()
        self.request_count = 0
        self.error_count = 0
        self.is_shutting_down = False
        self.dependencies = None
        
    def increment_request(self):
        self.request_count += 1
        
    def increment_error(self):
        self.error_count += 1

#全局状态实例
server_state = ServerState()

class LoggingMiddleware(BaseHTTPMiddleware):
    """日志中间件"""
    
    def __init__(self,app):
        super().__init__(app)
        self.logger = None
        
    async def dispatch(self,request:Request,call_next):
        #延迟获取Logger，确保依赖已初始化
        if self.logger is None:
            try:
                deps = get_dependencies()
                self.logger = deps.get_logger()
            except:
                self.logger = setup_logger("zishu-api")
                
        start_time = time.time()
        
        #记录请求信息
        self.logger.info(
            f"Request: {request.method} {request.url.path} "
            f"- Client: {request.client.host if request.client else 'Unknown'}"
        )
        
        try:
            response = await call_next(request)
            server_state.increment_request()
            
            #记录响应信息
            process_time = time.time() - start_time
            self.logger.info(f"Response: {response.status_code} in {process_time:.3f}s")
            
            #添加处理时间到响应头
            response.headers["X-Process-Time"] = f"{process_time:.3f}s"
            return response
        
        except Exception as e:
            server_state.increment_error()
            process_time = time.time() - start_time
            self.logger.error(
                f"Request Failed: {request.method} {request.url.path} "
                f"Error: {str(e)} - Time: {process_time:.3f}s"
            )
            raise
        
class SecurityMiddleware(BaseHTTPMiddleware):
    """安全中间件"""
    
    async def dispatch(self, request: Request, call_next):
        #检查是否在关闭状态
        if server_state.is_shutting_down:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"detail":"Server is shutting down"}
            )
            
        response = await call_next(request)
        
        #添加安全头
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
    
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    #启动时初始化
    logger = setup_logger("zishu-server")
    logger.info("Starting Zishu Server...")
    
    try:
        #初始化依赖
        config_dir = Path("configs")
        dependencies = initialize_dependencies(config_dir)
        server_state.dependencies = dependencies
        
        #获取配置管理器
        config_manager = dependencies.get_config_manager()
        
        #注册默认角色配置
        try:
            characters_config = CharacterConfig(
                name = "紫舒老师",
                personality = "温柔、耐心、害羞、有责任心",
            )
            dependencies.register_character_config(characters_config)
        except Exception as e:
            logger.warning(f"Failed to register default character config: {e}")
            
        logger.info("Zishu Server dependencies initialized successfully")
        
        #注册信号处理器
        def signal_handler(signum, frame):
            logger.info(f"Received signal {signum}, initiating graceful shutdown...")
            server_state.is_shutting_down = True
            
        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)
        
        server_state.startup_time = time.time()
        logger.info(f"Zishu Server started in {server_state.startup_time:.2f}s")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize Zishu Server: {e}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        raise
    
    finally:
        logger.info("Zishu Server shutdown completed...")
        
        try:
            if server_state.dependencies:
                server_state.dependencies.clear_services()
                server_state.dependencies = None
                logger.info("Server cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
            
def create_app(
    config_dir: Optional[Path] = None,
    host: str = "0.0.0.0",
    port: int = 8000,
    debug: bool = False,
    reload: bool = False) -> FastAPI:
    """创建FastAPI应用实例"""
    
    app = FastAPI(
        title="Zishu-sensei API",
        description="Zishu AI - AI factory",
        version="0.1.0",
        docs_url="/docs" if debug else None,
        redoc_url="/redoc" if debug else None,
        lifespan=lifespan
    )
    
    #配置CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:8080",
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ], # TODO: 生产环境使用具体域名
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Process-Time"],
    )
    
    #添加受信任主机中间件
    if not debug:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["localhost", "127.0.0.1", "test", "testserver"], # TODO: 生产环境使用具体域名
        )
        
    #添加自定义日志中间件
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(SecurityMiddleware)
    
    #全局异常处理器
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        server_state.increment_error()
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Validation error",
                        "errors": exc.errors(),
                        "body": exc.body if hasattr(exc, "body") else None}
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        server_state.increment_error()
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail,
                    "status_code": exc.status_code}
        )
        
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        server_state.increment_error()
        logger = setup_logger("zishu-exception")
        logger.error(f"Unhandled exception: {str(exc)}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error",
                    "error_type": type(exc).__name__,
                    "message": str(exc) if debug else "An unexpected server error occurred"}
        )
    
    #健康检查端点
    @app.get("/health",tags=["System"])
    async def root():
        """根端点"""
        return{
            "status": "healthy",
            "message": "Welcome to Zishu-sensei API",
            "version": "0.1.0",
            "docs": "/docs" if debug else "Documentation not available in production",
            "health": "/health"
        }

    #系统信息端点
    @app.get("/system/info",tags=["System"])
    async def system_info():
        """获取系统信息"""
        try:
            deps = get_dependencies()
            config_manager = deps.get_config_manager()
            character_config = deps.get_character_config()
            
            return {
                "server": {
                    "name": "Zishu-sensei API",
                    "version": "0.1.0",
                    "uptime": time.time() - server_state.startup_time,
                },
                "character": {
                    "name": character_config.name if character_config else "no character config",
                    "personality": character_config.personality if character_config else "no character config",
                } if character_config else None,
                "services": {
                    "available": [name for name in ["config_manager","logger","model_registry","performance_monitor","prompt_manager","thread_factory"] if deps.container.has(name)]}
            }
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail=f"Failed to get system info: {str(e)}")
            
    #TODO: 可注册其他路由
    @app.post("/chat",tags=["Chat"])
    async def chat(request: Request):
        """聊天端点"""
        try:
            #TODO: 实现实际的聊天逻辑
            data = await request.json()
            
            return {
                "status": "success",
                "message": "Chat request received",
                "echo": data,
                "timestamp": time.time()
            }
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Failed to process chat request: {str(e)}")

    # 注册路由
    try:
        from zishu.api.routes import register_routes
        register_routes(app)
    except Exception as e:
        logger = setup_logger("zishu-server")
        logger.warning(f"Failed to register routes: {e}")

    return app

def run_server(    
    host: str = "0.0.0.0",
    port: int = 8000,
    debug: bool = False,
    reload: bool = False,
    workers: int = 1,
    config_dir: Optional[Path] = None):
    
    """运行服务器"""
    logger = setup_logger("zishu-main")
    
    try:
        logger.info(f"Starting Zishu Server on {host}:{port}")
        logger.info(f"Debug mode: {debug}")
        logger.info(f"Reload mode: {reload}")

        #创建应用
        app = create_app(
            config_dir=config_dir,
            host=host,
            port=port,
            debug=debug,
            reload=reload
        )
        
        #配置uvicorn
        config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            reload=reload,
            workers=workers if not reload else 1, #reload模式下只使用一个工作进程
            log_level="debug" if debug else "info",
            access_log=True,
            server_header=False, #不显示服务器头
            date_header=False, #不显示日期头
        )
    
        #启动服务器
        server = uvicorn.Server(config)
        server.run()
        
    except KeyboardInterrupt:
        logger.info("Zishu Server stopped by user...")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Failed to start Zishu Server: {str(e)}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        sys.exit(1)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Zishu-sensei API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    parser.add_argument("--workers", type=int, default=1, help="Number of worker processes")
    parser.add_argument("--config-dir", type=Path, help="Configuration directory")
    
    args = parser.parse_args()
    
    run_server(
        host=args.host,
        port=args.port,
        reload=args.reload,
        debug=args.debug,
        workers=args.workers,
        config_dir=args.config_dir
    )

