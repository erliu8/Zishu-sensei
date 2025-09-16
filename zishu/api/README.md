"""
'dependencies.py'使用示例:

1. 基本用法:
    from zishu.dependencies import get_dependencies, get_logger, get_config_manager, submit_task
    
    # 获取服务
    logger = get_logger()
    config = get_config_manager()
    
    # 提交异步任务
    task_id = submit_task(my_function, param1, param2)
    result = get_task_result(task_id)
    
2. 线程工厂上下文管理器:
    with ThreadFactoryContext(max_workers=20) as thread_factory:
        task_id = thread_factory.submit_task(long_running_task)
        # 任务会在上下文退出时自动清理
        
3. 装饰器注入 (包含线程工厂):
    @inject_dependencies(
        logger=get_logger, 
        config=get_config_manager,
        thread_factory=get_thread_factory_from_deps
    )
    def my_function(logger, config, thread_factory, user_param):
        logger.info("Processing...")
        task_id = thread_factory.submit_task(background_work, user_param)
        
4. 自定义线程工厂配置:
    deps = get_dependencies()
    deps.register_thread_factory_config(max_workers=50, thread_name_prefix="custom")
    
扩展指南:

1. 添加新的核心服务:
   - 在 _setup_core_dependencies 中添加注册逻辑
   - 添加对应的 get_xxx 便捷函数
   - 添加 @lru_cache 装饰器优化性能
   
2. 线程工厂扩展:
   - 支持自定义工厂配置
   - 提供便捷的任务管理函数
   - 支持上下文管理器自动清理
   
3. 实现服务生命周期:
   - 让服务类继承 ServiceLifecycle
   - 实现 initialize 和 cleanup 方法
   - 线程工厂会自动调用 shutdown 进行清理
"""

