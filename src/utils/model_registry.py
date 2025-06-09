import logging
import os
from typing import Dict,Any,Optional,List,Union,Tuple,Callable,Type
from pathlib import Path
import json
import importlib

class ModelInfo:
    """模型信息类,用于存储模型的元数据信息"""
    
    def __init__(self,
                 model_id:str,
                 name:str,
                 model_type:str,
                 version:str,
                 architecture:str,
                 parameters:int,
                 language=List[str],
                 description:str ="",
                 config_path:Optional[str]=None,
                 model_path:Optional[str]=None,
                 quantization:Optional[str]=None,
                 tags:List[str]=[],
                 metadata:Dict[str,Any]=None
                 ):
        """
        初始化模型信息
        
        Args:
            model_id (str): 模型唯一标识
            name (str): 模型名称
            model_type (str): 模型类型
            version (str): 模型版本
            architecture (str): 模型架构
            parameters (int): 模型参数数量
            language (List[str]): 支持的语言
            description (str): 模型描述
            config_path (Optional[str]): 模型配置文件路径
            model_path (Optional[str]): 模型文件路径
            quantization (Optional[str]): 量化方式
            tags (List[str]): 模型标签
            metadata (Dict[str,Any]): 模型元数据
            
        """
        self.model_id = model_id
        self.name = name
        self.model_type = model_type
        self.version = version
        self.architecture = architecture
        self.parameters = parameters
        self.language = language
        self.description = description
        self.config_path = config_path
        self.model_path = model_path
        self.quantization = quantization
        self.tags = tags or []
        self.metadata = metadata or {}
        
    def to_dict(self)->Dict[str,Any]:
        """将模型信息转换为字典"""
        return {
            "model_id":self.model_id,
            "name":self.name,
            "model_type":self.model_type,
            "version":self.version,
            "architecture":self.architecture,
            "parameters":self.parameters,
            "language":self.language,
            "description":self.description,
            "config_path":self.config_path,
            "model_path":self.model_path,
            "quantization":self.quantization,
            "tags":self.tags,
            "metadata":self.metadata
        }
        
    @classmethod
    def from_dict(cls,data:Dict[str,Any])->"ModelInfo":
        """从字典创建模型信息"""
        return cls(**data)
    
