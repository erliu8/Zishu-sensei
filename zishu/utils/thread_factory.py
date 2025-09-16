#! /usr/bin/env python3
# -*- coding: utf-8 -*-

import threading
import queue
import uuid
import time
import logging
from typing import Any,Callable,Dict,List,Optional,Tuple,Union
from concurrent.futures import ThreadPoolExecutor,Future


class ThreadTask:
    """线程任务封装类"""
    def __init__(self,func:Callable,*args,**kwargs):
        self.id = str(uuid.uuid4())
        self.func = func
        self.args = args
        self.kwargs = kwargs
        self.result = None
        self.error = None
        self.start_time = None
        self.end_time = None
        self.status = "created" #任务状态：created,running,finished,failed,cancelled
        
    def execute(self):
        """执行任务"""
        self.start_time = time.time()
        self.status = "running"
        try:
            self.result = self.func(*self.args,**self.kwargs)
            self.status = "completed"
        except Exception as e:
            self.error = str(e)
            self.status = "failed"
            raise e
        finally:
            self.end_time = time.time()
        return self.result
    
    @property
    def execution_time(self)->float:
        """获取任务执行时间/秒"""
        if self.end_time is None:
            return 0
        end = self.end_time if self.end_time is not None else time.time()
        return self.end_time - self.start_time
    
class ThreadFactory:
    """线程工厂类,负责创建和管理线程""" 
    def __init__(self,max_workers:int=10,thread_name_prefix:str="zishuworker"):
        self.logger = logging.getLogger(__name__)
        self.executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix=thread_name_prefix
        )
        self.tasks:Dict[str,Tuple[ThreadTask,Future]] = {}
        self.lock = threading.RLock()
        self.logger.info(f"线程工厂初始化成功,最大线程数: {max_workers},线程名前缀: {thread_name_prefix}")
        
    def submit_task(self,func:Callable,*args,**kwargs)->str:
        """
        提交任务到线程池
        
        Args:
            func: 可调用对象
            *args: 可调用对象参数
            **kwargs: 可调用对象关键字参数
            
        Returns:
            str: 任务id
        """
        task = ThreadTask(func,*args,**kwargs)
        with self.lock:
            future = self.executor.submit(task.execute)
            self.tasks[task.id] = (task,future)
        
        self.logger.info(f"任务提交成功,任务id: {task.id},任务状态: {task.status}")
        return task.id
    
    def get_task_status(self,task_id:str)->Optional[Dict[str,Any]]:
        """
        获取任务状态

        Args:
            task_id (str): 任务id

        Returns:
            任务状态信息或None(如果任务不存在)
        """
        with self.lock:
            if task_id not in self.tasks:
                return None
            task,future = self.tasks[task_id]
            return {
                "id":task.id,
                "status":task.status,
                "execution_time":task.execution_time,
                "done":future.done(),
                "running":future.running() if hasattr(future,"running") else False,
                "cancelled":future.cancelled()
            }
    
    def get_task_result(self,task_id:str,timeout:Optional[float]=None)->Any:
        """获取任务结果
        
        Args:
            task_id (str): 任务id
            timeout (Optional[float]): 超时时间/秒,默认None(阻塞等待)

        Returns:
            任务结果或None(如果任务未完成或超时)
            
        Raises:
            ValueError: 如果任务不存在
            TimeoutError: 如果任务超时
            Exception: 其他异常
        """
        with self.lock:
            if task_id not in self.tasks:
                raise ValueError(f"任务不存在,任务id: {task_id}")
            task,future = self.tasks[task_id]
         
        try:   
            if timeout is not None:
                result = future.result(timeout=timeout)
            else:
                result = future.result()
            return task.result
        except Exception as e:
            if task.error:
                raise Exception(task.error)
            raise e
    
    def cancel_task(self,task_id:str)->bool:
        """
        取消任务
        
        Args:
            task_id (str): 任务id

        Returns:
            bool: 是否取消成功
        """
        with self.lock:
            if task_id not in self.tasks:
                return False
            
            _,future = self.tasks[task_id] 
            
            return future.cancel()
        
    def get_running_tasks(self)->List[str]:
        """获取正在运行的任务id列表"""
        running_tasks = []
        
        with self.lock:
            for task_id,(task,future) in self.tasks.items():
                if task.status == "running" or (hasattr(future,"running") and future.running()):
                    running_tasks.append(task_id)
        return running_tasks
        
    def cleanup_completed_tasks(self,max_age:float=3600)->int:
        """清理已完成任务
        
        Args:
            max_age (float): 最大任务年龄/秒,默认3600秒(1小时)
            
        Returns:
            int: 清理的任务数量
        """
        now = time.time()
        to_remove = []
        
        with self.lock:
            for task_id,(task,future) in self.tasks.items():
                if(task.status in ["completed","failed","cancelled"] 
                   and task.end_time and (now - task.end_time) > max_age):
                    to_remove.append(task_id)
            
            for task_id in to_remove:
                del self.tasks[task_id]
        
        if to_remove:
            self.logger.info(f"清理已完成任务,任务id: {','.join(to_remove)},清理数量: {len(to_remove)}")
        
        return len(to_remove)
    def shutdown(self,wait:bool=True):
        """
        关闭线程池
        
        Args:
            wait (bool): 是否等待所有任务完成,默认True
        """
        self.logger.info(f"关闭线程池,等待任务完成: {wait}")
        self.executor.shutdown(wait=wait)
        self.logger.info("线程池已关闭")
    
    def __enter__(self):
        return self
    
    def __exit__(self,exc_type,exc_value,exc_tb):
        self.shutdown()

#创建全局线程工厂实例    
_thread_factory = None

def get_thread_factory()->ThreadFactory:
    """获取全局线程工厂实例"""
    global _thread_factory
    if _thread_factory is None:
        _thread_factory = ThreadFactory()
    return _thread_factory

def shutdown_thread_factory(wait:bool=True):
    """关闭全局线程工厂实例"""
    global _thread_factory
    if _thread_factory:
        _thread_factory.shutdown(wait=wait)
        _thread_factory = None
    
            
