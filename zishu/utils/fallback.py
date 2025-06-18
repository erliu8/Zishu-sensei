#! /usr/bin/env python3
#src/utils/fallback.py

import logging
import time
from functools import wraps
from typing import Callable,Any,Optional,Dict,Tuple,List

class CircuitBreaker:
    """断路器模式,用于限制错误请求次数,保护系统免受故障服务的影响"""
    def __init__(self,failure_threshold=5,recovery_timeout=30,fallback_function=None):
        """
        Args:
            failure_threshold (int): 错误请求阈值,超过该值后断路器打开
            recovery_timeout (int): 断路器恢复时间/秒
            fallback_func (Callable): 故障时的回退函数,默认为None
        """
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.last_failure_time = 0
        self.is_open = False
        self.fallback_function = fallback_function
        self.logger = logging.getLogger(__name__)
        
    def __call__(self,func):
        """装饰器,用于包装被调用函数,实现断路器功能"""
        @wraps(func)
        def wrapper(*args,**kwargs):
            """包装函数,用于捕获异常并处理"""
            if self.is_open:
                #检查断路器是否恢复
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.logger.info("断路器尝试半开状态：{func.__name__}")
                    self.is_open = False
                    self.failure_count = 0
                else:
                    #断路器打开,执行回退函数
                    self.logger.warning(f"断路器打开,执行回退函数: {self.fallback_function.__name__}")
                    if self.fallback_function:
                        return self.fallback_function(*args,**kwargs)
                    raise RuntimeError(f"服务暂时不可用: {func.__name__}")
            
            try:
                #执行被包装函数
                result = func(*args,**kwargs)
                #如果执行成功,重置断路器
                self.failure_count = 0
                return result
            except Exception as e:
                #捕获异常,增加失败计数
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.failure_count >= self.failure_threshold:
                    self.logger.error(f"服务调用失败次数超过阈值,断路器打开: {func.__name__}")
                    self.is_open = True
                
                if self.fallback_function:
                    self.logger.warning(f"执行降级函数: {func.__name__}")
                    return self.fallback_function(*args,**kwargs)
                raise 
            
        return wrapper

class FallbackChain:
    """降级链,用于处理多个降级策略,依次尝试执行,直到成功"""
    def __init__(self,functions:List[Callable],logger=None):
        """
        Args:
            fallback_functions (List[Callable]): 降级函数列表
            logger (logging.Logger): 日志记录器,默认为None
        """
        self.functions = functions
        self.logger = logger or logging.getLogger(__name__)
        
    def execute(self, *args, **kwargs):
        """执行降级链,依次尝试执行降级函数,直到成功"""
        last_exception = None
        
        for i,func in enumerate(self.functions):
            try:
                return func(*args,**kwargs)
            except Exception as e:
                last_exception = e
                self.logger.warning(f"执行降级函数{i}失败: {str(e)}")
        if last_exception:
            raise last_exception
    
    def __call__(self,func):
        """
        装饰器,用于包装被调用函数,实现降级链功能,将原始函数作为首选方案，降级函数作为备选
        
        Args:
            func (Callable): 被包装的函数
            
        Returns:
            Callable: 包装后的函数
        """
        @wraps(func)
        def wrapper(*args,**kwargs):
            try:
                #首先尝试原始函数
                return func(*args,**kwargs)
            except Exception as e:
                self.logger.warning(f"原始函数{func.__name__}执行失败: {str(e)},尝试降级函数")

                #尝试执行降级函数
                for i,fallback_func in enumerate(self.functions):
                    try:
                        self.logger.info(f"尝试执行降级函数{i}: {fallback_func.__name__}")
                        return fallback_func(*args,**kwargs)
                    except Exception as e:
                        self.logger.warning(f"降级函数{i}执行失败: {str(e)},继续尝试下一个")
                        
                #如果所有降级函数都执行失败,抛出原始异常
                self.logger.error(f"所有降级函数执行失败,抛出原始异常: {str(e)}")
                raise e
        return wrapper

    def execute(self,*args,**kwargs):
        last_error = None
        
        for i,func in enumerate(self.functions):
            try:
                return func(*args,**kwargs)
            except Exception as e:
                last_error = e
                self.logger.warning(f"执行降级函数{i}失败: {str(e)}")
        if last_error:
            raise last_error
        
                
                
                
                
                
                
