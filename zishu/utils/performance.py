#! /usr/bin/env python3
# -*- coding: utf-8 -*-
#src/utils/performance.py

import time
import logging
import torch
import threading
import psutil
import gc
import os
from functools import wraps
from typing import Dict,Any,Optional,List,Callable,Tuple

logger = logging.getLogger(__name__)

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
    
    def get_gpu_metrics(self)->Dict[str,Any]:
        """获取GPU性能监控数据"""
        try:
            import torch
            if torch.cuda.is_available():
                return{"error":"cuda未启用"}
            metrics = []
            for i in range(torch.cuda.device_count()):
                metrics.append({
                    "name":torch.cuda.get_device_name(i),
                    "memory_allocated":torch.cuda.memory_allocated(i),
                    "memory_reserved":torch.cuda.memory_reserved(i),
                    "memory_cached":torch.cuda.memory_cached(i),
                    "utilization":torch.cuda.utilization(i) if hasattr(torch.cuda,"utilization") else None,
                    "temperature":torch.cuda.temperature(i) if hasattr(torch.cuda,"temperature") else None,
                    "power_usage":torch.cuda.power_usage(i) if hasattr(torch.cuda,"power_usage") else None
                })
            return metrics
        except (ImportError,Exception) as e:
            return {"error":str(e)}
    
    def record_model_metrics(self,
                             batch_size:int,
                             inference_time:float,
                             sequence_length:int,
                             memory_usage:int,
                             ):
        """记录模型性能指标"""
        record = {
            "timestamp":time.time(),
            "batch_size":batch_size,
            "inference_time":inference_time,
            "sequence_length":sequence_length,
            "memory_usage":memory_usage,
            "tokens_per_second":(batch_size*sequence_length)/inference_time if inference_time > 0 else 0
        }
        if "model_metrics" not in self.metrics:
            self.metrics["model_metrics"] = []
        self.metrics["model_metrics"].append(record)

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
    def benchmark_attention_performance(model, seq_length=512, batch_size=4, num_runs=10):
        """
        测试模型注意力机制的性能
        
        Args:
            model: 要测试的模型
            seq_length: 序列长度
            batch_size: 批量大小
            num_runs: 运行次数
        
        Returns:
            dict: 性能测试结果
        """
        if not torch.cuda.is_available():
            logger.warning("无GPU可用，无法进行性能测试") 
            return {"error": "No GPU available"}
        
        model.eval()

        try:
            # 生成随机输入数据
            vocab_size = model.config.vocab_size
            input_ids = torch.randint(0, vocab_size, (batch_size, seq_length)).cuda()
            attention_mask = torch.ones_like(input_ids).cuda()
            
            # 预热
            for _ in range(3):
                with torch.no_grad():
                    _ = model(input_ids, attention_mask=attention_mask)
            
            # 清空CUDA缓存
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
            
            # 测量推理时间
            start_event = torch.cuda.Event(enable_timing=True)
            end_event = torch.cuda.Event(enable_timing=True)
            
            durations = []
            memory_usage = []
            
            for _ in range(num_runs):
                # 记录起始内存
                start_mem = torch.cuda.memory_allocated()
                
                start_event.record()
                with torch.no_grad():
                    _ = model(input_ids, attention_mask=attention_mask)
                end_event.record()
                
                # 等待CUDA操作完成
                torch.cuda.synchronize()
                
                # 计算内存使用和时间
                end_mem = torch.cuda.memory_allocated()
                memory_usage.append(end_mem - start_mem)
                durations.append(start_event.elapsed_time(end_event))
            
            # 计算和记录结果
            avg_time = sum(durations) / len(durations)
            avg_memory = sum(memory_usage) / len(memory_usage) / (1024 * 1024)  # MB
            tokens_per_sec = batch_size * seq_length * 1000 / avg_time
            
            # 检查是否使用了SDPA
            sdpa_used = False
            for name, module in model.named_modules():
                if hasattr(module, "attn_implementation"):
                    if module.attn_implementation == "sdpa":
                        sdpa_used = True
                        break
            
            results = {
                "avg_time_ms": avg_time,
                "tokens_per_second": tokens_per_sec,
                "avg_memory_mb": avg_memory,
                "batch_size": batch_size,
                "seq_length": seq_length,
                "sdpa_used": sdpa_used
            }
            
            logger.info(f"注意力性能测试结果: {results}")
            return results
            
        except Exception as e:
            logger.error(f"性能测试出错: {e}")
            return {"error": str(e)}
    
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
        
            
            
        
        

