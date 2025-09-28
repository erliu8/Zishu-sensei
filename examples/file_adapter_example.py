#!/usr/bin/env python3
"""
文件系统适配器使用示例
演示如何使用文件系统适配器进行各种文件操作
"""

import asyncio
import json
import sys
from pathlib import Path

# 添加项目路径到系统路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from zishu.adapters.hard.file_adapter import FileSystemAdapter, FileSafetyConfig, FileOperation


async def main():
    """文件系统适配器使用示例"""
    
    # 创建安全配置
    safety_config = {
        'allowed_paths': ['/tmp/file_adapter_test', '/tmp/test_files'],
        'forbidden_paths': ['/home', '/root', '/etc'],
        'max_file_size': 10 * 1024 * 1024,  # 10MB
        'enable_backup': True,
        'backup_dir': '/tmp/file_adapter_backups',
    }
    
    # 创建适配器配置
    adapter_config = {
        'adapter_type': 'hard',
        'name': 'FileSystemAdapter',
        'version': '1.0.0',
        'safety_config': safety_config
    }
    
    # 创建文件系统适配器实例
    adapter = FileSystemAdapter(adapter_config)
    
    try:
        # 初始化适配器
        print("📁 初始化文件系统适配器...")
        await adapter.initialize()
        print("✅ 适配器初始化成功")
        
        # 创建测试目录
        test_dir = Path('/tmp/file_adapter_test')
        test_dir.mkdir(exist_ok=True)
        
        print("\n" + "="*60)
        print("🗂️ 文件系统适配器功能演示")
        print("="*60)
        
        # 1. 创建目录
        print("\n1️⃣ 创建目录...")
        mkdir_op = FileOperation(
            operation='mkdir',
            path=str(test_dir / 'new_folder')
        )
        result = await adapter.process(mkdir_op)
        print(f"   创建目录结果: {result.output}")
        
        # 2. 写入文件
        print("\n2️⃣ 写入文件...")
        test_content = """# 这是一个测试文件
        
这是文件系统适配器创建的测试文件。
创建时间: $(date)

## 功能列表
- 文件读取
- 文件写入
- 目录操作
- 安全检查

## 技术特性
- 异步操作
- 自动备份
- 权限控制
- 路径验证
"""
        
        write_op = FileOperation(
            operation='write',
            path=str(test_dir / 'test_file.md'),
            content=test_content,
            create_dirs=True,
            backup=True
        )
        result = await adapter.process(write_op)
        print(f"   写入文件结果: {result.output}")
        
        # 3. 读取文件
        print("\n3️⃣ 读取文件...")
        read_op = FileOperation(
            operation='read',
            path=str(test_dir / 'test_file.md')
        )
        result = await adapter.process(read_op)
        print(f"   文件大小: {result.output['size']} 字节")
        print(f"   文件内容预览: {result.output['content'][:100]}...")
        
        # 4. 追加内容
        print("\n4️⃣ 追加文件内容...")
        append_op = FileOperation(
            operation='append',
            path=str(test_dir / 'test_file.md'),
            content="\n\n---\n追加的内容\n文件系统适配器演示完成！"
        )
        result = await adapter.process(append_op)
        print(f"   追加内容结果: {result.output}")
        
        # 5. 获取文件信息
        print("\n5️⃣ 获取文件统计信息...")
        stat_op = FileOperation(
            operation='stat',
            path=str(test_dir / 'test_file.md')
        )
        result = await adapter.process(stat_op)
        file_info = result.output
        print(f"   文件名: {file_info['name']}")
        print(f"   文件大小: {file_info['size']} 字节")
        print(f"   创建时间: {file_info['created_time']}")
        print(f"   修改时间: {file_info['modified_time']}")
        print(f"   文件权限: {file_info['permissions']}")
        if file_info.get('checksum'):
            print(f"   MD5校验和: {file_info['checksum']}")
        
        # 6. 列出目录内容
        print("\n6️⃣ 列出目录内容...")
        list_op = FileOperation(
            operation='list',
            path=str(test_dir)
        )
        result = await adapter.process(list_op)
        print(f"   目录: {result.output['path']}")
        print(f"   总计: {result.output['total_items']} 项")
        for item in result.output['files']:
            item_type = "📁" if item['is_directory'] else "📄"
            print(f"   {item_type} {item['name']} ({item['size']} 字节)")
        
        # 7. 复制文件
        print("\n7️⃣ 复制文件...")
        copy_op = FileOperation(
            operation='copy',
            path=str(test_dir / 'test_file.md'),
            target_path=str(test_dir / 'test_file_copy.md')
        )
        result = await adapter.process(copy_op)
        print(f"   复制结果: {result.output}")
        
        # 8. 移动文件
        print("\n8️⃣ 移动文件...")
        move_op = FileOperation(
            operation='move',
            path=str(test_dir / 'test_file_copy.md'),
            target_path=str(test_dir / 'new_folder' / 'moved_file.md')
        )
        result = await adapter.process(move_op)
        print(f"   移动结果: {result.output}")
        
        # 9. 检查文件是否存在
        print("\n9️⃣ 检查文件存在性...")
        exists_op = FileOperation(
            operation='exists',
            path=str(test_dir / 'new_folder' / 'moved_file.md')
        )
        result = await adapter.process(exists_op)
        print(f"   文件存在检查: {result.output}")
        
        # 10. 健康检查
        print("\n🔍 适配器健康检查...")
        health = await adapter.health_check()
        print(f"   健康状态: {health.status}")
        print(f"   所有检查: {health.is_healthy}")
        print(f"   性能指标: {json.dumps(health.metrics, indent=2, default=str)}")
        
        # 11. 显示操作统计
        print("\n📊 操作统计...")
        stats = adapter.get_operation_stats()
        print(f"   总操作数: {stats['total_operations']}")
        print(f"   成功操作: {stats['successful_operations']}")
        print(f"   失败操作: {stats['failed_operations']}")
        print(f"   读取字节数: {stats['bytes_read']}")
        print(f"   写入字节数: {stats['bytes_written']}")
        print(f"   创建文件数: {stats['files_created']}")
        print(f"   删除文件数: {stats['files_deleted']}")
        
        # 12. 显示安全配置
        print("\n🔒 安全配置...")
        allowed_paths = adapter.list_allowed_paths()
        forbidden_paths = adapter.list_forbidden_paths()
        print(f"   允许路径: {len(allowed_paths)} 个")
        for path in allowed_paths:
            print(f"   ✅ {path}")
        print(f"   禁止路径: {len(forbidden_paths)} 个")
        for path in forbidden_paths[:3]:  # 只显示前3个
            print(f"   ❌ {path}")
        
        # 13. 路径验证测试
        print("\n🛡️ 安全验证测试...")
        safe_path = str(test_dir / 'safe_file.txt')
        unsafe_path = '/etc/passwd'
        
        is_safe = await adapter.validate_path_access(safe_path, "write")
        print(f"   安全路径 {safe_path}: {'✅ 允许' if is_safe else '❌ 拒绝'}")
        
        is_unsafe = await adapter.validate_path_access(unsafe_path, "read")
        print(f"   不安全路径 {unsafe_path}: {'✅ 允许' if is_unsafe else '❌ 拒绝'}")
        
        print("\n" + "="*60)
        print("🎉 文件系统适配器演示完成!")
        print("="*60)
        
    except Exception as e:
        print(f"❌ 演示过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # 清理适配器资源
        print("\n🧹 清理适配器资源...")
        await adapter.cleanup()
        print("✅ 清理完成")


if __name__ == "__main__":
    # 运行异步主函数
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️ 用户中断演示")
    except Exception as e:
        print(f"❌ 程序错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
