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
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from zishu.api.dependencies import get_dependencies, initialize_dependencies
from zishu.api.schemas.chat import CharacterConfig
from zishu.utils.config_manager import ConfigManager
from zishu.utils.logger import setup_logger


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


# 全局状态实例
server_state = ServerState()


class LoggingMiddleware(BaseHTTPMiddleware):
    """日志中间件"""

    def __init__(self, app):
        super().__init__(app)
        self.logger = None

    async def dispatch(self, request: Request, call_next):
        # 延迟获取Logger，确保依赖已初始化
        if self.logger is None:
            try:
                deps = get_dependencies()
                self.logger = deps.get_logger()
            except:
                self.logger = setup_logger("zishu-api")

        start_time = time.time()

        # 记录请求信息
        self.logger.info(
            f"Request: {request.method} {request.url.path} "
            f"- Client: {request.client.host if request.client else 'Unknown'}"
        )

        try:
            response = await call_next(request)
            server_state.increment_request()

            # 记录响应信息
            process_time = time.time() - start_time
            self.logger.info(f"Response: {response.status_code} in {process_time:.3f}s")

            # 添加处理时间到响应头
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
        # 检查是否在关闭状态
        if server_state.is_shutting_down:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"detail": "Server is shutting down"},
            )

        response = await call_next(request)

        # 添加安全头
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    logger = setup_logger("zishu-server")
    logger.info("Starting Zishu Server...")

    try:
        # 初始化依赖
        config_dir = Path("configs")
        dependencies = initialize_dependencies(config_dir)
        server_state.dependencies = dependencies

        # 获取配置管理器
        config_manager = dependencies.get_config_manager()

        # 注册默认角色配置
        try:
            characters_config = CharacterConfig(
                name="紫舒老师",
                display_name="紫舒老师",
                description="温柔、耐心、害羞、有责任心的AI老师",
                personality_traits=["温柔", "耐心", "害羞", "有责任心"],
            )
            dependencies.register_character_config(characters_config)
        except Exception as e:
            logger.warning(f"Failed to register default character config: {e}")

        logger.info("Zishu Server dependencies initialized successfully")

        # 初始化数据库连接
        try:
            from zishu.database.connection import init_database, DatabaseConfig
            logger.info("Initializing database connection...")
            db_config = DatabaseConfig.from_env()
            await init_database(db_config)
            logger.info("Database connection initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            # 数据库初始化失败不阻塞应用启动（某些功能可能需要数据库）

        # 初始化 AdapterManager（提前初始化避免请求时超时）
        try:
            from zishu.api.dependencies import get_adapter_manager
            logger.info("Initializing AdapterManager...")
            adapter_manager = get_adapter_manager()
            if not adapter_manager._initialized:
                await adapter_manager.initialize()
                logger.info("AdapterManager initialized")
            from zishu.adapters.core.services.base import ServiceStatus
            if adapter_manager._status != ServiceStatus.RUNNING:
                await adapter_manager.start()
                logger.info("AdapterManager started")
            
            # 从数据库加载并注册适配器配置
            try:
                from zishu.adapters.core.persistence import AdapterPersistenceService
                from zishu.adapters.core.types import AdapterConfiguration, AdapterType
                from zishu.adapters.soft.third_party_api_adapter import ThirdPartyAPIAdapter
                from zishu.adapters.hard.workflow_adapter import WorkflowAdapter
                from zishu.adapters.hard.logger_adapter import LoggerAdapter
                from zishu.adapters.hard.mood_diary_store_adapter import MoodDiaryStoreAdapter

                def _preferred_mood_diary_base_path() -> str:
                    """
                    返回更稳妥的 base_path（尽量是绝对路径），避免依赖服务进程的 CWD。
                    """
                    base_path_value = "data/mood_diary"
                    try:
                        repo_root = next(
                            (
                                p
                                for p in [
                                    Path(__file__).resolve().parent,
                                    *Path(__file__).resolve().parents,
                                ]
                                if (p / "pyproject.toml").exists()
                            ),
                            None,
                        )
                        if repo_root is None:
                            return base_path_value

                        data_entry = repo_root / "data"
                        if data_entry.is_file():
                            text = data_entry.read_text(encoding="utf-8").strip()
                            if text:
                                return str(Path(text) / "mood_diary")
                        if data_entry.exists():
                            return str(data_entry.resolve(strict=False) / "mood_diary")
                    except Exception:
                        return base_path_value

                    return base_path_value

                def _resolve_adapter_class(config_dict: Dict[str, Any]):
                    adapter_id = config_dict.get("adapter_id")
                    adapter_class_path = config_dict.get("adapter_class")
                    config = config_dict.get("config") or {}
                    kind = config.get("kind") if isinstance(config, dict) else None

                    # Built-ins: be resilient to historical/incorrect persisted adapter_class.
                    if adapter_id == "tool.mood_diary.store" or kind == "store":
                        return MoodDiaryStoreAdapter

                    if (
                        adapter_class_path
                        == "zishu.adapters.hard.workflow_adapter.WorkflowAdapter"
                        or kind == "workflow"
                    ):
                        return WorkflowAdapter
                    if adapter_class_path == "zishu.adapters.hard.logger_adapter.LoggerAdapter":
                        return LoggerAdapter
                    if (
                        adapter_class_path
                        == "zishu.adapters.hard.mood_diary_store_adapter.MoodDiaryStoreAdapter"
                    ):
                        return MoodDiaryStoreAdapter
                    if (
                        adapter_class_path
                        == "zishu.adapters.soft.third_party_api_adapter.ThirdPartyAPIAdapter"
                    ):
                        return ThirdPartyAPIAdapter

                    # v0 fallback: keep historical behavior
                    return ThirdPartyAPIAdapter
                
                persistence_service = AdapterPersistenceService()
                saved_configs = await persistence_service.load_all_adapter_configs()
                
                logger.info(f"Found {len(saved_configs)} saved adapter configurations")
                
                for config_dict in saved_configs:
                    try:
                        adapter_id = config_dict['adapter_id']
 
                        # 修正内置 store 的 base_path：避免旧配置/相对路径在服务运行环境中不可用。
                        if adapter_id == "tool.mood_diary.store":
                            cfg = config_dict.get("config") or {}
                            if isinstance(cfg, dict):
                                cfg = {**cfg}
                                cfg.setdefault("kind", "store")
                                cfg["base_path"] = _preferred_mood_diary_base_path()
                                config_dict["config"] = cfg

                        # 重建配置对象
                        adapter_config = AdapterConfiguration(
                             identity=adapter_id,
                            name=config_dict['name'],
                            version=config_dict['version'],
                            adapter_type=AdapterType(config_dict['adapter_type']) if isinstance(config_dict['adapter_type'], str) else config_dict['adapter_type'],
                            adapter_class=_resolve_adapter_class(config_dict),
                            config=config_dict['config'],
                            dependencies=set(config_dict.get('dependencies', []) or []),
                            description=config_dict.get('description'),
                            author=config_dict.get('author'),
                            tags=config_dict.get('tags', []),
                        )
                        
                        # 注册适配器
                        success = await adapter_manager.register_adapter(adapter_config)
                        if success:
                            # 尝试启动适配器
                            start_success = await adapter_manager.start_adapter(adapter_id)
                            if start_success:
                                logger.info(f"✅ Restored and started adapter: {adapter_id}")
                            else:
                                logger.warning(f"⚠️ Restored adapter but failed to start: {adapter_id}")
                        else:
                            logger.warning(f"❌ Failed to restore adapter: {adapter_id}")
                            
                    except Exception as e:
                        logger.error(f"Failed to restore adapter {config_dict.get('adapter_id', 'unknown')}: {e}")
                        continue
                
                logger.info(f"Adapter restoration completed: {len(adapter_manager._adapters)} adapters running")
                
            except Exception as e:
                logger.warning(f"Failed to load adapters from database: {e}")
                # 不阻塞应用启动
                
        except Exception as e:
            logger.warning(f"Failed to initialize AdapterManager: {e}")
            # 不阻塞应用启动，允许稍后初始化

        # 注册信号处理器
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

        # 停止 AdapterManager
        try:
            from zishu.api.dependencies import get_adapter_manager
            adapter_manager = get_adapter_manager()
            if adapter_manager and adapter_manager._initialized:
                await adapter_manager.stop()
                logger.info("AdapterManager stopped")
        except Exception as e:
            logger.warning(f"Error stopping AdapterManager: {e}")

        # 清理数据库连接
        try:
            from zishu.database.connection import cleanup_database
            await cleanup_database()
            logger.info("Database connection cleaned up")
        except Exception as e:
            logger.warning(f"Error cleaning up database: {e}")

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
    reload: bool = False,
) -> FastAPI:
    """创建FastAPI应用实例"""

    app = FastAPI(
        title="Zishu-sensei API",
        description="Zishu AI - AI factory",
        version="0.1.0",
        docs_url="/docs" if debug else None,
        redoc_url="/redoc" if debug else None,
        lifespan=lifespan,
    )

    # 配置CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:8080",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:1420",  # Tauri开发服务器
            "tauri://localhost",  # Tauri应用
            "*",  # 开发模式允许所有来源
        ],  # TODO: 生产环境使用具体域名
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Process-Time"],
    )

    # 添加受信任主机中间件
    if not debug:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=[
                "localhost",
                "127.0.0.1",
                "test",
                "testserver",
            ],  # TODO: 生产环境使用具体域名
        )

    # 添加自定义日志中间件
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(SecurityMiddleware)

    # 全局异常处理器
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        server_state.increment_error()
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Validation error",
                "errors": exc.errors(),
                "body": exc.body if hasattr(exc, "body") else None,
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        server_state.increment_error()
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "status_code": exc.status_code},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        server_state.increment_error()
        logger = setup_logger("zishu-exception")
        logger.error(f"Unhandled exception: {str(exc)}")
        logger.error(f"Stack trace: {traceback.format_exc()}")

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "error_type": type(exc).__name__,
                "message": str(exc) if debug else "An unexpected server error occurred",
            },
        )

    # 根端点
    @app.get("/", tags=["System"])
    async def root():
        """根端点"""
        return {
            "message": "Welcome to Zishu-sensei API",
            "version": "0.1.0",
            "docs": "/docs" if debug else "Documentation not available in production",
            "health": "/health",
            "system_info": "/system/info",
        }

    # 健康检查端点
    @app.get("/health", tags=["System"])
    async def health_check():
        """健康检查端点"""
        return {
            "status": "healthy",
            "message": "Zishu-sensei API is running",
            "version": "0.1.0",
        }

    # 系统信息端点
    @app.get("/system/info", tags=["System"])
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
                    "name": character_config.name
                    if character_config
                    else "no character config",
                    "personality": character_config.personality
                    if character_config
                    else "no character config",
                }
                if character_config
                else None,
                "services": {
                    "available": [
                        name
                        for name in [
                            "config_manager",
                            "logger",
                            "model_registry",
                            "performance_monitor",
                            "prompt_manager",
                            "thread_factory",
                        ]
                        if deps.container.has(name)
                    ]
                },
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get system info: {str(e)}",
            )

    # TODO: 可注册其他路由
    @app.post("/chat", tags=["Chat"])
    async def chat(request: Request):
        """聊天端点"""
        try:
            # TODO: 实现实际的聊天逻辑
            data = await request.json()

            return {
                "status": "success",
                "message": "Chat request received",
                "echo": data,
                "timestamp": time.time(),
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to process chat request: {str(e)}",
            )

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
    config_dir: Optional[Path] = None,
):
    """运行服务器"""
    logger = setup_logger("zishu-main")

    try:
        logger.info(f"Starting Zishu Server on {host}:{port}")
        logger.info(f"Debug mode: {debug}")
        logger.info(f"Reload mode: {reload}")

        # 创建应用
        app = create_app(
            config_dir=config_dir, host=host, port=port, debug=debug, reload=reload
        )

        # 配置uvicorn
        config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            reload=reload,
            workers=workers if not reload else 1,  # reload模式下只使用一个工作进程
            log_level="debug" if debug else "info",
            access_log=True,
            server_header=False,  # 不显示服务器头
            date_header=False,  # 不显示日期头
        )

        # 启动服务器
        server = uvicorn.Server(config)
        server.run()

    except KeyboardInterrupt:
        logger.info("Zishu Server stopped by user...")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Failed to start Zishu Server: {str(e)}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        sys.exit(1)


# 创建默认应用实例供uvicorn使用
app = create_app(debug=True, reload=True)

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Zishu-sensei API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    parser.add_argument(
        "--workers", type=int, default=1, help="Number of worker processes"
    )
    parser.add_argument("--config-dir", type=Path, help="Configuration directory")

    args = parser.parse_args()

    run_server(
        host=args.host,
        port=args.port,
        reload=args.reload,
        debug=args.debug,
        workers=args.workers,
        config_dir=args.config_dir,
    )
