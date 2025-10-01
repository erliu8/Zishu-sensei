#! /usr/bin/env python3
# -*- coding: utf-8 -*-

import os 
import time
import logging
import threading
import queue
from typing import Any,Dict,List,Optional,Union,Tuple,Callable,Generator

import torch
import torch.nn.functional as F
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TextIteratorStreamer,
    StoppingCriteria,
    StoppingCriteriaList
)
from peft import PeftModel

from zishu.utils.model_registry import get_model_registry,ModelInfo
from zishu.utils.cache_manager import ModelResponseCache
from zishu.utils.performance import get_performance_monitor
from zishu.utils.fallback import CircuitBreaker
from zishu.utils.prompt_manager import get_prompt_manager
from zishu.utils.config_manager import ConfigManager

#TODO: 利用C++加速引擎
class CustomStoppingCriteria(StoppingCriteria):
    """自定义停止生成标准"""
    def __init__(self,stop_sequences:List[str],tokenizer):
        self.stop_sequences = stop_sequences
        self.tokenizer = tokenizer
        self.buffer = ""
        
    def __call__(self,input_ids:torch.LongTensor,scores:torch.FloatTensor,**kwargs)->bool:
        #获取最后生成的token
        latest_token = input_ids[0][-1]
        latest_text = self.tokenizer.decode(latest_token)
        self.buffer += latest_text
        
        #保持buffer在合理长度
        if len(self.buffer) > 100:
            self.buffer = self.buffer[-100:]
            
        #检查是否匹配任何停止序列
        for stop_seq in self.stop_sequences:
            if stop_seq in self.buffer:
                return True
            
        return False
    