class ModelRegistry:
    """模型注册表类,用于管理模型信息"""
    
    def __init__(self,registry_path:Union[str,Path]=None):
        
        """
        初始化模型注册表
        
        Args:
            registry_path (Union[str,Path]): 模型注册表路径
        """
        self.registry_path = Path(registry_path or "model_registry.json")
        self.models:Dict[str,ModelInfo] = {}
        self.model_instances:Dict[str,Any] = {}
        self.logger = logging.getLogger(__name__)
        
        #确保注册表文件路径存在
        os.makedirs(self.registry_path.parent,exist_ok=True)
        
        #加载模型注册表
        self._load_registry()
        
    def _load_registry(self):
        """加载模型注册表"""
        if not self.registry_path.exists():
            self.logger.info(f"模型注册表文件不存在,创建新的注册表: {self.registry_path}")
            self._save_registry()
            return
        
        try:
            with open(self.registry_path,"r",encoding="utf-8") as f:
                data = json.load(f)
            
            for model_data in data.get("models",[]):
                model_info = ModelInfo.from_dict(model_data)
                self.models[model_info.model_id] = model_info
                
            self.logger.info(f"成功加载模型注册表，包括{len(self.models)}个模型")
        except Exception as e:
            self.logger.error(f"加载模型注册表失败: {e}")
        
    def _save_registry(self)->None:
        """保存模型注册表"""
        try:
            data = {
                "models":[model.to_dict() for model in self.models.values()]
            }
            with open(self.registry_path,"w",encoding="utf-8") as f:
                json.dump(data,f,ensure_ascii=False,indent=2)
            self.logger.info(f"模型注册表已保存到: {self.registry_path}")
        except Exception as e:
            self.logger.error(f"保存模型注册表失败: {e}")
    
    def register_model(self,model_info:ModelInfo)->None:
        """
        注册模型
        
        Args:
            model_info (ModelInfo): 模型信息
        """
        self.models[model_info.model_id] = model_info
        self._save_registry()
        self.logger.info(f"{model_info.name} 模型 {model_info.model_id} 已注册")
    
    def unregister_model(self,model_id:str)->bool:
        """
        注销模型
        
        Args:
            model_id (str): 模型ID
        
        Returns:
            是否成功注销
        """
        if model_id in self.models:
            del self.models[model_id]
            self._save_registry()
            self.logger.info(f"模型 {model_id} 已注销")
            return True
        return False
    
    def get_model_info(self,model_id:str)->Optional[ModelInfo]:
        """
        获取模型信息

        Args:
            model_id (str): 模型ID
            
        Returns:
            Optional[ModelInfo]: 模型信息,如果模型不存在返回None
        """
        return self.models.get(model_id)
    
    def get_models_by_type(self,model_type:str)->List[ModelInfo]:
        """
        根据模型类型获取模型信息
        
        Args:
            model_type (str): 模型类型
            
        Returns:
            List[ModelInfo]: 模型信息列表
        """
        return [model for model in self.models.values() if model.model_type == model_type]
    
    def get_models_by_tag(self,tag:str)->List[ModelInfo]:
        """
        根据模型标签获取模型信息
        
        Args:
            tag (str): 模型标签
            
        Returns:
            List[ModelInfo]: 模型信息列表
        """
        return [model for model in self.models.values() if tag in model.tags]
    
    def get_model_instance(self,model_id:str,force_reload:bool=False)->Any:
        """
        获取模型实例,如果模型尚未加载,则加载模型
        
        Args:
            model_id (str): 模型ID
            force_reload (bool): 是否强制重新加载
            
        Returns:
            Any: 模型实例
            
        Raises:
            ValueError: 如果模型未注册
        """
        if model_id not in self.models:
            raise ValueError(f"模型 {model_id} 未注册")
        
        if force_reload or model_id not in self.model_instances:
            self._load_model(model_id)
            
        return self.model_instances.get[model_id]
    
    def _load_model(self,model_id:str)->None:
        """
        加载模型
        
        Args:
            model_id (str): 模型ID
            
        Returns:
            Any: 模型实例
            
        Raises:
            ValueError: 如果模型路径不存在
            ImportError: 如果模型路径无法导入
            Exception: 其他导入错误

        """
        model_info = self.models[model_id]
        if not model_info:
            raise ValueError(f"模型 {model_id} 未注册")
        
        try:
            #根据模型架构动态导入相应的模型实现
            arch = model_info.architecture.lower()
            module_name = f"src.models.{arch}"
            
            try:
                module = importlib.import_module(module_name)
                model_class = getattr(module,f"{arch.capitalize()}Model")
            except (ImportError,AttributeError):
                #尝试从默认模块导入
                module = importlib.import_module("src.model.base")
                model_class = getattr(module,"BaseModel")
                
            #实例化模型    
            model_instance = model_class(model_info)
            self.model_instances[model_id] = model_instance
            
            self.logger.info(f"成功加载({model_info.name})模型 {model_id} 实例")
            
        except Exception as e:
            self.logger.error(f"加载模型 {model_id} 失败: {e}")
            raise ValueError(f"加载模型 {model_id} 失败: {str(e)}")
        
    def unload_model(self,model_id:str)->bool:
        """
        卸载模型
        
        Args:
            model_id (str): 模型ID
            
        Returns:
            bool: 是否成功卸载
        """
        if model_id in self.model_instances:
            instance = self.model_instances[model_id]
            
            #如果模型实例实现了释放资源方法,则调用它
            if hasattr(instance,"unload") and callable(getattr(instance,"unload")):
                try:
                    instance.unload()
                    self.logger.info(f"模型 {model_id} 已卸载")
                except Exception as e:
                    self.logger.warning(f"卸载模型 {model_id} 失败: {e}")
                
            del self.model_instances[model_id]
            self.logger.info(f"模型 {model_id} 已卸载")
            return True
        return False
    
    def get_all_models(self)->List[ModelInfo]:
        """获取所有模型信息"""
        return list(self.models.values())
    
    def get_teacher_model(self)->List[ModelInfo]:
        """获取所有教师模型信息"""
        return self.get_models_by_type("teacher")
    
    def get_student_model(self)->List[ModelInfo]:
        """获取所有学生模型信息"""
        return self.get_models_by_type("student")
    
    def get_specialized_model(self,task:str)->List[ModelInfo]:
        """获取所有专家模型"""
        return self.get_models_by_type("specialized")
    
    
#全局模型注册表实例
_model_registry = None

def get_model_registry()->ModelRegistry:
    """获取模型注册表实例"""
    global _model_registry
    if _model_registry is None:
        _model_registry = ModelRegistry()
    return _model_registry

    
    
