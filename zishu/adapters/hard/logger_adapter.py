"""日志适配器（system.logger）

提供最小可用的日志输出能力，用于工作流/技能系统的依赖适配器。
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

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
from ..base.exceptions import AdapterValidationError


class LoggerAdapter(BaseAdapter):
    """将输入写入应用日志的适配器。"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self._logger = logging.getLogger("system.logger")

    def _load_metadata(self) -> AdapterMetadata:
        return AdapterMetadata(
            adapter_id=self.adapter_id,
            name=self.name,
            description="系统日志适配器：将消息写入服务端日志",
            adapter_type=AdapterType.HARD,
            version=AdapterVersion(
                version=self.version,
                release_date=datetime.now(timezone.utc),
                changelog="Initial system.logger adapter",
            ),
            author="Zishu System",
            tags={"system", "logger"},
            capabilities=self._get_capabilities_impl(),
            permissions=AdapterPermissions(
                security_level=SecurityLevel.INTERNAL,
                database_access=[],
            ),
            custom_fields={"kind": "logger"},
        )

    async def _initialize_impl(self) -> bool:
        return True

    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        if input_data is None:
            raise AdapterValidationError(
                "input_data is required",
                adapter_id=self.adapter_id,
            )

        payload: Dict[str, Any]
        if isinstance(input_data, dict):
            payload = input_data
        else:
            payload = {"message": str(input_data)}

        message = payload.get("message")
        if message is None:
            raise AdapterValidationError(
                "Missing field: message",
                adapter_id=self.adapter_id,
            )

        level = str(payload.get("level", "info")).lower()
        extra = {k: v for k, v in payload.items() if k not in {"message", "level"}}

        log_line = str(message)
        if extra:
            log_line = f"{log_line} | extra={extra}"

        if level == "debug":
            self._logger.debug(log_line)
        elif level in {"warn", "warning"}:
            self._logger.warning(log_line)
        elif level == "error":
            self._logger.error(log_line)
        else:
            self._logger.info(log_line)

        return {
            "kind": "logger",
            "adapter_id": self.adapter_id,
            "level": level,
            "message": str(message),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        return [
            AdapterCapability(
                name="log",
                description="写入服务端日志",
                category=CapabilityCategory.SYSTEM_CONTROL,
                input_schema={
                    "type": "object",
                    "properties": {
                        "message": {"type": "string"},
                        "level": {
                            "type": "string",
                            "enum": ["debug", "info", "warning", "error"],
                        },
                    },
                    "required": ["message"],
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "kind": {"type": "string"},
                        "adapter_id": {"type": "string"},
                        "level": {"type": "string"},
                        "message": {"type": "string"},
                        "timestamp": {"type": "string"},
                    },
                },
            )
        ]

    async def _health_check_impl(self) -> HealthCheckResult:
        return HealthCheckResult(
            is_healthy=True,
            status="healthy",
            checks={"logging": True},
            issues=[],
            metrics={"adapter_id": self.adapter_id},
        )

    async def _cleanup_impl(self) -> None:
        return None

