#!/usr/bin/env python3
"""
适配器解压和集成脚本
处理 zishu-base-adapter 的解压、验证和集成
"""

import os
import tarfile
import shutil
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
import hashlib

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AdapterExtractor:
    """适配器解压器"""
    
    def __init__(self, project_root: Optional[Path] = None):
        """
        初始化适配器解压器
        
        Args:
            project_root: 项目根目录，默认自动检测
        """
        if project_root is None:
            # 自动检测项目根目录
            current_dir = Path(__file__).resolve()
            for parent in current_dir.parents:
                if (parent / "requirements.txt").exists():
                    project_root = parent
                    break
            else:
                project_root = current_dir.parent.parent
                
        self.project_root = Path(project_root)
        self.models_dir = self.project_root / "models"
        self.extracted_dir = self.models_dir / "extracted"
        self.config_dir = self.project_root / "configs"
        
        # 确保目录存在
        self.extracted_dir.mkdir(parents=True, exist_ok=True)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Project root: {self.project_root}")
        logger.info(f"Models dir: {self.models_dir}")
        logger.info(f"Extracted dir: {self.extracted_dir}")

    def find_adapter_archive(self, pattern: str = "zishu-base-adapter*.tar.gz") -> Optional[Path]:
        """
        查找适配器压缩文件
        
        Args:
            pattern: 文件名匹配模式
            
        Returns:
            找到的压缩文件路径，如果没找到则返回None
        """
        import glob
        
        search_paths = [
            self.models_dir,
            self.models_dir / "zishu-base",
            self.project_root,
        ]
        
        for search_dir in search_paths:
            if not search_dir.exists():
                continue
                
            matches = list(search_dir.glob(pattern))
            if matches:
                archive_path = matches[0]  # 取第一个匹配的文件
                logger.info(f"Found adapter archive: {archive_path}")
                logger.info(f"Archive size: {archive_path.stat().st_size / (1024*1024):.1f} MB")
                return archive_path
                
        logger.error(f"No adapter archive found with pattern: {pattern}")
        return None

    def calculate_file_hash(self, file_path: Path, algorithm: str = "sha256") -> str:
        """计算文件哈希值"""
        hasher = getattr(hashlib, algorithm)()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def extract_adapter(self, archive_path: Path, target_name: str = "zishu-base") -> Dict[str, Any]:
        """
        解压适配器文件
        
        Args:
            archive_path: 压缩文件路径
            target_name: 目标适配器名称
            
        Returns:
            解压结果信息
        """
        logger.info(f"Starting to extract adapter: {archive_path}")
        
        # 创建目标目录
        target_dir = self.extracted_dir / target_name
        if target_dir.exists():
            logger.warning(f"Target directory exists, removing: {target_dir}")
            shutil.rmtree(target_dir)
            
        target_dir.mkdir(parents=True)
        
        try:
            # 验证压缩文件
            if not tarfile.is_tarfile(archive_path):
                raise ValueError(f"Invalid tar file: {archive_path}")
                
            # 计算原文件哈希
            original_hash = self.calculate_file_hash(archive_path)
            
            # 解压文件
            extracted_files = []
            with tarfile.open(archive_path, "r:gz") as tar:
                # 安全检查：防止目录遍历攻击
                members = tar.getmembers()
                for member in members:
                    if not self._is_safe_path(member.name):
                        logger.warning(f"Skipping unsafe path: {member.name}")
                        continue
                        
                    tar.extract(member, target_dir)
                    extracted_files.append(member.name)
                    
            logger.info(f"Extracted {len(extracted_files)} files to: {target_dir}")
            
            # 验证解压结果
            validation_result = self._validate_extracted_adapter(target_dir)
            
            # 生成适配器配置
            adapter_config = self._generate_adapter_config(
                target_name, target_dir, archive_path, original_hash, validation_result
            )
            
            # 保存适配器配置
            config_file = self.config_dir / f"{target_name}_adapter.json"
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(adapter_config, f, indent=2, ensure_ascii=False)
                
            logger.info(f"Adapter configuration saved: {config_file}")
            
            return {
                "success": True,
                "adapter_name": target_name,
                "adapter_path": str(target_dir),
                "config_file": str(config_file),
                "extracted_files_count": len(extracted_files),
                "validation_result": validation_result,
                "original_hash": original_hash
            }
            
        except Exception as e:
            logger.error(f"Failed to extract adapter: {e}")
            # 清理失败的解压目录
            if target_dir.exists():
                shutil.rmtree(target_dir)
            raise

    def _is_safe_path(self, path: str) -> bool:
        """检查路径是否安全（防止目录遍历攻击）"""
        return not (path.startswith("/") or ".." in path)

    def _validate_extracted_adapter(self, adapter_dir: Path) -> Dict[str, Any]:
        """
        验证解压的适配器文件
        
        Args:
            adapter_dir: 适配器目录
            
        Returns:
            验证结果
        """
        logger.info(f"Validating extracted adapter: {adapter_dir}")
        
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "files": {},
            "structure": {}
        }
        
        try:
            # 检查必要的文件
            required_files = [
                "adapter_config.json",
                "adapter_model.safetensors",
                "pytorch_model.bin",
            ]
            
            optional_files = [
                "config.json",
                "tokenizer.json",
                "tokenizer_config.json",
                "special_tokens_map.json",
                "README.md"
            ]
            
            all_files = list(adapter_dir.rglob("*"))
            existing_files = {f.name: str(f) for f in all_files if f.is_file()}
            
            validation_result["files"]["total_count"] = len(all_files)
            validation_result["files"]["file_list"] = list(existing_files.keys())
            
            # 检查必要文件
            for required_file in required_files:
                if not any(f.name == required_file for f in all_files):
                    validation_result["warnings"].append(f"Required file missing: {required_file}")
            
            # 检查可选文件
            for optional_file in optional_files:
                if any(f.name == optional_file for f in all_files):
                    validation_result["structure"][optional_file] = "found"
                else:
                    validation_result["structure"][optional_file] = "missing"
            
            # 检查文件大小
            total_size = sum(f.stat().st_size for f in all_files if f.is_file())
            validation_result["files"]["total_size_mb"] = round(total_size / (1024*1024), 2)
            
            # 检查配置文件
            config_files = [f for f in all_files if f.name.endswith('.json')]
            for config_file in config_files:
                try:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        config_data = json.load(f)
                    validation_result["structure"][config_file.name] = {
                        "status": "valid_json",
                        "keys": list(config_data.keys()) if isinstance(config_data, dict) else "not_dict"
                    }
                except Exception as e:
                    validation_result["errors"].append(f"Invalid JSON in {config_file.name}: {str(e)}")
                    validation_result["structure"][config_file.name] = {"status": "invalid_json", "error": str(e)}
            
            # 如果有错误，设置验证失败
            if validation_result["errors"]:
                validation_result["valid"] = False
                
            logger.info(f"Validation completed. Valid: {validation_result['valid']}")
            logger.info(f"Files: {validation_result['files']['total_count']}, Size: {validation_result['files']['total_size_mb']} MB")
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Validation failed: {e}")
            validation_result["valid"] = False
            validation_result["errors"].append(f"Validation error: {str(e)}")
            return validation_result

    def _generate_adapter_config(
        self, 
        adapter_name: str, 
        adapter_path: Path, 
        original_archive: Path,
        original_hash: str,
        validation_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """生成适配器配置"""
        
        from datetime import datetime
        
        return {
            "adapter_info": {
                "name": adapter_name,
                "version": "1.0.0",
                "type": "lora_adapter",
                "created_at": datetime.now().isoformat(),
                "description": "Zishu-sensei base adapter - 害羞可爱的AI助手"
            },
            "paths": {
                "adapter_dir": str(adapter_path),
                "original_archive": str(original_archive),
                "config_file": str(self.config_dir / f"{adapter_name}_adapter.json")
            },
            "validation": validation_result,
            "security": {
                "original_hash": original_hash,
                "algorithm": "sha256"
            },
            "model_config": {
                "base_model": "Qwen/Qwen2.5-7B-Instruct",  # 假设的基础模型
                "task_type": "CAUSAL_LM",
                "peft_type": "LORA",
                "inference_mode": False
            },
            "character_config": {
                "name": "紫舒老师", 
                "personality": "温柔、耐心、害羞、有责任心",
                "default_emotion": "neutral",
                "available_emotions": ["happy", "sad", "neutral", "shy", "excited"]
            },
            "usage": {
                "load_command": f"adapter_manager.load_adapter('{adapter_name}')",
                "api_endpoint": f"/models/load",
                "supported_tasks": ["chat", "emotion_chat", "roleplay"]
            }
        }

    def list_extracted_adapters(self) -> Dict[str, Any]:
        """列出所有已解压的适配器"""
        adapters = {}
        
        if not self.extracted_dir.exists():
            return adapters
            
        for adapter_dir in self.extracted_dir.iterdir():
            if adapter_dir.is_dir():
                config_file = self.config_dir / f"{adapter_dir.name}_adapter.json"
                
                adapter_info = {
                    "name": adapter_dir.name,
                    "path": str(adapter_dir),
                    "config_exists": config_file.exists()
                }
                
                # 读取配置文件信息
                if config_file.exists():
                    try:
                        with open(config_file, "r", encoding="utf-8") as f:
                            config_data = json.load(f)
                        adapter_info["config"] = config_data.get("adapter_info", {})
                        adapter_info["character"] = config_data.get("character_config", {})
                        adapter_info["validation"] = config_data.get("validation", {})
                    except Exception as e:
                        adapter_info["config_error"] = str(e)
                
                adapters[adapter_dir.name] = adapter_info
                
        return adapters


def main():
    """主函数：执行适配器解压流程"""
    
    print("🚀 Zishu-sensei 适配器解压和集成脚本")
    print("=" * 50)
    
    try:
        # 创建解压器
        extractor = AdapterExtractor()
        
        # 查找适配器文件
        archive_path = extractor.find_adapter_archive()
        if not archive_path:
            print("❌ 未找到适配器压缩文件")
            print("请确保 zishu-base-adapter_*.tar.gz 文件在以下目录之一：")
            print(f"  - {extractor.models_dir}")
            print(f"  - {extractor.models_dir}/zishu-base/")
            print(f"  - {extractor.project_root}")
            return False
            
        print(f"✅ 找到适配器文件: {archive_path}")
        
        # 解压适配器
        print("\n📦 开始解压适配器...")
        result = extractor.extract_adapter(archive_path)
        
        if result["success"]:
            print("✅ 适配器解压成功!")
            print(f"   适配器名称: {result['adapter_name']}")
            print(f"   解压路径: {result['adapter_path']}")
            print(f"   配置文件: {result['config_file']}")
            print(f"   文件数量: {result['extracted_files_count']}")
            print(f"   验证状态: {'通过' if result['validation_result']['valid'] else '失败'}")
            
            if result['validation_result']['warnings']:
                print(f"   警告数量: {len(result['validation_result']['warnings'])}")
                
        else:
            print("❌ 适配器解压失败!")
            return False
            
        # 列出所有适配器
        print("\n📋 当前可用的适配器:")
        adapters = extractor.list_extracted_adapters()
        
        if not adapters:
            print("   (没有找到已解压的适配器)")
        else:
            for name, info in adapters.items():
                print(f"   - {name}")
                if "character" in info:
                    char_info = info["character"]
                    print(f"     角色: {char_info.get('name', 'Unknown')}")
                    print(f"     性格: {char_info.get('personality', 'Unknown')}")
                    
        print("\n🎉 适配器集成完成!")
        print("现在可以通过 AdapterManager 加载和使用适配器了")
        
        return True
        
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        print(f"❌ 解压过程出错: {e}")
        return False


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
