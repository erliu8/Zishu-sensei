#! /usr/bin/env python3
# src/utils/memory_map_dataset.py

import os
import torch
import numpy as np
from typing import Dict, List, Tuple, Any, Optional, Union
from torch.utils.data import Dataset
from pathlib import Path
import mmap
import json

class MemoryMappedDataset(Dataset):
    "内存映射数据集，通过内存映射减少数据加载开销"
    
    def __init__(self,data_path:Union[str,Path],dtype=np.int32,
                 transform=None,shape_per_sample=None):
        """
        初始化内存映射数据集

        Args:
            data_path (Union[str,Path]): 数据文件路径，应为二进制文件
            detype (_type_, optional):数据类型，默认为np.int32.
            transform (_type_, optional): 转换函数，对数据就行处理
            shape_per_sample (_type_, optional): 每个样本的形状，应该是一个元组
        """     
        self.data_path = Path(data_path)
        if not self.data_path.exists():
            raise FileNotFoundError(f"数据文件不存在：{self.data_path}")
        
        self.dtype = dtype
        self.transform = transform
        self.shape_per_sample = shape_per_sample
        
        #计算每个样本的字节数和总样本数
        self.itemsize = np.dtype(self.dtype).itemsize
        if shape_per_sample:
            self.sample_size = self.itemsize * np.prod(shape_per_sample)
        else:
            #从index文件中获取样本大小信息
            idx_path = self.data_path.with_suffix('.idx')
            if idx_path.exists():
                self._load_index(idx_path)
            else:
                raise ValueError("必须提供shape_per_sample或存在index文件")
        
        self.file_size = os.path.getsize(self.data_path)
        self.num_samples = self.file_size // self.sample_size
        
        #创建内存映射
        self.mm_file = open(self.data_path,'rb')
        self.mm = mmap.mmap(self.mm_file.fileno(), 0, access=mmap.ACCESS_READ)
        
    def _load_index(self,idx_path:Path):
        """
        从index文件中加载样本大小信息
        
        Args:
            idx_path (Path): index文件路径
        """
        with open(idx_path,'r') as f:
            index_data = json.load(f)
            self.shape_per_sample = tuple(index_data['shape'])
            self.sample_size = self.itemsize * np.prod(self.shape_per_sample)
            
    def __len__(self):
        return self.num_samples
    
    def __getitem__(self,idx:int):
        """获取指定索引的样本"""
        if idx >= self.num_samples:
            raise IndexError(f"索引超出范围：{idx}，总样本数为{self.num_samples}")
        
        #计算偏移量
        offset = idx * self.sample_size
        
        #从内存映射中读取数据
        self.mm.seek(offset)
        data_bytes = self.mm.read(self.sample_size)
        
        #将字节转换为numpy数组，再转换为tensor
        data_np = np.frombuffer(data_bytes,dtype=self.dtype)
        data_np = data_np.reshape(self.shape_per_sample)
        data_tensor = torch.from_numpy(data_np).contiguous()
        
        #应用变换(如果有)
        if self.transform:
            data_tensor = self.transform(data_tensor)
            
        return data_tensor
    
    def __del__(self):
        """
        释放内存映射
        """
        if hasattr(self,'mm') and self.mm:
            self.mm.close()
        if hasattr(self,'mm_file') and self.mm_file:
            self.mm_file.close()

class TokenizedMemoryMappedDataset(MemoryMappedDataset):
    """
    专用于已分词数据的内存映射数据集
    """
    
    def __init__(self,data_path:Union[str,Path],
                index_path:Optional[Union[str,Path]]=None,
                dtype=np.int32):
        """
        初始化已分词的内存映射数据集
        
        Args:
            data_path: 分词数据的二进制文件路径
            index_path: 索引文件路径，存储每个样本的位置和长度信息
            dtype: 数据类型，默认为np.int32(适用于大多数分词ID)
        """   
        self.data_path = Path(data_path)
        self.index_path = Path(index_path) if index_path else self.data_path.with_suffix('.idx')
        self.dtype = dtype
        
        if not self.data_path.exists():
            raise FileNotFoundError(f"数据文件不存在：{self.data_path}")
        
        if not self.index_path.exists():
            raise FileNotFoundError(f"索引文件不存在：{self.index_path}")
        
        #从index文件中加载样本大小信息
        with open(self.index_path,'r') as f:
            self.index = json.load(f)
            
        self.num_samples = len(self.index['samples'])
        
        #创建内存映射
        self.mm_file = open(self.data_path,'rb')
        self.mm = mmap.mmap(self.mm_file.fileno(),0,access=mmap.ACCESS_READ)
        
    def __len__(self):
        return self.num_samples
    
    def __getitem__(self,idx):
        """获取指定索引的样本"""
        if idx >= self.num_samples:
            raise IndexError(f"索引超出范围：{idx}，超出范围(0-{self.num_samples-1}")
        
        #获取样表的偏移量和长度
        sample_info = self.index['samples'][idx]
        offset = sample_info['offset']
        length = sample_info['length']
        
        #读取数据
        self.mm.seek(offset)
        data_bytes = self.mm.read(length * self.itemsize)
        
        #转换为tensor
        data_np = np.frombuffer(data_bytes,dtype=self.dtype)
        data_tensor = torch.from_numpy(data_np).contiguous()
        
        #构建于HuggingFace datasets兼容的格式
        return {
            'input_ids':data_tensor,
            'attention_mask':torch.ones_like(data_tensor)
        }
        
        
        
        
