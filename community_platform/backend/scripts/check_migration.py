#!/usr/bin/env python3
"""
检查数据库迁移配置

这个脚本验证：
1. Alembic 配置是否正确
2. 所有模型是否可以导入
3. 数据库连接是否可用
4. 迁移环境是否就绪
"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))


def print_section(title: str):
    """打印章节标题"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def check_imports():
    """检查模型导入"""
    print_section("1. 检查模型导入")
    
    try:
        from app.models import (
            User,
            Post,
            Comment,
            Like,
            Follow,
            Notification,
        )
        print("✓ 所有模型导入成功")
        print(f"  - User: {User}")
        print(f"  - Post: {Post}")
        print(f"  - Comment: {Comment}")
        print(f"  - Like: {Like}")
        print(f"  - Follow: {Follow}")
        print(f"  - Notification: {Notification}")
        return True
    except Exception as e:
        print(f"✗ 模型导入失败: {e}")
        return False


def check_database_session():
    """检查数据库会话"""
    print_section("2. 检查数据库会话")
    
    try:
        from app.db.session import Base, engine
        print("✓ 数据库会话配置成功")
        print(f"  - Base: {Base}")
        print(f"  - Engine: {engine}")
        return True
    except Exception as e:
        print(f"✗ 数据库会话配置失败: {e}")
        return False


def check_settings():
    """检查应用配置"""
    print_section("3. 检查应用配置")
    
    try:
        from app.core.config.settings import settings
        print("✓ 应用配置加载成功")
        print(f"  - Database URL: {settings.DATABASE_URL}")
        print(f"  - Sync Database URL: {settings.SYNC_DATABASE_URL}")
        print(f"  - Environment: {settings.ENVIRONMENT}")
        print(f"  - Debug: {settings.DEBUG}")
        return True
    except Exception as e:
        print(f"✗ 应用配置加载失败: {e}")
        return False


def check_alembic_config():
    """检查 Alembic 配置"""
    print_section("4. 检查 Alembic 配置")
    
    try:
        from alembic.config import Config
        from alembic import script
        
        # 加载 Alembic 配置
        alembic_cfg = Config(str(project_root / "alembic.ini"))
        script_dir = script.ScriptDirectory.from_config(alembic_cfg)
        
        print("✓ Alembic 配置加载成功")
        print(f"  - 配置文件: {project_root / 'alembic.ini'}")
        print(f"  - 脚本目录: {script_dir.dir}")
        
        # 检查迁移文件
        versions = list(script_dir.walk_revisions())
        print(f"  - 迁移文件数量: {len(versions)}")
        
        if versions:
            print(f"  - 最新版本: {versions[0].revision}")
        else:
            print("  - ⚠️  还没有创建迁移文件")
            
        return True
    except Exception as e:
        print(f"✗ Alembic 配置检查失败: {e}")
        return False


def check_database_connection():
    """检查数据库连接"""
    print_section("5. 检查数据库连接")
    
    try:
        import asyncio
        from app.db.session import engine
        from sqlalchemy import text
        
        async def test_connection():
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                return result.scalar()
        
        result = asyncio.run(test_connection())
        
        if result == 1:
            print("✓ 数据库连接成功")
            return True
        else:
            print("✗ 数据库连接测试失败")
            return False
    except Exception as e:
        print(f"✗ 数据库连接失败: {e}")
        print("  提示: 确保数据库服务正在运行")
        print("  运行: docker-compose up -d postgres")
        return False


def check_metadata():
    """检查模型元数据"""
    print_section("6. 检查模型元数据")
    
    try:
        from app.db.session import Base
        
        print("✓ 模型元数据加载成功")
        print(f"  - 表数量: {len(Base.metadata.tables)}")
        
        for table_name in Base.metadata.tables.keys():
            print(f"  - {table_name}")
            
        return True
    except Exception as e:
        print(f"✗ 模型元数据检查失败: {e}")
        return False


def main():
    """主函数"""
    print("\n" + "="*60)
    print("  数据库迁移配置检查")
    print("="*60)
    
    results = []
    
    # 运行所有检查
    results.append(("模型导入", check_imports()))
    results.append(("数据库会话", check_database_session()))
    results.append(("应用配置", check_settings()))
    results.append(("Alembic 配置", check_alembic_config()))
    results.append(("数据库连接", check_database_connection()))
    results.append(("模型元数据", check_metadata()))
    
    # 总结
    print_section("检查总结")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓" if result else "✗"
        print(f"{status} {name}")
    
    print(f"\n通过: {passed}/{total}")
    
    if passed == total:
        print("\n✓ 所有检查通过！数据库迁移配置正确。")
        print("\n下一步:")
        print("  1. 创建初始迁移: make init-migration")
        print("  2. 应用迁移: make upgrade")
        return 0
    else:
        print("\n✗ 部分检查失败，请修复上述问题。")
        return 1


if __name__ == "__main__":
    sys.exit(main())

