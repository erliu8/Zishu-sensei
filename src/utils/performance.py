#! /usr/bin/env python3
# -*- coding: utf-8 -*-
#src/utils/performance.py

import time
import logging
import threading
import psutil
import gc
import os
from typing import Dict,Any,Optional,List,Callable,Tuple

class PerformanceMonitor:
    """性能监控类,用于监控系统资源使用情况和模型响应时间"""
    def __init__(self,interval:int=60,callback:Optional[Callable]=None):
        """
        初始化性能监控器
        
        Args:
            interval (int): 监控间隔时间/秒,默认60秒
            callback (Optional[Callable]): 回调函数,用于处理监控数据,默认None
        """
        self.interval = interval
        self.callback = callback
        self.running = False
        self.thread = None
        self.logger = logging.getLogger(__name__)
        self.metrics:Dict[str,Any] = {
            "cpu":[],
            "memory":[],
            "gpu":[],
            "response_time":[]
        }
        self.max_history = 60 #保存最近60个数据点
        
    def start(self):
        """启动性能监控"""
        if self.running:
            self.logger.warning("性能监控器已运行,无需重复启动")
            return
        
        self.running = True
        self.thread = threading.Thread(
            target = self._monitor_thread,
            daemon = True
        )
        self.thread.start()
        self.logger.info(f"性能监控器启动成功,监控间隔: {self.interval}秒")
        
    def stop(self):
        """停止性能监控"""
        if not self.running:
            self.logger.warning("性能监控器未运行,无需停止")
            return
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
            self.thread = None
        self.logger.info("性能监控器已停止")
        
    def _monitor_thread(self):
        """监控线程,用于收集和处理性能数据"""
        while self.running:
            try:
                metrics = self._collect_metrics()
                
                #更新指标历史
                for key,value in metrics.items():
                    if key in self.metrics:
                        self.metrics[key].append(value)
                        #限制历史长度
                        if len(self.metrics[key]) > self.max_history:
                            self.metrics[key].pop(0)
                            
                #执行回调函数
                if self.callback:
                    self.callback(metrics)
            except Exception as e:
                self.logger.error(f"性能监控线程发生错误: {e}")
                
            time.sleep(self.interval)
            
    def collect_system_metrics(self)->Dict[str,Any]:
        """收集系统性能指标"""
        metrics = {}
        
        #CPU使用率
        metrics["cpu"] = {
            "percent": psutil.cpu_percent(interval=1),
            "counts": psutil.cpu_count(),
            "load_avg":psutil.getloadavg() if hasattr(psutil,"getloadavg") else None
        }
        
        #内存使用情况
        mem = psutil.virtual_memory()
        metrics["memory"] = {
            "total":mem.total,
            "available":mem.available,
            "used":mem.used,
            "percent":mem.percent
        }
        
        #磁盘使用情况
        disk = psutil.disk_usage(os.getcwd())
        metrics["disk"] = {
            "total":disk.total,
            "used":disk.used,
            "percent":disk.percent,
            "free":disk.free,
        }
        
        #GPU指标(如果有CUDA)
        try:
            import torch
            if torch.cuda.is_available():
                metrics["gpu"] = []
                for i in range(torch.cuda.device_count()):
                    metrics["gpu"].append({
                        "name":torch.cuda.get_device_name(i),
                        "memory_allocated":torch.cuda.memory_allocated(i),
                        "memory_reserved":torch.cuda.memory_reserved(i),
                        "utilization":torch.cuda.utilization(i) if hasattr(torch.cuda,"utilization") else None
                    })
        except (ImportError,Exception) as e:
            metrics["gpu"] = {"error":str(e)}
            
        return metrics
    
    def record_response_time(self,module:str,operation:str,duration:float):
        """
        记录模块操作的响应时间
        
        Args:
            module (str): 模块名称
            operation (str): 操作名称
            duration (float): 响应时间/秒
        """
        record = {
            "timestamp":time.time(),
            "module":module,
            "operation":operation,
            "duration":duration
        }
        self.metrics["response_time"].append(record)
        if len(self.metrics["response_time"]) > self.max_history:
            self.metrics["response_time"].pop(0)
        
    def get_metrics(self)->Dict[str,Any]:
        """获取性能监控数据"""
        return self.metrics
    
    def get_summary(self)->Dict[str,Any]:
        """获取性能监控摘要"""
        summary = {}
        
        #CPU平均使用率
        if self.metrics["cpu"]:
            cpu_percents = [m["percent"] for m in self.metrics["cpu"]]
            summary["cpu_avg_percent"] = sum(cpu_percents) / len(cpu_percents)
            summary["cpu_max_percent"] = max(cpu_percents)
        
        #内存平均使用率
        if self.metrics["memory"]:
            mem_percents = [m["percent"] for m in self.metrics["memory"]]
            summary["mem_avg_percent"] = sum(mem_percents) / len(mem_percents)
            summary["mem_max_percent"] = max(mem_percents)
            
        #响应时间统计
        if self.metrics["response_time"]:
            durations = [m["duration"] for m in self.metrics["response_time"]]
            summary["response_time_avg"] = sum(durations) / len(durations)
            summary["response_time_max"] = max(durations)
            summary["response_time_min"] = min(durations)
            
            #按模块统计
            by_module = {}
            for r in self.metrics["response_time"]:
                module = r["module"]
                if module not in by_module:
                    by_module[module] = []
                by_module[module].append(r["duration"])
                
            summary["response_time_by_module"] = {
                moudle:sum(times) / len(times)
                for moudle,times in by_module.items()
            }
            
        #GPU使用情况
        if self.metrics["gpu"]:
            gpu_metrics = self.metrics["gpu"]
            summary["gpu_count"] = len(gpu_metrics)
            
            #按GPU统计
            by_gpu = {}
            for g in gpu_metrics:
                name = g["name"]
                if name not in by_gpu:
                    by_gpu[name] = []
                by_gpu[name].append(g["utilization"])
            summary["gpu_usage_by_device"] = {
                name:sum(usages) / len(usages)
                for name,usages in by_gpu.items()
            }

        return summary
    def trigger_gc(self):
        """手动触发垃圾回收"""
        before = len(gc.get_objects())
        collected = gc.collect()
        after = len(gc.get_objects())
        
        self.logger.info(f"手动垃圾回收: 回收{collected}个对象,释放{before-after}个对象")
        return {"collected":collected,"before":before,"after":after}

#全局性能监控器实例
_performance_monitor = None

def get_performance_monitor()->PerformanceMonitor:
    """获取性能监控器实例"""
    global _performance_monitor
    if _performance_monitor is None:
        _performance_monitor = PerformanceMonitor()
    return _performance_monitor

def with_timing(module:str,operation:str=None):
    """
    装饰器,用于记录函数执行时间
    
    Args:
        module (str): 模块名称
        operation (str): 操作名称,默认None
        
    Returns:
        Any: 函数返回值
        
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args,**kwargs):
            start_time = time.time()
            result = func(*args,**kwargs)
            duration = time.time() - start_time
            
            #记录响应时间
            op_name = operation or func.__name__
            monitor = get_performance_monitor()
            monitor.record_response_time(module,op_name,duration)
            
            return result
        return wrapper
    return decorator
        
            
            
        
        

