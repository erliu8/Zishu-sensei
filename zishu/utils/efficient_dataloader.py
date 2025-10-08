#! /usr/bin/env python
# -*- coding: utf-8 -*-

import torch
from torch.utils.data import Dataset, DataLoader
from typing import List, Dict, Any, Optional, Union, Tuple, Callable
from pathlib import Path
import queue
from ..utils.thread_factory import get_thread_factory


class AsynPrefetchDataLoader:
    """
    异步预加载数据加载器
    """

    def __init__(self, dataloader, prefetch_factor=3, pin_memory=True):
        """
        初始化异步预加载数据加载器
        Args:
            dataloader: 基础数据加载器
            prefetch_factor: 预取批次的倍率，越高约占内存但减少等待
            pin_memory: 是否将张量固定再内存中，加速GPU传输
        """
        self.dataloader = dataloader
        self.prefetch_factor = prefetch_factor
        self.pin_memory = pin_memory

        # 创建队列
        self.queue = queue.Queue(maxsize=prefetch_factor)
        self.thread_factory = get_thread_factory()
        self.task_ids = []
        self.iter_dataloader = None
        self.done = False

    def __len__(self):
        return len(self.dataloader)

    def _prefetch_worker(self):
        """预取工作函数"""
        try:
            # 获取下一个批次
            batch = next(self.iter_dataloader)

            # 如果需要，固定内存
            if self.pin_memory:
                batch = self._pin_memory(batch)

            # 放入队列
            self.queue.put(batch)
            return True
        except StopIteration:
            self.done = True
            return False
        except Exception as e:
            print(f"预取工作异常: {e}")
            self.done = True
            return False

    def _pin_batch(self, batch):
        """对批次中所有张量就行内存固定"""
        if isinstance(batch, torch.Tensor):
            return batch.pin_memory()
        elif isinstance(batch, dict):
            return {k: self._pin_batch(v) for k, v in batch.items()}
        elif isinstance(batch, list):
            return [self._pin_batch(item) for item in batch]
        else:
            return batch

    def _submit_prefetch_task(self):
        """提交预取任务到线程池"""
        # 先清理旧任务
        self.task_ids = []

        # 提交新的预取任务
        for _ in range(self.prefetch_factor):
            if self.done:
                break
            task_id = self.thread_factory.submit(self._prefetch_worker)
            self.task_ids.append(task_id)

    def __iter__(self):
        """初始化数据加载器迭代器"""
        self.iter_dataloader = iter(self.dataloader)
        self.done = False

        # 提交初始预取任务
        self._submit_prefetch_task()

        # 返回批次知道队列为空且所有任务完成
        try:
            while not self.done or not self.queue.empty():
                try:
                    # 获取下一个批次
                    batch = self.queue.get(timeout=60)  # 最多等待60秒

                    # 提交新的预取任务
                    if not self.done:
                        task_id = self.thread_factory.submit(self._prefetch_worker)
                        self.task_ids.append(task_id)

                    yield batch

                except queue.Empty:
                    # 队列为空，检查是否所有任务完成
                    if self.done:
                        break
        except KeyboardInterrupt:
            self.done = True

        finally:
            # 取消所有未完成的任务
            for task_id in self.task_ids:
                self.thread_factory.cancel_task(task_id)
                self.task_ids = []


def create_efficient_dataloader(
    dataset: Dataset,
    batch_size: int = 8,
    shuffle: bool = True,
    num_workers: int = 4,
    pin_memory: bool = True,
    prefetch_factor: int = 2,
    persistent_workers: bool = True,
    collate_fn: Optional[Callable] = None,
    use_async_prefetch: bool = True,
) -> Union[DataLoader, AsynPrefetchDataLoader]:
    """
    创建高效数据加载器
    Args:
        dataset: 数据集
        batch_size: 批次大小
        shuffle: 是否打乱数据
        num_workers: 工作线程数
        pin_memory: 是否将张量固定再内存中
        prefetch_factor: 预取批次的倍率
        persistent_workers: 是否持久化工作线程
        collate_fn: 数据整理函数
        use_async_prefetch: 是否使用异步预取
    Returns:
        Union[DataLoader,AsynPrefetchDataLoader]: 高效数据加载器
    """
    # 创建基础数据加载器
    dataloader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=pin_memory,
        prefetch_factor=prefetch_factor if num_workers > 0 else None,
        persistent_workers=persistent_workers if num_workers > 0 else False,
        collate_fn=collate_fn,
    )

    # 如果启用异步预取，包装数据加载器
    if use_async_prefetch:
        return AsynPrefetchDataLoader(
            dataloader, prefetch_factor=prefetch_factor, pin_memory=pin_memory
        )
    else:
        return dataloader
