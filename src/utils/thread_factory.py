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
        
        
        
