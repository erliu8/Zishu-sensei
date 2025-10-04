"""
HTTP适配器示例

演示如何实现HTTP客户端适配器。
"""

import asyncio
import aiohttp
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from ..core.base import BaseAdapter
from ..core.types import AdapterType, Event, EventType, Priority

logger = logging.getLogger(__name__)


class HttpAdapter(BaseAdapter):
    """
    HTTP适配器
    
    提供HTTP客户端功能，支持：
    - GET/POST/PUT/DELETE请求
    - 连接池管理
    - 超时控制
    - 重试机制
    """
    
    def __init__(self, config: Dict[str, Any]):
        """初始化HTTP适配器"""
        super().__init__(config)
        
        # HTTP配置
        self.base_url = config.get('base_url', '')
        self.timeout = config.get('timeout', 30)
        self.max_connections = config.get('max_connections', 100)
        self.max_retries = config.get('max_retries', 3)
        
        # 会话对象
        self._session: Optional[aiohttp.ClientSession] = None
        
        # 统计信息
        self._request_count = 0
        self._error_count = 0
    
    async def initialize(self) -> None:
        """初始化适配器"""
        await super().initialize()
        
        # 创建HTTP会话
        connector = aiohttp.TCPConnector(
            limit=self.max_connections,
            limit_per_host=20
        )
        
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        
        self._session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'User-Agent': 'Zishu-HttpAdapter/1.0'}
        )
        
        logger.info(f"HttpAdapter initialized with base_url: {self.base_url}")
    
    async def start(self) -> None:
        """启动适配器"""
        await super().start()
        
        # 发送启动事件
        await self.emit_event(Event(
            event_type=EventType.ADAPTER_STARTED,
            source=self.get_name(),
            data={
                'base_url': self.base_url,
                'timeout': self.timeout,
                'max_connections': self.max_connections
            },
            priority=Priority.MEDIUM
        ))
        
        logger.info("HttpAdapter started")
    
    async def stop(self) -> None:
        """停止适配器"""
        await super().stop()
        
        # 关闭HTTP会话
        if self._session:
            await self._session.close()
            self._session = None
        
        logger.info("HttpAdapter stopped")
    
    async def health_check(self) -> bool:
        """健康检查"""
        if not self._session or self._session.closed:
            return False
        
        try:
            # 尝试发送一个简单的HEAD请求
            if self.base_url:
                async with self._session.head(self.base_url) as response:
                    return response.status < 500
            return True
            
        except Exception as e:
            logger.error(f"HttpAdapter health check failed: {e}")
            return False
    
    async def get(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        发送GET请求
        
        Args:
            url: 请求URL
            params: 查询参数
            headers: 请求头
            
        Returns:
            Dict[str, Any]: 响应数据
        """
        return await self._request('GET', url, params=params, headers=headers)
    
    async def post(
        self,
        url: str,
        data: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        发送POST请求
        
        Args:
            url: 请求URL
            data: 表单数据
            json: JSON数据
            headers: 请求头
            
        Returns:
            Dict[str, Any]: 响应数据
        """
        return await self._request('POST', url, data=data, json=json, headers=headers)
    
    async def put(
        self,
        url: str,
        data: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        发送PUT请求
        
        Args:
            url: 请求URL
            data: 表单数据
            json: JSON数据
            headers: 请求头
            
        Returns:
            Dict[str, Any]: 响应数据
        """
        return await self._request('PUT', url, data=data, json=json, headers=headers)
    
    async def delete(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        发送DELETE请求
        
        Args:
            url: 请求URL
            headers: 请求头
            
        Returns:
            Dict[str, Any]: 响应数据
        """
        return await self._request('DELETE', url, headers=headers)
    
    async def _request(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        发送HTTP请求
        
        Args:
            method: HTTP方法
            url: 请求URL
            **kwargs: 其他参数
            
        Returns:
            Dict[str, Any]: 响应数据
        """
        if not self._session:
            raise RuntimeError("HttpAdapter is not initialized")
        
        # 构建完整URL
        if self.base_url and not url.startswith('http'):
            url = f"{self.base_url.rstrip('/')}/{url.lstrip('/')}"
        
        # 重试逻辑
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                self._request_count += 1
                
                # 发送请求
                async with self._session.request(method, url, **kwargs) as response:
                    # 检查响应状态
                    if response.status >= 400:
                        error_text = await response.text()
                        raise aiohttp.ClientResponseError(
                            request_info=response.request_info,
                            history=response.history,
                            status=response.status,
                            message=error_text
                        )
                    
                    # 解析响应
                    content_type = response.headers.get('content-type', '')
                    
                    if 'application/json' in content_type:
                        data = await response.json()
                    else:
                        text = await response.text()
                        data = {'text': text}
                    
                    # 发送成功事件
                    await self.emit_event(Event(
                        event_type=EventType.OPERATION_COMPLETED,
                        source=self.get_name(),
                        data={
                            'method': method,
                            'url': url,
                            'status': response.status,
                            'attempt': attempt + 1
                        },
                        priority=Priority.LOW
                    ))
                    
                    return {
                        'status': response.status,
                        'headers': dict(response.headers),
                        'data': data
                    }
                    
            except Exception as e:
                last_exception = e
                self._error_count += 1
                
                if attempt < self.max_retries:
                    # 等待后重试
                    wait_time = 2 ** attempt
                    logger.warning(
                        f"Request failed (attempt {attempt + 1}), retrying in {wait_time}s: {e}"
                    )
                    await asyncio.sleep(wait_time)
                else:
                    # 发送错误事件
                    await self.emit_event(Event(
                        event_type=EventType.OPERATION_FAILED,
                        source=self.get_name(),
                        data={
                            'method': method,
                            'url': url,
                            'error': str(e),
                            'attempts': self.max_retries + 1
                        },
                        priority=Priority.HIGH
                    ))
                    
                    logger.error(f"Request failed after {self.max_retries + 1} attempts: {e}")
        
        if last_exception:
            raise last_exception
    
    def get_adapter_type(self) -> AdapterType:
        """获取适配器类型"""
        return AdapterType.NETWORK
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        base_stats = super().get_statistics()
        
        return {
            **base_stats,
            'request_count': self._request_count,
            'error_count': self._error_count,
            'success_rate': self._calculate_success_rate(),
            'base_url': self.base_url,
            'timeout': self.timeout,
            'max_connections': self.max_connections
        }
    
    def _calculate_success_rate(self) -> float:
        """计算成功率"""
        if self._request_count == 0:
            return 0.0
        return (self._request_count - self._error_count) / self._request_count
