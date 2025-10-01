"""
路由模块初始化文件
负责导入并管理所有路由模块，提供统一的路由注册接口
"""
from typing import List
from fastapi import APIRouter, FastAPI
from pathlib import Path

#from zishu.api.routes.health import router as health_router
#from zishu.api.routes.chat import router as chat_router

def get_available_routes(app: FastAPI) -> List[APIRouter]:
    """
    获取所有路由模块
    
    Returns:
        List[APIRouter]: 所有路由模块
    """
    routers = []
    
    # 动态检查并导入有效的路由模块
    try:
        from .chat import router as chat_router
        routers.append(chat_router)
    except (ImportError, AttributeError):
        pass
    
    try:
        from .health import router as health_router
        routers.append(health_router)
    except (ImportError, AttributeError):
        pass
    
    return routers

def register_routes(app: FastAPI, prefix: str = "/api/v1") -> None:
    """注册路由

    Args:
        app (FastAPI): FastAPI实例
        prefix (str, optional): 路由前缀. Defaults to "/api/v1".
    """
    routers = get_available_routes(app)
    
    for router in routers:
        app.include_router(router, prefix=prefix)
        
def get_router_info(app: FastAPI = None) -> dict:
    """
    获取路由信息

    Returns:
        dict: 包含路由统计信息的字典
    """
    routers = get_available_routes(app) if app else []
    return {"total_routers": len(routers),
            "router_name":[getattr(router, 'tags', ['unkown'])[0] if getattr(router, 'tags', None) else 'unkown' 
                           for router in routers],
            "available": True if routers else False}
    
#为向后兼容性提供的导出
__all__ = [
    "get_available_routes",
    "register_routes",
    "get_router_info",
]

#模块级别的元数据
__version__ = "0.1.0"
__author__ = "Zishu Team"
__description__ = "Zishu-sensei API Routes"
        
        
        





