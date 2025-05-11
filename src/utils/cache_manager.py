#! /usr/bin/env python3
#src/utils/cache_manager.py

import time
import threading
import logging
from typing import Dict,Any,Optional,List,Tuple


class CacheManager:
    """LRU缓存管理器,用于缓存常用响应和减少模型调用"""
    def __init__(self,max_size:int=1000,ttl:int=3600):
        """
        初始化缓存管理器
        
        Args:
            max_size (int): 最大缓存大小,默认1000
            ttl (int): 缓存项过期时间/秒,默认3600秒(1小时)
        """
        self.cache = {}
        self.access_times = {}
        self.max_size = max_size
        self.ttl = ttl
        self.lock = threading.RLock()
        self.logger = logging.getLogger(__name__)
        
    def get(self,key,default=None):
        """获取缓存值
        
        Args:
            key: 缓存键
            default: 默认返回值,如果键不存在
        """
        with self.lock:
            if key not in self.cache:
                return default
            
            #检查缓存是否过期
            if time.time() - self.access_times[key]["created"] > self.ttl:
                self.logger.debug(f"缓存项过期,删除键: {key}")
                self._remove_item(key)
                return default
            
            #更新访问时间
            self.access_times[key]["last_access"] = time.time()
            return self.cache[key]["value"]
        
    def set(self,key,value):
        """设置缓存值
        
        Args:
            key: 缓存键
            value: 缓存值
        """
        with self.lock:
            #如果缓存已满,删除最久未使用的项
            if len(self.cache) >= self.max_size and key not in self.cache:
                self._evict_old_items()
                
            now = time.time()
            self.cache[key] = value
            self.access_times[key] = {
                "created":now,
                "last_access":now
            }
            self.logger.debug(f"缓存更新,键: {key},值: {value}")
    
    def _evict_oldest(self):
        """删除最久未使用的缓存项"""
        oldest_key = None
        oldest_time = float("inf")
        
        for key,times in self.access_times.items():
            if times["last_access"] < oldest_time:
                oldest_time = times["last_access"]
                oldest_key = key
                
        if oldest_key:
            self.logger.debug(f"删除最久未使用的缓存项,键: {oldest_key}")
            self._remove_item(oldest_key)
    
    def _remove_item(self,key):
        """删除指定缓存项"""
        if key in self.cache:
            del self.cache[key]

        if key in self.access_times:
            del self.access_times[key]
            
    def clear(self):
        """清空缓存"""
        with self.lock:
            self.cache.clear()
            self.access_times.clear()
            self.logger.debug("缓存已清空")
    
    def stats(self):
        """获取缓存统计信息"""
        with self.lock:
            return {
                "size":len(self.cache),
                "max_size":self.max_size,
                "ttl":self.ttl
            }
            
        
            
   
        


