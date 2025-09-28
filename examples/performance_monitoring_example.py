"""
性能监控工具使用示例
===================

演示如何在Zishu-sensei项目中使用性能监控工具
包含装饰器使用、上下文管理器、指标查询等各种用法示例
"""

import asyncio
import time
import random
from pathlib import Path
import sys

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from zishu.adapters.utils.performance import (
    PerformanceMonitor, 
    create_performance_monitor, 
    setup_performance_logging,
    monitor_adapter_function,
    time_function,
    measure_execution_time,
    measure_memory_usage,
    get_system_health
)

def main():
    """主示例函数"""
    print("🚀 Zishu-sensei 性能监控工具示例")
    print("=" * 50)
    
    # 设置性能监控日志
    setup_performance_logging()
    
    # 创建性能监控器
    monitor = create_performance_monitor({
        'collection_interval': 10,  # 10秒收集一次
        'retention_hours': 1        # 保留1小时数据
    })
    
    print("📊 启动性能监控...")
    monitor.start_monitoring()
    
    # 演示1: 使用装饰器监控适配器函数
    print("\n📈 演示1: 适配器性能监控")
    demonstrate_adapter_monitoring(monitor)
    
    # 演示2: 使用上下文管理器
    print("\n⏱️ 演示2: 上下文管理器使用")
    demonstrate_context_managers(monitor)
    
    # 演示3: 异步函数监控
    print("\n🔄 演示3: 异步函数监控")
    asyncio.run(demonstrate_async_monitoring(monitor))
    
    # 等待一些数据收集
    print("\n⏳ 等待数据收集...")
    time.sleep(15)
    
    # 演示4: 查询和报告
    print("\n📊 演示4: 性能数据查询")
    demonstrate_data_queries(monitor)
    
    # 演示5: 导出指标数据
    print("\n💾 演示5: 导出指标数据")
    demonstrate_data_export(monitor)
    
    # 清理资源
    print("\n🧹 清理资源...")
    monitor.cleanup()
    print("✅ 性能监控示例完成！")

def demonstrate_adapter_monitoring(monitor: PerformanceMonitor):
    """演示适配器监控"""
    
    @monitor.monitor_adapter("text_processor", input_type="text", model="mock")
    def text_processing_adapter(text: str) -> str:
        """模拟文本处理适配器"""
        # 模拟处理时间
        processing_time = random.uniform(0.1, 0.5)
        time.sleep(processing_time)
        
        # 模拟偶发错误
        if random.random() < 0.1:  # 10%的错误率
            raise ValueError("模拟处理错误")
        
        return f"已处理: {text[:20]}..." if len(text) > 20 else f"已处理: {text}"
    
    @monitor.monitor_adapter("image_analyzer", input_type="image", model="vision")
    def image_analysis_adapter(image_data: bytes) -> dict:
        """模拟图像分析适配器"""
        # 模拟图像分析时间
        analysis_time = random.uniform(0.2, 1.0)
        time.sleep(analysis_time)
        
        return {
            "objects": random.randint(1, 5),
            "confidence": random.uniform(0.7, 0.95),
            "size": len(image_data)
        }
    
    # 测试文本处理适配器
    print("  测试文本处理适配器...")
    for i in range(8):
        try:
            result = text_processing_adapter(f"这是第{i+1}个测试文本，包含一些内容用于处理")
            print(f"    执行 {i+1}: {result}")
        except Exception as e:
            print(f"    执行 {i+1}: 错误 - {e}")
        time.sleep(0.5)
    
    # 测试图像分析适配器
    print("  测试图像分析适配器...")
    for i in range(5):
        # 模拟图像数据
        mock_image_data = b"mock_image_data" * random.randint(100, 1000)
        result = image_analysis_adapter(mock_image_data)
        print(f"    分析 {i+1}: 检测到{result['objects']}个对象，置信度{result['confidence']:.2f}")
        time.sleep(0.3)

def demonstrate_context_managers(monitor: PerformanceMonitor):
    """演示上下文管理器使用"""
    
    # 测量执行时间
    print("  测量执行时间...")
    with monitor.measure_time("custom_operation.duration", {"operation": "data_processing"}):
        # 模拟数据处理
        time.sleep(random.uniform(0.2, 0.8))
        print("    数据处理完成")
    
    # 测量内存使用
    print("  测量内存使用...")
    with monitor.measure_memory("memory_intensive.usage", {"operation": "large_data_load"}):
        # 模拟内存密集型操作
        large_data = [random.random() for _ in range(100000)]
        processed_data = [x * 2 for x in large_data]
        print(f"    处理了{len(processed_data)}个数据点")
    
    # 全局便捷函数
    print("  使用全局便捷函数...")
    with measure_execution_time("global_operation.duration"):
        time.sleep(0.3)
        print("    全局操作完成")

