#!/usr/bin/env python3
"""
审计日志系统使用示例
演示如何在适配器框架中集成和使用审计功能
"""

import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from zishu.adapters.core.security import (
    # 核心类
    AuditLogger, AuditConfig, FileAuditStorage,
    AuditEvent, AuditEventType, AuditLevel, AuditSeverity,
    
    # 装饰器
    audit_operation, audit_adapter_operation,
    
    # 工具函数
    initialize_audit_system, shutdown_audit_system,
    get_audit_logger
)

class ExampleAdapter:
    """示例适配器类"""
    
    def __init__(self, adapter_id: str):
        self.adapter_id = adapter_id
        self.adapter_type = "example"
    
    @audit_adapter_operation("process_data")
    async def process_data(self, data: str) -> str:
        """处理数据的示例方法"""
        if not data:
            raise ValueError("Data cannot be empty")
        
        # 模拟处理时间
        await asyncio.sleep(0.1)
        return f"Processed: {data}"
    
    @audit_adapter_operation("validate_input")
    def validate_input(self, input_data: dict) -> bool:
        """验证输入的同步方法"""
        if not isinstance(input_data, dict):
            raise TypeError("Input must be a dictionary")
        
        return "required_field" in input_data

async def basic_usage_example():
    """基本使用示例"""
    print("=== 基本使用示例 ===")
    
    # 1. 初始化审计系统
    config = AuditConfig(
        enabled=True,
        default_level=AuditLevel.INFO,
        async_storage=True,
        batch_size=10,
        flush_interval_seconds=2
    )
    
    storage = FileAuditStorage(log_directory=Path("./logs/audit_example"))
    audit_logger = await initialize_audit_system(config, storage)
    
    # 2. 记录基本事件
    await audit_logger.log_event(
        AuditEventType.SYSTEM_START,
        "Example system started",
        level=AuditLevel.INFO,
        component="example_system"
    )
    
    # 3. 记录适配器操作
    await audit_logger.log_adapter_load("example_adapter", "example", version="1.0")
    
    # 4. 记录API请求
    await audit_logger.log_api_request(
        method="GET",
        path="/api/test",
        status_code=200,
        duration_ms=150.5,
        client_ip="127.0.0.1",
        user_id="test_user"
    )
    
    # 5. 记录安全事件
    await audit_logger.log_security_event(
        AuditEventType.AUTH_LOGIN,
        "User logged in successfully",
        AuditSeverity.LOW,
        user_id="test_user",
        client_ip="127.0.0.1"
    )
    
    print("基本事件已记录")
    
    # 等待事件刷新
    await asyncio.sleep(3)
    
    # 6. 查看统计信息
    stats = audit_logger.get_stats()
    print(f"审计统计: {stats}")
    
    await shutdown_audit_system()

async def adapter_integration_example():
    """适配器集成示例"""
    print("\n=== 适配器集成示例 ===")
    
    # 初始化审计系统
    await initialize_audit_system()
    
    # 创建示例适配器
    adapter = ExampleAdapter("test_adapter_001")
    
    try:
        # 测试正常操作
        result = await adapter.process_data("test data")
        print(f"处理结果: {result}")
        
        # 测试同步方法
        is_valid = adapter.validate_input({"required_field": "value"})
        print(f"验证结果: {is_valid}")
        
        # 测试错误情况
        try:
            await adapter.process_data("")
        except ValueError as e:
            print(f"捕获到预期错误: {e}")
        
        try:
            adapter.validate_input("invalid_input")
        except TypeError as e:
            print(f"捕获到预期错误: {e}")
    
    except Exception as e:
        print(f"意外错误: {e}")
    
    # 等待事件处理
    await asyncio.sleep(2)
    
    await shutdown_audit_system()

async def security_audit_example():
    """安全审计示例"""
    print("\n=== 安全审计示例 ===")
    
    # 初始化审计系统
    audit_logger = await initialize_audit_system()
    
    # 创建安全审计器
    security_auditor = SecurityAuditor(audit_logger)
    
    # 模拟认证尝试
    await security_auditor.log_authentication_attempt(
        user_id="user123",
        success=True,
        client_ip="192.168.1.100",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    )
    
    # 模拟失败的认证尝试
    for i in range(3):
        await security_auditor.log_authentication_attempt(
            user_id="attacker",
            success=False,
            client_ip="192.168.1.200",
            user_agent="curl/7.68.0"
        )
    
    # 模拟权限检查
    await security_auditor.log_permission_check(
        user_id="user123",
        resource="user_data",
        action="read",
        granted=True
    )
    
    await security_auditor.log_permission_check(
        user_id="user123",
        resource="admin_panel",
        action="access",
        granted=False
    )
    
    # 模拟数据修改
    await security_auditor.log_data_modification(
        user_id="user123",
        resource="profile",
        operation="update",
        old_value={"name": "Old Name"},
        new_value={"name": "New Name"}
    )
    
    # 检测可疑活动
    is_suspicious = await security_auditor.detect_suspicious_activity(
        user_id="night_user",
        client_ip="192.168.1.300"
    )
    print(f"检测到可疑活动: {is_suspicious}")
    
    await asyncio.sleep(2)
    await shutdown_audit_system()

