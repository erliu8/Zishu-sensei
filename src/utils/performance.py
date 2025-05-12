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
        
    
        
        
        
        