async def demonstrate_async_monitoring(monitor: PerformanceMonitor):
    """演示异步函数监控"""
    
    @monitor.monitor_adapter("async_web_scraper")
    async def async_web_scraper(url: str) -> dict:
        """模拟异步网页抓取适配器"""
        # 模拟网络延迟
        await asyncio.sleep(random.uniform(0.3, 1.2))
        
        return {
            "url": url,
            "status": 200,
            "content_length": random.randint(1000, 50000),
            "load_time": random.uniform(0.5, 2.0)
        }
    
    @monitor.monitor_adapter("async_ai_inference")
    async def async_ai_inference(prompt: str) -> str:
        """模拟异步AI推理适配器"""
        # 模拟AI推理时间
        await asyncio.sleep(random.uniform(0.5, 2.0))
        
        return f"AI回复: 根据'{prompt[:30]}...'生成的响应"
    
    # 并发测试异步适配器
    print("  并发测试异步适配器...")
    
    # 网页抓取任务
    scraping_tasks = [
        async_web_scraper(f"https://example{i}.com")
        for i in range(5)
    ]
    
    # AI推理任务
    inference_tasks = [
        async_ai_inference(f"这是第{i+1}个AI推理请求")
        for i in range(3)
    ]
    
    # 并发执行所有任务
    all_tasks = scraping_tasks + inference_tasks
    results = await asyncio.gather(*all_tasks, return_exceptions=True)
    
    print(f"    完成了{len(results)}个异步任务")
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"      任务{i+1}: 错误 - {result}")
        else:
            print(f"      任务{i+1}: 成功")

def demonstrate_data_queries(monitor: PerformanceMonitor):
    """演示数据查询功能"""
    
    # 查询系统状态
    print("  系统状态:")
    status = monitor.get_system_status()
    print(f"    CPU使用率: {status['system']['cpu_percent']:.1f}%")
    print(f"    内存使用率: {status['system']['memory_percent']:.1f}%")
    print(f"    活跃执行数: {status['system']['active_executions']}")
    print(f"    监控状态: {'运行中' if status['monitoring_active'] else '已停止'}")
    
    # 查询适配器指标
    adapter_names = ["text_processor", "image_analyzer", "async_web_scraper", "async_ai_inference"]
    
    print("  适配器性能指标:")
    for adapter_name in adapter_names:
        metrics = monitor.get_adapter_metrics(adapter_name, hours=1)
        if metrics.get('total_executions', 0) > 0:
            print(f"    {adapter_name}:")
            
            exec_stats = metrics.get('execution_time', {})
            if exec_stats:
                print(f"      执行时间 - 平均: {exec_stats.get('mean', 0):.3f}s, "
                      f"最大: {exec_stats.get('max', 0):.3f}s, "
                      f"P95: {exec_stats.get('p95', 0):.3f}s")
            
            memory_stats = metrics.get('memory_usage', {})
            if memory_stats:
                print(f"      内存使用 - 平均: {memory_stats.get('mean', 0):.2f}MB, "
                      f"最大: {memory_stats.get('max', 0):.2f}MB")
            
            print(f"      成功率: {metrics.get('success_rate', 0):.1f}%")
            print(f"      总执行次数: {metrics.get('total_executions', 0)}")
            print(f"      失败次数: {metrics.get('failed_executions', 0)}")
        else:
            print(f"    {adapter_name}: 暂无数据")
    
    # 查询收集器中的所有指标
    print("  指标概览:")
    all_metrics = monitor.collector.get_all_metric_names()
    system_metrics = [m for m in all_metrics if m.startswith('system.')]
    adapter_metrics = [m for m in all_metrics if m.startswith('adapter.')]
    custom_metrics = [m for m in all_metrics if not m.startswith(('system.', 'adapter.'))]
    
    print(f"    系统指标: {len(system_metrics)}个")
    print(f"    适配器指标: {len(adapter_metrics)}个") 
    print(f"    自定义指标: {len(custom_metrics)}个")
    print(f"    总指标数: {len(all_metrics)}个")

def demonstrate_data_export(monitor: PerformanceMonitor):
    """演示数据导出功能"""
    
    # 导出到JSON字符串
    print("  导出指标数据到JSON...")
    json_data = monitor.export_metrics(format='json')
    print(f"    JSON数据大小: {len(json_data)} 字符")
    
    # 导出到文件
    export_file = Path("performance_metrics_export.json")
    monitor.export_metrics(format='json', file_path=str(export_file))
    
    if export_file.exists():
        file_size = export_file.stat().st_size
        print(f"    已导出到文件: {export_file} ({file_size} 字节)")
        
        # 清理导出文件
        export_file.unlink()
        print(f"    已清理导出文件")
    
    print("    数据导出完成")

# 全局装饰器示例
@monitor_adapter_function("global_decorated_function")
def global_example_function(data: str) -> str:
    """使用全局装饰器的示例函数"""
    time.sleep(random.uniform(0.1, 0.3))
    return f"全局处理: {data}"

@time_function("global_timer_example")
def timed_function():
    """使用全局计时装饰器的示例函数"""
    time.sleep(0.2)
    return "计时完成"

if __name__ == "__main__":
    # 运行主示例
    main()
    
    print("\n🎯 额外示例: 全局装饰器使用")
    
    # 测试全局装饰器
    for i in range(3):
        result = global_example_function(f"数据{i+1}")
        print(f"  {result}")
    
    # 测试计时装饰器
    for i in range(3):
        result = timed_function()
        print(f"  {result}")
    
    # 获取系统健康状态
    health = get_system_health()
    print(f"\n💚 系统健康状态:")
    print(f"  CPU: {health['system']['cpu_percent']:.1f}%")
    print(f"  内存: {health['system']['memory_percent']:.1f}%")
    
    print("\n🎉 所有示例运行完成！")
