"""
适配器依赖解析服务

负责适配器依赖关系的管理和解析。
"""

import asyncio
import logging
from typing import Dict, List, Set, Optional, Tuple
from collections import defaultdict, deque

from ..types import AdapterRegistration, EventType, Event, Priority

logger = logging.getLogger(__name__)


class DependencyResolver:
    """
    适配器依赖解析器

    负责管理和解析适配器之间的依赖关系，包括：
    - 依赖关系建立和维护
    - 循环依赖检测
    - 依赖解析和排序
    - 依赖变更通知
    """

    def __init__(self, registry_core):
        """初始化依赖解析器"""
        self._registry_core = registry_core
        self._lock = asyncio.Lock()
        self._is_initialized = False
        self._is_running = False

        # 依赖关系图
        self._dependency_graph: Dict[str, Set[str]] = defaultdict(set)
        self._reverse_dependency_graph: Dict[str, Set[str]] = defaultdict(set)

        logger.info("DependencyResolver initialized")

    async def initialize(self) -> None:
        """初始化服务"""
        if self._is_initialized:
            return

        async with self._lock:
            if self._is_initialized:
                return

            # 构建依赖关系图
            await self._build_dependency_graph()

            self._is_initialized = True
            logger.info("DependencyResolver initialized successfully")

    async def start(self) -> None:
        """启动服务"""
        if not self._is_initialized:
            await self.initialize()

        if self._is_running:
            return

        async with self._lock:
            if self._is_running:
                return

            self._is_running = True
            logger.info("DependencyResolver started successfully")

    async def stop(self) -> None:
        """停止服务"""
        if not self._is_running:
            return

        async with self._lock:
            if not self._is_running:
                return

            # 清理依赖关系图
            self._dependency_graph.clear()
            self._reverse_dependency_graph.clear()

            self._is_running = False
            logger.info("DependencyResolver stopped successfully")

    async def add_dependency(self, adapter_id: str, dependency_id: str) -> bool:
        """
        添加依赖关系

        Args:
            adapter_id: 适配器ID
            dependency_id: 依赖的适配器ID

        Returns:
            bool: 是否成功添加
        """
        if not self._is_running:
            raise RuntimeError("Dependency resolver is not running")

        # 检查适配器是否存在
        if not self._registry_core.has_adapter(adapter_id):
            raise ValueError(f"Adapter {adapter_id} not found")
        if not self._registry_core.has_adapter(dependency_id):
            raise ValueError(f"Dependency adapter {dependency_id} not found")

        # 检查是否会产生循环依赖
        if await self._would_create_cycle(adapter_id, dependency_id):
            raise ValueError(f"Adding dependency would create circular dependency")

        async with self._lock:
            # 添加依赖关系
            self._dependency_graph[adapter_id].add(dependency_id)
            self._reverse_dependency_graph[dependency_id].add(adapter_id)

            # 更新注册信息
            registration = self._registry_core.get_adapter(adapter_id)
            if registration:
                registration.dependencies.add(dependency_id)

            dependency_registration = self._registry_core.get_adapter(dependency_id)
            if dependency_registration:
                dependency_registration.dependents.add(adapter_id)

        logger.info(f"Added dependency: {adapter_id} -> {dependency_id}")

        # 发送依赖解析事件
        await self._registry_core._emit_event(
            Event(
                event_type=EventType.DEPENDENCY_RESOLVED,
                source="dependency_resolver",
                data={
                    "adapter_id": adapter_id,
                    "dependency_id": dependency_id,
                    "action": "added",
                },
                priority=Priority.MEDIUM,
            )
        )

        return True

    async def remove_dependency(self, adapter_id: str, dependency_id: str) -> bool:
        """
        移除依赖关系

        Args:
            adapter_id: 适配器ID
            dependency_id: 依赖的适配器ID

        Returns:
            bool: 是否成功移除
        """
        if not self._is_running:
            raise RuntimeError("Dependency resolver is not running")

        async with self._lock:
            # 移除依赖关系
            self._dependency_graph[adapter_id].discard(dependency_id)
            self._reverse_dependency_graph[dependency_id].discard(adapter_id)

            # 更新注册信息
            registration = self._registry_core.get_adapter(adapter_id)
            if registration:
                registration.dependencies.discard(dependency_id)

            dependency_registration = self._registry_core.get_adapter(dependency_id)
            if dependency_registration:
                dependency_registration.dependents.discard(adapter_id)

        logger.info(f"Removed dependency: {adapter_id} -> {dependency_id}")
        return True

    async def resolve_dependencies(self, adapter_id: str) -> List[str]:
        """
        解析适配器依赖

        Args:
            adapter_id: 适配器ID

        Returns:
            List[str]: 按依赖顺序排列的适配器ID列表
        """
        if not self._is_running:
            raise RuntimeError("Dependency resolver is not running")

        if not self._registry_core.has_adapter(adapter_id):
            raise ValueError(f"Adapter {adapter_id} not found")

        # 获取所有依赖
        all_dependencies = await self._get_all_dependencies(adapter_id)

        # 拓扑排序
        sorted_dependencies = self._topological_sort(all_dependencies)

        return sorted_dependencies

    async def check_circular_dependencies(self, adapter_id: str) -> bool:
        """
        检查循环依赖

        Args:
            adapter_id: 适配器ID

        Returns:
            bool: 是否存在循环依赖
        """
        if not self._is_running:
            return False

        if not self._registry_core.has_adapter(adapter_id):
            return False

        return await self._has_circular_dependency(adapter_id)

    async def get_dependency_tree(self, adapter_id: str) -> Dict[str, List[str]]:
        """
        获取依赖树

        Args:
            adapter_id: 适配器ID

        Returns:
            Dict[str, List[str]]: 依赖树
        """
        if not self._is_running:
            raise RuntimeError("Dependency resolver is not running")

        tree = {}
        visited = set()

        async def build_tree(current_id: str) -> List[str]:
            if current_id in visited:
                return []

            visited.add(current_id)
            dependencies = list(self._dependency_graph.get(current_id, set()))

            for dep_id in dependencies:
                tree[dep_id] = await build_tree(dep_id)

            return dependencies

        tree[adapter_id] = await build_tree(adapter_id)
        return tree

    async def get_dependents(self, adapter_id: str) -> List[str]:
        """
        获取依赖当前适配器的适配器列表

        Args:
            adapter_id: 适配器ID

        Returns:
            List[str]: 依赖当前适配器的适配器ID列表
        """
        if not self._is_running:
            return []

        return list(self._reverse_dependency_graph.get(adapter_id, set()))

    async def get_startup_order(
        self, adapter_ids: Optional[List[str]] = None
    ) -> List[str]:
        """
        获取启动顺序

        Args:
            adapter_ids: 要排序的适配器ID列表，如果为None则使用所有适配器

        Returns:
            List[str]: 按启动顺序排列的适配器ID列表
        """
        if not self._is_running:
            raise RuntimeError("Dependency resolver is not running")

        if adapter_ids is None:
            adapter_ids = list(self._registry_core._get_all_registrations().keys())

        # 构建子图
        subgraph = {}
        for adapter_id in adapter_ids:
            dependencies = self._dependency_graph.get(adapter_id, set())
            subgraph[adapter_id] = dependencies.intersection(set(adapter_ids))

        # 拓扑排序
        return self._topological_sort_graph(subgraph)

    async def _build_dependency_graph(self) -> None:
        """构建依赖关系图"""
        registrations = self._registry_core._get_all_registrations()

        for adapter_id, registration in registrations.items():
            for dependency_id in registration.dependencies:
                self._dependency_graph[adapter_id].add(dependency_id)
                self._reverse_dependency_graph[dependency_id].add(adapter_id)

    async def _get_all_dependencies(self, adapter_id: str) -> Set[str]:
        """获取所有依赖（包括传递依赖）"""
        all_dependencies = set()
        to_visit = deque([adapter_id])
        visited = set()

        while to_visit:
            current_id = to_visit.popleft()
            if current_id in visited:
                continue

            visited.add(current_id)
            dependencies = self._dependency_graph.get(current_id, set())

            for dep_id in dependencies:
                if dep_id not in all_dependencies:
                    all_dependencies.add(dep_id)
                    to_visit.append(dep_id)

        return all_dependencies

    async def _has_circular_dependency(self, adapter_id: str) -> bool:
        """检查是否存在循环依赖"""
        visited = set()
        rec_stack = set()

        def dfs(current_id: str) -> bool:
            visited.add(current_id)
            rec_stack.add(current_id)

            for neighbor in self._dependency_graph.get(current_id, set()):
                if neighbor not in visited:
                    if dfs(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True

            rec_stack.remove(current_id)
            return False

        return dfs(adapter_id)

    async def _would_create_cycle(self, adapter_id: str, dependency_id: str) -> bool:
        """检查添加依赖是否会创建循环"""
        # 临时添加依赖
        self._dependency_graph[adapter_id].add(dependency_id)

        # 检查循环
        has_cycle = await self._has_circular_dependency(adapter_id)

        # 移除临时依赖
        self._dependency_graph[adapter_id].discard(dependency_id)

        return has_cycle

    def _topological_sort(self, adapter_ids: Set[str]) -> List[str]:
        """拓扑排序"""
        # 构建子图
        subgraph = {}
        for adapter_id in adapter_ids:
            dependencies = self._dependency_graph.get(adapter_id, set())
            subgraph[adapter_id] = dependencies.intersection(adapter_ids)

        return self._topological_sort_graph(subgraph)

    def _topological_sort_graph(self, graph: Dict[str, Set[str]]) -> List[str]:
        """对图进行拓扑排序"""
        # 计算入度
        in_degree = defaultdict(int)
        for node in graph:
            in_degree[node] = 0

        for node, dependencies in graph.items():
            for dep in dependencies:
                in_degree[node] += 1

        # 找到入度为0的节点
        queue = deque([node for node, degree in in_degree.items() if degree == 0])
        result = []

        while queue:
            node = queue.popleft()
            result.append(node)

            # 更新依赖此节点的其他节点的入度
            for other_node, dependencies in graph.items():
                if node in dependencies:
                    in_degree[other_node] -= 1
                    if in_degree[other_node] == 0:
                        queue.append(other_node)

        return result

    @property
    def is_running(self) -> bool:
        """是否正在运行"""
        return self._is_running

    @property
    def is_initialized(self) -> bool:
        """是否已初始化"""
        return self._is_initialized
