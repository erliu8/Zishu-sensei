"""
标准化 API 响应工具
"""
from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel

# 定义泛型类型
T = TypeVar('T')


class ApiResponse(BaseModel, Generic[T]):
    """
    标准化 API 响应格式
    
    Attributes:
        success: 请求是否成功
        message: 响应消息
        data: 响应数据（泛型）
        error: 错误信息（可选）
    """
    success: bool = True
    message: str = "操作成功"
    data: Optional[T] = None
    error: Optional[str] = None

    class Config:
        """Pydantic 配置"""
        from_attributes = True


def create_response(
    data: Optional[Any] = None,
    message: str = "操作成功",
    success: bool = True,
    error: Optional[str] = None
) -> dict:
    """
    创建标准化 API 响应
    
    Args:
        data: 响应数据
        message: 响应消息
        success: 是否成功
        error: 错误信息
        
    Returns:
        标准化的响应字典
        
    Examples:
        >>> create_response(data={"id": 1, "name": "Test"})
        {"success": True, "message": "操作成功", "data": {"id": 1, "name": "Test"}, "error": None}
        
        >>> create_response(success=False, message="操作失败", error="具体错误信息")
        {"success": False, "message": "操作失败", "data": None, "error": "具体错误信息"}
    """
    return {
        "success": success,
        "message": message,
        "data": data,
        "error": error
    }


def create_success_response(data: Optional[Any] = None, message: str = "操作成功") -> dict:
    """
    创建成功响应的便捷方法
    
    Args:
        data: 响应数据
        message: 成功消息
        
    Returns:
        成功响应字典
    """
    return create_response(data=data, message=message, success=True)


def create_error_response(message: str = "操作失败", error: Optional[str] = None) -> dict:
    """
    创建错误响应的便捷方法
    
    Args:
        message: 错误消息
        error: 详细错误信息
        
    Returns:
        错误响应字典
    """
    return create_response(success=False, message=message, error=error)


def create_list_response(
    items: list,
    total: int,
    page: int = 1,
    size: int = 20,
    message: str = "获取列表成功"
) -> dict:
    """
    创建列表响应的便捷方法
    
    Args:
        items: 列表项
        total: 总数
        page: 当前页码
        size: 每页大小
        message: 响应消息
        
    Returns:
        列表响应字典
    """
    data = {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0
    }
    return create_response(data=data, message=message)

