"""情绪日记存储适配器 (tool.mood_diary.store)

提供情绪日记的持久化存储和查询功能，使用 JSONL 格式按月存储文件。
"""

from __future__ import annotations

import asyncio
import json
import hashlib
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import aiofiles
import aiofiles.os

from ..base.adapter import BaseAdapter, ExecutionContext, HealthCheckResult
from ..base.metadata import (
    AdapterCapability,
    AdapterMetadata,
    AdapterPermissions,
    AdapterType,
    AdapterVersion,
    CapabilityCategory,
    SecurityLevel,
)
from ..base.exceptions import (
    AdapterLoadingError,
    AdapterValidationError,
    AdapterExecutionError,
)


class MoodDiaryStoreAdapter(BaseAdapter):
    """情绪日记存储适配器"""

    @staticmethod
    def _resolve_data_root() -> Optional[Path]:
        """
        解析项目内的 `data` 入口：
        - 若 `data` 是文件：内容为真实数据目录路径（而不是目录本身）
        - 若 `data` 是目录/软链接：直接作为真实数据目录

        注意：服务进程的 CWD 可能不是仓库根目录，因此这里基于本模块文件路径向上查找。

        例如仓库根目录下 `data` 文件内容为：`/data/disk/zishu-sensei/data`
        """
        module_path = Path(__file__).resolve()

        def _from_pointer(pointer: Path) -> Optional[Path]:
            if not pointer.exists():
                return None
            if pointer.is_file():
                try:
                    text = pointer.read_text(encoding="utf-8").strip()
                except Exception:
                    return None
                if not text:
                    return None
                return Path(text).expanduser()

            # `data` 是目录或软链接：返回其解析后的绝对路径（strict=False 允许目标暂不存在）。
            try:
                return pointer.resolve(strict=False)
            except Exception:
                return pointer

        # 0) 优先使用环境变量（适用于代码被安装到 site-packages、无法定位仓库根目录的部署方式）
        env_candidates = [
            "ZISHU_DATA_ROOT",
            "ZISHU_DATA_DIR",
            "DATA_ROOT",
            "DATA_DIR",
        ]
        for env_key in env_candidates:
            env_value = (os.getenv(env_key) or "").strip()
            if env_value:
                return Path(env_value).expanduser()

        # 1) 优先以仓库根目录为准（pyproject.toml 同级），避免误命中系统级的 `/data` 目录。
        for parent in [module_path.parent, *module_path.parents]:
            if (parent / "pyproject.toml").exists():
                repo_pointer = parent / "data"
                resolved = _from_pointer(repo_pointer)
                if resolved is not None:
                    return resolved
                break

        # 2) 兜底：沿路径向上搜索，但跳过系统根目录下的 `/data`（常见为不可写挂载点）。
        for parent in [module_path.parent, *module_path.parents]:
            pointer = parent / "data"
            try:
                if pointer.is_dir() and pointer.resolve(strict=False) == Path("/data"):
                    continue
            except Exception:
                pass

            resolved = _from_pointer(pointer)
            if resolved is not None:
                return resolved

        return None

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

        base_path = config.get("base_path", "cache/mood_diary")

        if not isinstance(base_path, (str, Path)) or not str(base_path).strip():
            raise AdapterValidationError(
                "base_path must be a non-empty string",
                adapter_id=self.adapter_id,
            )
        configured_path = Path(str(base_path))

        # 兼容：`base_path` 相对路径通常写成 `data/...`，但仓库里 `data` 可能是指针文件或软链接。
        if not configured_path.is_absolute() and configured_path.parts:
            if configured_path.parts[0] == "data":
                data_root = self._resolve_data_root()
                if data_root is not None:
                    configured_path = data_root.joinpath(*configured_path.parts[1:])
            else:
                # 其他相对路径：尽量相对于包含 `zishu` 包的目录定位，避免受 CWD 影响。
                module_path = Path(__file__).resolve()
                repo_root = next(
                    (p for p in [module_path.parent, *module_path.parents] if (p / "pyproject.toml").exists()),
                    None,
                )
                if repo_root is not None:
                    configured_path = (repo_root / configured_path).resolve(strict=False)
        else:
            # 兼容：某些部署环境可能把默认的 `data/mood_diary` 变成了 `/data/mood_diary`（不可写）。
            # 若发现这种情况且项目存在 `data` 指针/软链接入口，则映射到真实数据目录。
            if (
                configured_path.is_absolute()
                and configured_path.parts[:2] == ("/", "data")
                and len(configured_path.parts) >= 3
                and configured_path.parts[2] == "mood_diary"
            ):
                data_root = self._resolve_data_root()
                if data_root is not None:
                    configured_path = data_root.joinpath(*configured_path.parts[2:])

        self._base_path = configured_path
        self._file_locks: Dict[str, asyncio.Lock] = {}
        self._lock_lock = asyncio.Lock()  # 用于保护 _file_locks 字典的锁

        # 情绪关键词映射
        self._mood_keywords = {
            "sad": ["难过", "伤心", "失落", "沮丧", "不开心", "郁闷", "难过"],
            "happy": ["开心", "高兴", "快乐", "兴奋", "满足", "愉快", "欢乐"],
            "anxious": ["焦虑", "紧张", "担心", "不安", "压力", "忧虑", "急躁"],
            "calm": ["平静", "放松", "舒适", "安心", "宁静", "平和", "轻松"],
            "angry": ["生气", "愤怒", "恼火", "气愤", "暴躁", "恼怒"],
            "confused": ["困惑", "迷茫", "不解", "疑惑", "糊涂"],
        }

        # 主题关键词映射
        self._topic_keywords = {
            "工作": ["工作", "公司", "同事", "老板", "项目", "职场", "加班"],
            "人际": ["朋友", "家人", "同事", "关系", "聊天", "交往", "聚会"],
            "学习": ["学习", "考试", "课程", "知识", "书", "阅读", "培训"],
            "健康": ["健康", "运动", "锻炼", "身体", "病", "医院", "睡眠"],
            "情感": ["爱情", "恋爱", "分手", "结婚", "单身", "暗恋"],
            "娱乐": ["电影", "音乐", "游戏", "旅行", "休闲", "爱好"],
        }

    def _load_metadata(self) -> AdapterMetadata:
        return AdapterMetadata(
            adapter_id=self.adapter_id,
            name=self.name,
            description="情绪日记存储适配器：持久化和查询情绪日记条目",
            adapter_type=AdapterType.HARD,
            version=AdapterVersion(
                version=self.version,
                release_date=datetime.now(timezone.utc),
                changelog="Initial mood diary store adapter",
            ),
            author="Zishu System",
            tags={"mood", "diary", "store"},
            capabilities=self._get_capabilities_impl(),
            permissions=AdapterPermissions(
                security_level=SecurityLevel.INTERNAL,
                file_system_access=[str(self._base_path)],
                database_access=[],
            ),
            custom_fields={"kind": "store"},
        )

    async def _initialize_impl(self) -> bool:
        """初始化存储目录"""
        try:
            # 确保基础目录存在
            await self._ensure_directory_exists(self._base_path)
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize mood diary store: {e}")
            raise AdapterLoadingError(
                f"Mood diary store initialization failed: {str(e)}",
                adapter_id=self.adapter_id,
                cause=e,
            )

    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理请求"""
        if input_data is None:
            raise AdapterValidationError(
                "input_data is required",
                adapter_id=self.adapter_id,
            )

        if not isinstance(input_data, dict):
            raise AdapterValidationError(
                "input_data must be a dictionary",
                adapter_id=self.adapter_id,
            )

        action = input_data.get("action")
        if not action:
            raise AdapterValidationError(
                "Missing field: action",
                adapter_id=self.adapter_id,
            )

        user_id = context.user_id
        if not user_id:
            raise AdapterValidationError(
                "user_id is required in ExecutionContext",
                adapter_id=self.adapter_id,
            )

        if action == "append_entry":
            entry = input_data.get("entry")
            if not entry:
                raise AdapterValidationError(
                    "Missing field: entry for append_entry action",
                    adapter_id=self.adapter_id,
                )
            return await self._append_entry(user_id, entry)

        elif action == "list_entries":
            filters = input_data.get("filters", {})
            return await self._list_entries(user_id, filters)

        else:
            raise AdapterValidationError(
                f"Unknown action: {action}",
                adapter_id=self.adapter_id,
            )

    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        return [
            AdapterCapability(
                name="data_storage",
                description="存储情绪日记条目",
                category=CapabilityCategory.FILE_OPERATIONS,
                is_required=True,
            ),
            AdapterCapability(
                name="data_retrieval",
                description="查询情绪日记条目",
                category=CapabilityCategory.FILE_OPERATIONS,
                is_required=True,
            ),
            AdapterCapability(
                name="data_filtering",
                description="按条件筛选日记条目",
                category=CapabilityCategory.DATA_ANALYSIS,
                is_required=False,
            ),
        ]

    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查"""
        try:
            # 检查基础目录是否可访问
            await self._ensure_directory_exists(self._base_path)

            # 检查是否可以创建测试文件
            test_file = self._base_path / ".health_check"
            async with aiofiles.open(test_file, "w") as f:
                await f.write("test")
            await aiofiles.os.remove(test_file)

            return HealthCheckResult(
                is_healthy=True,
                status="ok",
                message="Mood diary store is healthy",
                last_check=datetime.now(timezone.utc),
                details={
                    "base_path": str(self._base_path),
                    "locks_count": len(self._file_locks),
                },
            )
        except Exception as e:
            return HealthCheckResult(
                is_healthy=False,
                status="error",
                message=f"Health check failed: {str(e)}",
                last_check=datetime.now(timezone.utc),
                details={"error": str(e)},
            )

    async def _cleanup_impl(self) -> None:
        """清理资源"""
        # 清理文件锁
        async with self._lock_lock:
            self._file_locks.clear()

    async def _append_entry(self, user_id: str, entry: Dict) -> Dict:
        """追加日记条目"""
        if not isinstance(entry, dict):
            raise AdapterValidationError(
                "entry must be a dictionary",
                adapter_id=self.adapter_id,
            )

        # 生成日记内容和分析
        if not entry.get("content"):
            entry["content"] = self._generate_content(entry.get("raw", {}))

        if not entry.get("mood") or entry["mood"] == "other":
            entry["mood"] = self._detect_mood(entry.get("content", ""))

        if not entry.get("topics"):
            entry["topics"] = self._extract_topics(entry.get("content", ""))

        # 补充必要字段
        if not entry.get("entry_id"):
            timestamp = entry.get("ts") or datetime.now(timezone.utc).isoformat()
            if not isinstance(timestamp, str):
                timestamp = str(timestamp)

            safe_ts = (
                timestamp.replace(":", "")
                .replace("-", "")
                .replace("+", "")
                .replace("Z", "")
            )
            entry["entry_id"] = f"diary_{safe_ts[:15]}_{self._hash_user_id(user_id)[:6]}"

        entry["user_id"] = user_id  # 确保使用 ExecutionContext 的 user_id

        # 获取时间戳
        ts = entry.get("ts", datetime.now(timezone.utc).isoformat())

        # 追加到 JSONL 文件
        lock = await self._get_file_lock(user_id, ts)
        async with lock:
            file_path = self._get_file_path(user_id, ts)
            await self._ensure_directory_exists(file_path.parent)

            # 追加写入
            line = json.dumps(entry, ensure_ascii=False) + "\n"
            async with aiofiles.open(file_path, 'a', encoding='utf-8') as f:
                await f.write(line)

            # 日志记录（不包含敏感信息）
            self.logger.info(
                f"Appended diary entry {entry.get('entry_id')} for user {self._hash_user_id(user_id)}",
                extra={
                    "entry_id": entry.get("entry_id"),
                    "user_hash": self._hash_user_id(user_id),
                    "content_length": len(entry.get("content", "")),
                }
            )

        return {
            "success": True,
            "entry_id": entry["entry_id"],
            "ts": entry.get("ts"),
        }

    async def _list_entries(self, user_id: str, filters: Dict) -> Dict:
        """查询日记条目"""
        if filters is None:
            filters = {}
        if not isinstance(filters, dict):
            raise AdapterValidationError(
                "filters must be a dictionary",
                adapter_id=self.adapter_id,
            )

        entries = []
        date_range = filters.get("range", {})
        limit = filters.get("limit", 20)
        try:
            limit = int(limit)
        except Exception:
            limit = 20
        if limit <= 0:
            limit = 20
        keyword = filters.get("keyword", "")
        moods = filters.get("mood", [])
        topics = filters.get("topics", [])

        if isinstance(moods, str):
            moods = [moods]
        if isinstance(topics, str):
            topics = [topics]

        # 扫描相关文件
        for file_path in self._get_files_in_range(user_id, date_range):
            if not file_path.exists():
                continue

            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                async for line in f:
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        entry = json.loads(line)
                        if self._matches_filters(entry, keyword, moods, topics):
                            entries.append(entry)
                            if len(entries) >= limit:
                                break
                    except json.JSONDecodeError:
                        self.logger.warning(f"Invalid JSON line in {file_path}")
                        continue
            if len(entries) >= limit:
                break

        # 按时间戳倒序排序
        entries.sort(key=lambda x: x.get("ts", ""), reverse=True)

        # 生成简单统计
        summary = {
            "count": len(entries),
            "mood_counts": {},
            "topic_counts": {},
        }

        for entry in entries:
            mood = entry.get("mood", "other")
            summary["mood_counts"][mood] = summary["mood_counts"].get(mood, 0) + 1

            for topic in entry.get("topics", []):
                summary["topic_counts"][topic] = summary["topic_counts"].get(topic, 0) + 1

        return {
            "items": entries[:limit],
            "summary": summary,
        }

    def _generate_content(self, raw: Dict) -> str:
        """生成日记内容"""
        user_text = raw.get("user_text", "")
        # 简单规则：如果用户文本太长，则截断
        if len(user_text) > 50:
            return user_text[:100] + "..."
        return user_text if user_text else "今天发生了一些事"

    def _detect_mood(self, text: str) -> str:
        """检测情绪"""
        for mood, keywords in self._mood_keywords.items():
            if any(kw in text for kw in keywords):
                return mood
        return "other"

    def _extract_topics(self, text: str) -> List[str]:
        """提取主题"""
        topics = []
        for topic, keywords in self._topic_keywords.items():
            if any(kw in text for kw in keywords):
                topics.append(topic)
        return topics

    def _get_file_path(self, user_id: str, ts: str) -> Path:
        """获取文件路径"""
        try:
            dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        except:
            dt = datetime.now(timezone.utc)

        month_str = dt.strftime("%Y-%m")
        return self._base_path / user_id / f"entries_{month_str}.jsonl"

    async def _get_file_lock(self, user_id: str, ts: str) -> asyncio.Lock:
        """获取文件锁"""
        file_path = str(self._get_file_path(user_id, ts))

        async with self._lock_lock:
            if file_path not in self._file_locks:
                self._file_locks[file_path] = asyncio.Lock()
            return self._file_locks[file_path]

    async def _ensure_directory_exists(self, path: Path) -> None:
        """确保目录存在"""
        try:
            # 避免 `data` 指针文件这种“文件占位”导致的 ENOTDIR。
            if path.exists() and not path.is_dir():
                raise AdapterExecutionError(
                    f"Path exists but is not a directory: {path}",
                    adapter_id=self.adapter_id,
                )

            if hasattr(aiofiles.os, "makedirs"):
                await aiofiles.os.makedirs(path, exist_ok=True)
            else:
                await asyncio.to_thread(path.mkdir, parents=True, exist_ok=True)
        except Exception as e:
            raise AdapterExecutionError(
                f"Failed to create directory {path}: {str(e)}",
                adapter_id=self.adapter_id,
            )

    def _get_files_in_range(self, user_id: str, date_range: Dict) -> List[Path]:
        """获取时间范围内的文件列表"""
        files = []
        user_dir = self._base_path / user_id

        if not user_dir.exists():
            return files

        try:
            from_date = date_range.get("from")
            to_date = date_range.get("to")

            # 如果没有指定时间范围，使用最近3个月
            if not from_date and not to_date:
                now = datetime.now(timezone.utc)
                for i in range(3):
                    dt = now.replace(day=1) - timedelta(days=i*30)
                    month_str = dt.strftime("%Y-%m")
                    file_path = user_dir / f"entries_{month_str}.jsonl"
                    if file_path.exists():
                        files.append(file_path)
                return files

            # 解析时间范围并生成月份列表
            if from_date:
                from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            else:
                from_dt = datetime.now(timezone.utc) - timedelta(days=90)

            if to_date:
                to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            else:
                to_dt = datetime.now(timezone.utc)

            current = from_dt.replace(day=1)
            while current <= to_dt:
                month_str = current.strftime("%Y-%m")
                file_path = user_dir / f"entries_{month_str}.jsonl"
                if file_path.exists():
                    files.append(file_path)

                # 下个月
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)

        except Exception as e:
            self.logger.warning(f"Error getting files in range: {e}")

        return files

    def _matches_filters(self, entry: Dict, keyword: str, moods: List[str], topics: List[str]) -> bool:
        """检查条目是否匹配过滤条件"""
        # 关键词过滤
        if keyword:
            content = entry.get("content", "").lower()
            raw_user = entry.get("raw", {}).get("user_text", "").lower()
            if keyword.lower() not in content and keyword.lower() not in raw_user:
                return False

        # 情绪过滤
        if moods:
            if entry.get("mood", "other") not in moods:
                return False

        # 主题过滤
        if topics:
            entry_topics = set(entry.get("topics", []))
            if not any(topic in entry_topics for topic in topics):
                return False

        return True

    def _hash_user_id(self, user_id: str) -> str:
        """对用户ID进行哈希，用于日志记录"""
        return hashlib.sha256(user_id.encode()).hexdigest()[:8]