async def config_management_example():
    """配置管理示例"""
    print("\n=== 配置管理示例 ===")
    
    # 创建示例配置文件
    config_file = "./config/audit_config.json"
    create_example_config_file(config_file)
    
    # 从配置文件设置审计系统
    audit_logger, config_manager = await setup_audit_system_from_config(config_file)
    
    print(f"当前配置: enabled={config_manager.get_config().enabled}")
    
    # 动态更新配置
    config_manager.update_config(
        default_level=AuditLevel.DEBUG,
        batch_size=50
    )
    
    # 设置组件级别
    config_manager.set_component_level("test_component", AuditLevel.WARNING)
    
    # 忽略某些事件类型
    config_manager.ignore_event_type(AuditEventType.API_REQUEST)
    
    # 记录一些测试事件
    await audit_logger.log_event(
        AuditEventType.CONFIG_CHANGE,
        "Configuration updated",
        component="config_manager"
    )
    
    await audit_logger.log_event(
        AuditEventType.API_REQUEST,
        "This should be ignored",
        component="api"
    )
    
    await asyncio.sleep(2)
    await shutdown_audit_system()

async def analysis_and_reporting_example():
    """分析和报告示例"""
    print("\n=== 分析和报告示例 ===")
    
    # 初始化审计系统并生成一些测试数据
    audit_logger = await initialize_audit_system()
    
    # 生成测试数据
    test_events = [
        (AuditEventType.API_REQUEST, "GET /api/users", AuditLevel.INFO),
        (AuditEventType.API_REQUEST, "POST /api/users", AuditLevel.INFO),
        (AuditEventType.API_ERROR, "GET /api/error", AuditLevel.ERROR),
        (AuditEventType.AUTH_LOGIN, "User login", AuditLevel.INFO),
        (AuditEventType.AUTH_FAILED, "Failed login", AuditLevel.WARNING),
        (AuditEventType.ADAPTER_EXECUTE, "Adapter execution", AuditLevel.INFO),
        (AuditEventType.ADAPTER_ERROR, "Adapter error", AuditLevel.ERROR),
    ]
    
    for event_type, message, level in test_events:
        await audit_logger.log_event(
            event_type,
            message,
            level=level,
            component="test_system",
            user_id="test_user"
        )
    
    # 等待事件处理
    await asyncio.sleep(3)
    
    # 创建分析器
    analyzer = AuditAnalyzer(audit_logger.storage)
    
    # 获取事件统计
    event_stats = await analyzer.get_event_statistics()
    print(f"事件类型统计: {event_stats}")
    
    level_stats = await analyzer.get_event_statistics(group_by="level")
    print(f"级别统计: {level_stats}")
    
    # 检测异常
    anomalies = await analyzer.detect_anomalies(
        time_window_hours=1,
        error_threshold=0.2,
        request_threshold=5
    )
    print(f"检测到的异常: {anomalies}")
    
    # 获取安全摘要
    security_summary = await analyzer.get_security_summary()
    print(f"安全摘要: {security_summary}")
    
    # 生成完整报告
    from datetime import datetime, timedelta
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=1)
    
    report = await create_audit_report(
        audit_logger.storage,
        start_time,
        end_time,
        output_file="./reports/audit_report.json"
    )
    
    print(f"生成报告，总事件数: {report['total_events']}")
    
    await shutdown_audit_system()

async def middleware_example():
    """中间件使用示例（模拟FastAPI）"""
    print("\n=== 中间件示例 ===")
    
    # 初始化审计系统
    audit_logger = await initialize_audit_system()
    
    # 创建审计中间件
    audit_middleware = AuditMiddleware(audit_logger)
    
    # 模拟请求对象
    class MockRequest:
        def __init__(self, method: str, path: str, client_ip: str = "127.0.0.1"):
            self.method = method
            self.url = type('URL', (), {'path': path})()
            self.client = type('Client', (), {'host': client_ip})()
            self.headers = {"user-agent": "test-client/1.0"}
            self.state = type('State', (), {})()
    
    # 模拟响应对象
    class MockResponse:
        def __init__(self, status_code: int = 200):
            self.status_code = status_code
    
    # 模拟处理函数
    async def mock_handler(request):
        if request.url.path == "/error":
            raise Exception("Simulated error")
        return MockResponse(200)
    
    # 测试正常请求
    request = MockRequest("GET", "/api/test")
    try:
        response = await audit_middleware(request, mock_handler)
        print(f"请求处理成功: {response.status_code}")
    except Exception as e:
        print(f"请求处理失败: {e}")
    
    # 测试错误请求
    error_request = MockRequest("POST", "/error")
    try:
        response = await audit_middleware(error_request, mock_handler)
    except Exception as e:
        print(f"预期的错误: {e}")
    
    await asyncio.sleep(2)
    await shutdown_audit_system()

async def main():
    """主函数 - 运行所有示例"""
    print("审计日志系统使用示例")
    print("=" * 50)
    
    try:
        await basic_usage_example()
        await adapter_integration_example()
        await security_audit_example()
        await config_management_example()
        await analysis_and_reporting_example()
        await middleware_example()
        
        print("\n所有示例执行完成！")
        print("请查看以下文件:")
        print("- ./logs/audit_example/ - 审计日志文件")
        print("- ./config/audit_config.json - 配置文件")
        print("- ./reports/audit_report.json - 审计报告")
        
    except Exception as e:
        print(f"示例执行出错: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # 创建必要的目录
    Path("./logs").mkdir(exist_ok=True)
    Path("./config").mkdir(exist_ok=True)
    Path("./reports").mkdir(exist_ok=True)
    
    # 运行示例
    asyncio.run(main())