class InferenceEngine:
    """推理引擎类，负责模型推理和流式生成"""
    def __init__(self,config:Optional[ConfigManager]=None):
        """
        初始化推理引擎
        Args:
            config:配置管理器实例，用于获取配置信息
        """
        self.logger = logging.getLogger(__name__)
        self.model_registry = get_model_registry()
        self.performance_monitor = get_performance_monitor()
        self.prompt_manager = get_prompt_manager()
        self.config = config
        
        #默认参数
        self.default_params = {
            "temperature":0.7,
            "top_p":0.9,
            "top_k":40,
            "max_new_tokens":512,
            "repetition_penalty":1.1,
            "do_sample":True,
            "num_beams":1,
            "early_stopping":True
        }
        
        #缓存管理
        self.response_cache = ModelResponseCache(max_size=1000,ttl=3600)
        
        #活跃模型实例缓存
        self.active_models = {}
        self.active_tokenizers = {}
        
        #加载默认模型
        self.load_default_model()
        
    def _load_default_model(self):
        """加载默认模型"""
        try:
            #从配置获取默认模型ID
            if self.config:
                model_config = self.config.get_model_config("model_config")
                default_model_id = model_config.get("default_model_id")
                
                if default_model_id:
                    self.logger.info(f"使用配置文件中的默认模型: {default_model_id}")
                    self.load_model(default_model_id)
        except Exception as e:
            self.logger.error(f"加载默认模型失败: {e}")
        
    def load_model(self,model_id:str)->bool:
        """
        加载模型到内存
        
        Args:
            model_id:模型ID
            
        Returns:
            bool:是否成功加载
        """
        try:
            if model_id in self.active_models:
                self.logger.info(f"模型{model_id}已加载")
                return True
            
            start_time = time.time()
            model_info = self.model_registry.get_model_info(model_id)
            
            if not model_info:
                self.logger.error(f"模型{model_id}不存在")
                return False
            
            #加载模型和分词器
            model_path = model_info.model_path
            quantization = model_info.quantization
            
            #根据量化类型设置加载参数
            load_params = {}
            if quantization == "4bit":
                load_params.update({
                    "load_in_4bit":True,
                    "bnb_4bit_compute_dtype":torch.float16,
                    "bnb_4bit_quant_type":"nf4",
                    "bnb_4bit_use_double_quant":True
                })
            elif quantization == "8bit":
                load_params.update({"load_in_8bit":True})
            
            else:
                #无量化或其他量化方式
                load_params.update({
                    "device_map":"auto",
                    "torch_dtype":torch.float16
                })
            
            #加载模型
            model = AutoModelForCausalLM.from_pretrained(
                model_path,
                **load_params,
            )
            
            #如果是PEFT/LORA模型，加载适配器
            if model_info.metadata.get("is_peft",False):
                peft_model_path = model_info.metadata.get("peft_model_path")
                if peft_model_path:
                    model = PeftModel.from_pretrained(model,peft_model_path)
            
            #加载分词器
            tokenizer = AutoTokenizer.from_pretrained(
                model_path,
                trust_remote_code=True,
                padding_side="left"
            )
            
            #确保分词器具有pad_token
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token
            
            #存储模型和分词器
            self.active_models[model_id] = model
            self.active_tokenizers[model_id] = tokenizer
            
            elapsed_time = time.time() - start_time
            self.logger.info(f"模型{model_id}加载完成，用时{elapsed_time:.2f}秒")
            
            #记录性能数据
            self.performance_monitor.record_response_time("model",f"load_{model_id}",elapsed_time)
            
            return True
        except Exception as e:
            self.logger.error(f"加载模型{model_id}失败: {e}")
            return False
        
    def unload_model(self,model_id:str)->bool:
        """卸载模型
        
        Args:
            model_id:模型ID
            
        Returns:
            bool:是否成功卸载
        """
        if model_id not in self.active_models:
            return False
        
        try:
            #释放模型和分词器
            del self.active_models[model_id]
            del self.active_tokenizers[model_id]
            
            #执行垃圾回收
            torch.cuda.empty_cache()
            import gc
            gc.collect()
            
            self.logger.info(f"已卸载模型{model_id}")
            return True
        except Exception as e:
            self.logger.error(f"卸载模型{model_id}失败: {e}")
            return False
        
    def generate(self,
                 prompt:str,
                 model_id:Optional[str]=None,
                 stream:bool=False,
                 use_cache:bool=True,
                 **kwargs)->Union[str,Generator[str,None,None]]:
        """
        生成文本
        
        Args:
            prompt:输入提示
            model_id:模型ID
            stream:是否流式生成
            use_cache:是否使用缓存
            **kwargs:其他参数
            
        Returns:
            Union[str,Generator[str,None,None]]:生成文本或生成器
        """
        #尝试从缓存获取
        if use_cache and not stream:
            cached_response = self.response_cache.get_response(prompt,**kwargs)
            if cached_response:
                self.logger.info(f"从缓存获取响应,提示：{prompt[:50]}...")
                return cached_response
            
        #确定要使用的模型
        if not model_id:
            model_config = self.config.get_model_config("model_config")
            model_id = model_config.get("default_model_id")
            
        #确定模型已加载
        if model_id not in self.active_models:
            success = self.load_model(model_id)
            if not success:
                raise RuntimeError(f"模型{model_id}加载失败")
            
        #获取模型和分词器
        model = self.active_models[model_id]
        tokenizer = self.active_tokenizers[model_id]
        
        #合并生成参数
        gen_params = self.default_params.copy()
        gen_params.update(kwargs)
        
        #编码输入
        inputs = tokenizer(prompt,return_tensors="pt",padding=True)
        input_ids = inputs["input_ids"].to(model.device)
        attention_mask = inputs["attention_mask"].to(model.device)
        
        #记录开始时间
        start_time = time.time()
        
        try:
            #流式生成
            if stream:
                return self._generate_stream(
                    model,
                    tokenizer,
                    input_ids,
                    attention_mask,
                    gen_params
                )
            #批量生成
            with torch.no_grad():
                outputs = model.generate(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    **gen_params
                )
            
            #解码输出
            response = tokenizer.decode(outputs[0][len(input_ids[0]):],skip_special_tokens=True)
            
            #记录性能数据
            generation_time = time.time() - start_time
            sequence_length = len(outputs[0]) - len(input_ids[0])
            self.performance_monitor.record_model_metrics(
                batch_size=1,
                inference_time=generation_time,
                sequence_length=sequence_length,
                memory_usage=torch.cuda.memory_allocated() if torch.cuda.is_available() else 0
            )
            
            #缓存响应
            if use_cache:
                self.response_cache.cache_response(prompt,response,**kwargs)
                
            return response
        except Exception as e:
            self.logger.error(f"生成失败: {e}")
            raise 
        
    def _generate_stream(self,
                         model,
                         tokenizer,
                         input_ids,
                         attention_mask,
                         gen_params):
        """
        流式文本生成
        
        Args:
            model:模型实例
            tokenizer:分词器实例
            input_ids:输入ID
            attention_mask:注意力掩码
            gen_params:生成参数
            
        Returns:
            文本生成器

        """
        #创建流式迭代器
        streamer = TextIteratorStreamer(
            tokenizer,
            skip_prompt=True,
            skip_special_tokens=True
        )
        #设置停止条件
        stop_sequences = gen_params.get("stop_sequences",[])
        stopping_criteria = None
        if stop_sequences:
            stopping_criteria = StoppingCriteriaList([
                CustomStoppingCriteria(stop_sequences,tokenizer)
            ])
        
        #在后台线程中生成
        generation_kwargs = {
            "input_ids":input_ids,
            "attention_mask":attention_mask,
            "streamer":streamer,
            **({"stopping_criteria":stopping_criteria} if stopping_criteria else {}),
            **gen_params
        }
        
        #创建生成器
        generated_text = ""
        for new_text in streamer:
            generated_text += new_text
            yield new_text
            
    def _generate_in_thread(self,model,generation_kwargs):
        """在后台线程中生成"""
        with torch.no_grad():
            model.generate(**generation_kwargs)
            
    @CircuitBreaker(failure_threshold=3,recovery_timeout=0)
    def batch_generate(self,
                       prompts:List[str],
                       model_id:Optional[str]=None,
                       **kwargs)->List[str]:
        """
        批量生成文本
        
        Args:
            prompts:输入提示列表
            model_id:模型ID
            **kwargs:其他参数
            
        Returns:
            生成文本列表
        """
        if not prompts:
            return []
        #确定要使用的模型
        if not model_id:
            model_config = self.config.get_model_config("model_config")
            model_id = model_config.get("default_model_id")
            
        #确定模型已加载
        if model_id not in self.active_models:
            success = self.load_model(model_id)
            if not success:
                raise RuntimeError(f"模型{model_id}加载失败")
            
        #获取模型和分词器       
        model = self.active_models[model_id]
        tokenizer = self.active_tokenizers[model_id]
        
        #合并生成参数
        gen_params = self.default_params.copy()
        gen_params.update(kwargs)
        
        #编码输入
        batch_inputs = tokenizer(prompts,return_tensors="pt",padding=True)
        input_ids = batch_inputs["input_ids"].to(model.device)
        attention_mask = batch_inputs["attention_mask"].to(model.device)
        
        #记录开始时间
        start_time = time.time()
        
        try:
            #批量生成
            with torch.no_grad():
                outputs = model.generate(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    **gen_params
                )
            #计算每个输入的长度，用于切割输出
            input_lengths = [len(ids) for ids in input_ids]
            
            #解码输出
            responses = []
            for i,output in enumerate(outputs):
                response = tokenizer.decode(
                    output[input_lengths[i]:],
                    skip_special_tokens=True
                )
                responses.append(response)
            
            #记录性能数据
            generation_time = time.time() - start_time
            avg_sequence_length = sum(len(output) - input_lengths[i] for i,output in enumerate(outputs)) / len(outputs)
            self.performance_monitor.record_model_metrics(
                batch_size=len(prompts),
                inference_time=generation_time,
                sequence_length=int(avg_sequence_length),
                memory_usage=torch.cuda.max_memory_allocated() if torch.cuda.is_available() else 0
            )
            
            return responses
        except Exception as e:
            self.logger.error(f"批量生成失败: {e}")
            raise
        
    def teacher_ensemble_generate(self,
                                  prompts:str,
                                  theacher_ids:List[str],
                                  weights:List[float]=None,
                                  ensemble_method:str="weighted_choice",
                                  **kwargs)->str:
        """
        教师模型集成生成
        
        Args:
            prompts:输入提示
            theacher_ids:教师模型ID列表
            weights:各教师模型权重，不提供则等权重
            ensemble_method:集成方法
            **kwargs:其他参数
            
        Returns:
            集成生成文本
        """
        if not theacher_ids:
            raise ValueError("未提供教师模型ID")
        
        if weights and len(weights) != len(theacher_ids):
            raise ValueError("权重数量与教师模型ID数量不一致")
        
        if not weights:
            #等权重
            weights = [1.0 / len(theacher_ids)] * len(theacher_ids)
            
        #获取每个教师模型的输出
        responses = []
        for theacher_id in theacher_ids:
            try:
                response = self.generate(
                    prompts,
                    model_id=theacher_id,
                    **kwargs
                )
                responses.append(response)
            except Exception as e:
                self.logger.error(f"教师模型{theacher_id}生成失败: {e}")
                responses.append("")
        
        #如果所有教师模型都失败，则引发异常
        if all(not response for response in responses):
            raise RuntimeError("所有教师模型生成失败")
        
        #根据选择的集成方法处理
        if ensemble_method == "weighted_choice":
            #加权随机选择
           import random
           selected_idx = random.choices(range(len(responses)),weights=weights,k=1)[0]
           return responses[selected_idx]
       
        elif ensemble_method == "hybrid_combine":
           #结合多个回答，取3句不同的内容组合
           combined_response = ""
           seen_responses = set()
           
           for i,response in enumerate(responses):
               if not response:
                   continue
                
               sentences = [s.strip() for s in response.split("\n") if s.strip()]
               for sentence in sentences[:3]: #取前3句
                   #简单去重
                   normalized = sentence.lower()
                   if normalized not in seen_responses and len(normalized) > 10:
                       if combined_response:
                           combined_response += "." + sentence
                       else:
                           combined_response += sentence
                       seen_responses.add(normalized)
                       
           return combined_response + "." if combined_response else responses[0]
       
        elif ensemble_method == "token_voting":
           #需要更细粒度的token级投票，这里是简化实现
           #完整实现需要在token级别进行，可能需要修改模型生成过程
           
           #获取所有回答的tokens
           tokenizers = [self.active_tokenizers[model_id] for model_id in theacher_ids]
           all_tokens = []
           
           for i,response in enumerate(responses):
               if not response:
                   continue
               
               #获取tokenizer
               tokens = tokenizers[i].encode(response)
               all_tokens.append(tokens)

           #投票选择tokens(这里简化实现)
           #实际应该是逐步生成并投票，这里需要修改generate函数
           max_len = min(len(tokens) for tokens in all_tokens) if all_tokens else 0
           if max_len == 0:
               return responses[0]
           
           result_tokens = []
           for pos in range(max_len):
               #获取每个模型在该位置的token
               candidates = [tokens[pos] for tokens in all_tokens if pos < len(tokens)]
               #计数
               from collections import Counter
               counter = Counter(candidates)
               #选择最常见的token
               most_common = counter.most_common(1)[0][0]
               result_tokens.append(most_common)
           
           #解码回文本
           tokenizer = tokenizers[0] #使用第一个tokenizer解码
           return tokenizer.decode(result_tokens)
        
        elif ensemble_method == "confidence_based":
           #基于置信度选择
           #需要计算每个回答的置信度，这里简化实现
           
           #作为替代，我们可以使用回答长度和一致性作为粗略指标
           #具有过多重复词的回答可能置信度较低
           scores = []
           
           for response in responses:
               if not response:
                   scores.append(0)
                   continue
               
               #计算重复词比例
               words = response.lower().split()
               unique_words = set(words)
               repetition_ratio = len(unique_words) / len(words) if words else 0
               
               #长度分数 - 假设太短或太长可能置信度较低
               target_length = 100 #理想长度
               length_score = 1.0 - min(abs(len(words) - target_length) / target_length,1.0)
               
               #综合得分
               score = (repetition_ratio * 0.7) + (length_score * 0.3)
               scores.append(score)
           
           #结合预设权重和置信度
           final_weights = [w * s for w,s in zip(weights,scores)]
           
           #标准化
           sum_weights = sum(final_weights) or 1.0
           final_weights = [w / sum_weights for w in final_weights]
           
           #选择得分最高的回答
           best_idx = final_weights.index(max(final_weights))
           return responses[best_idx]
       
        elif ensemble_method == "task_routing":
           # 基于任务类型路由到最合适的专家模型
           # 这需要一个任务分类器
           
           #简化实现：基于关键词路由
           prompt_lower = prompts.lower()
           
           #定义任务类型和对应的专家模型
           task_preferences = {
                "计算": ["DeepSeek-Math-7B"],
                "数学": ["DeepSeek-Math-7B"],
                "逻辑": ["DeepSeek-Math-7B"],
                "人物": ["Vicuna-7B"],
                "角色": ["Vicuna-7B"],
                "情感": ["Vicuna-7B"],
                "文化": ["Baichuan2"],
                "中国": ["Baichuan2"],
                "历史": ["Baichuan2"],
                "图像": ["LLaVA"],
                "视觉": ["LLaVA"],
                "看": ["LLaVA"],
            }
           #检查任务类型
           detected_tasks = []
           for keyword,preferred_models in task_preferences.items():
               if keyword in prompt_lower:
                   #找到这些模型在theacher_ids中的索引
                   for model in preferred_models:
                       if model in theacher_ids:
                           model_idx = theacher_ids.index(model)
                           detected_tasks.append(model_idx)
                   
           if detected_tasks:
               #有检测到特定任务，选择对应的专家模型回答
               task_idx = detected_tasks[0] #选择第一个
               return responses[task_idx]
           else:
               #没有检测到特定任务，使用权重随机选择
               import random
               selected_idx = random.choices(range(len(responses)),weights=weights,k=1)[0]
               return responses[selected_idx]
           
        else:
            #默认方法
            return responses[0]

    def chat_generate(self,
                      messages:List[Dict[str,str]],
                      model_id:Optional[str]=None,
                      character_id:Optional[str]=None,
                      **kwargs)->str:
        """
        基于消息历史生成聊天响应
        
        Args:
            messages:消息历史 [{"role":"user/assistant/system","content":...."}]
            model_id:模型ID
            character_id:角色ID
            **kwargs:其他参数
            
        Returns:
            聊天响应
        """
        #根据角色ID获取系统提示
        system_prompt = ""
        if character_id:
            system_prompt = self.prompt_manager.create_character_prompt(character_id)
            
        #格式化聊天历史
        formatted_prompt = self._format_chat_prompt(messages,system_prompt,model_id)
        
        #生成响应
        response = self.generate(
            formatted_prompt,
            model_id=model_id,
            **kwargs
        )
        
        return response
    
    def _format_chat_prompt(self,messages:List[Dict[str,str]],system_prompt:str,model_id:Optional[str]=None)->str:
        """
        格式化聊天提示
        
        Args:
            messages:消息历史
            system_prompt:系统提示
            model_id:模型ID
            
        Returns:
            格式化后的聊天提示
        """
        #获取模型架构信息，以选择适当的提示模板
        model_arch = "default"
        if model_id:
            model_info = self.model_registry.get_model_info(model_id)
            if model_info:
                model_arch = model_info.architecture.lower()
                
        #根据模型架构选择不同的格式化方法
        if "mistral" in model_arch:
            return self._format_mistral_chat_prompt(messages,system_prompt)
        elif "qwen" in model_arch:
            return self._format_qwen_chat_prompt(messages,system_prompt)
        elif "chatglm" in model_arch:
            return self._format_chatglm_chat_prompt(messages,system_prompt)
        else:
            #默认格式化方法
            return self._format_default_chat_prompt(messages,system_prompt)
        
    def _format_mistral_chat_prompt(self,messages,system_prompt):
        """格式化Mistral模型聊天提示"""
        formatted_prompt = ""
        
        if system_prompt:
            formatted_prompt += f"<s>[INST] {system_prompt} [/INST]\n\n"
            
        for i,msg in enumerate(messages):
            role = msg["role"]
            content = msg["content"]
            
            if role == "user":
                if i == 0 or messages[i-1]["role"] == "assistant":
                    formatted_prompt += f"<s>[INST] {content} [/INST]"
                else:
                    formatted_prompt += f"[INST] {content} [/INST]"
            elif role == "assistant":
                formatted_prompt += f" {content}</s>"
            #忽略system消息，因为已经在开头处理过
            
        #确保以用户消息结束并等待模型回复
        if messages and messages[-1]["role"] == "user":
            formatted_prompt += " "
            
        return formatted_prompt
    
    def _format_qwen_chat_prompt(self,messages,system_prompt):
        """格式化Qwen模型聊天提示"""
        formatted_prompt = ""
        
        if system_prompt:
            formatted_prompt += f"<|im_start|>system\n{system_prompt}\n<|im_end|>\n"
        
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            
            if role == "user":
                formatted_prompt += f"<|im_start|>user\n{content}\n<|im_end|>\n"
            elif role == "assistant":
                formatted_prompt += f"<|im_start|>assistant\n{content}\n<|im_end|>\n"
            elif role == "system":
                formatted_prompt += f"<|im_start|>system\n{content}\n<|im_end|>\n"
                
        #添加助手角色标识，准备生成
        formatted_prompt += "<|im_start|>assistant\n"
        
        return formatted_prompt
    
    def _format_chatglm_chat_prompt(self,messages,system_prompt):
        """格式化ChatGLM模型聊天提示"""
        formatted_prompt = ""
        if system_prompt:
            formatted_prompt = system_prompt + "\n\n"
            
        for i,msg in enumerate(messages):
            role = msg["role"]
            content = msg["content"]
            
            if role == "user":
                if i > 0:
                    formatted_prompt += "\n\n"
                formatted_prompt += f"问: {content}"
            elif role == "assistant":
                formatted_prompt += f"\n\n答: {content}"
        #添加最后的“答：”提示
        if messages and messages[-1]["role"] == "user":
            formatted_prompt += "\n\n答："
                
        return formatted_prompt
    
    def _format_default_chat_prompt(self,messages,system_prompt):
        """格式化默认模型聊天提示"""
        formatted_prompt = ""
        
        if system_prompt:
            formatted_prompt = system_prompt + "\n\n"
            
        for i,msg in enumerate(messages):
            role = msg["role"]
            content = msg["content"]
            
            if i >0:
                formatted_prompt += "\n\n"
                
            if role == "system":
                formatted_prompt += f"System: {content}"
            elif role == "user":
                formatted_prompt += f"User: {content}"
            elif role == "assistant":
                formatted_prompt += f"Assistant: {content}"
        
        #添加助手角色标识，准备生成
        if messages and messages[-1]["role"] == "user":
            formatted_prompt += "\n\nAssistant: "
                
        return formatted_prompt
    
#全局推理引擎实例
_inference_engine = None

def get_inference_engine()->InferenceEngine:
    """获取推理引擎实例"""
    global _inference_engine
    
    if _inference_engine is None:
        from zishu.utils.config_manager import ConfigManager
        from pathlib import Path
        config_dir = Path(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),"config"))
        config = ConfigManager(config_dir)
        _inference_engine = InferenceEngine(config)
        
    return _inference_engine


