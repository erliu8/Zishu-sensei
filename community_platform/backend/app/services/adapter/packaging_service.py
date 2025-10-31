"""
打包服务
"""
import os
import json
import shutil
import tempfile
import zipfile
import hashlib
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.models.adapter import PackagingTask, Adapter
from app.models.user import User
from app.schemas.adapter import PackagingTaskCreate, PackagingStatus, Platform
from app.core.exceptions import NotFoundException, BadRequestException


class PackagingService:
    """打包服务"""
    
    # 基础应用模板路径
    BASE_APP_PATH = os.getenv("BASE_APP_PATH", "/opt/zishu-sensei/desktop_app")
    # 输出目录
    OUTPUT_PATH = os.getenv("PACKAGING_OUTPUT_PATH", "/tmp/packaging_output")
    # 存储URL前缀
    STORAGE_URL_PREFIX = os.getenv("STORAGE_URL_PREFIX", "https://storage.zishu.ai")
    
    @staticmethod
    def create_task(
        db: Session,
        task_data: PackagingTaskCreate,
        user: User
    ) -> PackagingTask:
        """创建打包任务"""
        # 验证配置
        config = task_data.config
        
        # 验证适配器ID是否存在
        for adapter_id in config.adapters:
            adapter = db.query(Adapter).filter(Adapter.id == adapter_id).first()
            if not adapter:
                raise BadRequestException(f"适配器 {adapter_id} 不存在")
        
        # 创建任务
        task_id = f"pkg_{uuid.uuid4().hex[:12]}"
        task = PackagingTask(
            id=task_id,
            user_id=user.id,
            config=config.model_dump(),
            platform=task_data.platform,
            status="pending",
            progress=0,
        )
        
        db.add(task)
        db.commit()
        db.refresh(task)
        
        # 异步启动打包任务
        from app.tasks.packaging import create_package_task
        create_package_task.delay(task_id)
        
        return task
    
    @staticmethod
    def get_task(
        db: Session,
        task_id: str,
        user: Optional[User] = None
    ) -> PackagingTask:
        """获取打包任务"""
        task = db.query(PackagingTask).filter(PackagingTask.id == task_id).first()
        
        if not task:
            raise NotFoundException(f"打包任务 {task_id} 不存在")
        
        # 检查权限
        if user and task.user_id != user.id and user.role != "admin":
            raise BadRequestException("无权访问此打包任务")
        
        return task
    
    @staticmethod
    def get_user_tasks(
        db: Session,
        user: User,
        page: int = 1,
        size: int = 20
    ):
        """获取用户的打包任务列表"""
        query = db.query(PackagingTask).filter(
            PackagingTask.user_id == user.id
        ).order_by(PackagingTask.created_at.desc())
        
        total = query.count()
        offset = (page - 1) * size
        tasks = query.offset(offset).limit(size).all()
        
        return tasks, total
    
    @staticmethod
    def cancel_task(
        db: Session,
        task_id: str,
        user: User
    ):
        """取消打包任务"""
        task = PackagingService.get_task(db, task_id, user=user)
        
        if task.status in ["completed", "failed"]:
            raise BadRequestException("任务已完成或失败，无法取消")
        
        task.status = "cancelled"
        db.commit()
    
    @staticmethod
    def update_task_status(
        db: Session,
        task_id: str,
        status: str,
        progress: Optional[int] = None,
        download_url: Optional[str] = None,
        file_size: Optional[int] = None,
        file_hash: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """更新任务状态（内部使用）"""
        task = db.query(PackagingTask).filter(PackagingTask.id == task_id).first()
        
        if not task:
            raise NotFoundException(f"打包任务 {task_id} 不存在")
        
        task.status = status
        
        if progress is not None:
            task.progress = progress
        
        if status == "packaging" and not task.started_at:
            task.started_at = datetime.utcnow()
        
        if status in ["completed", "failed"]:
            task.completed_at = datetime.utcnow()
        
        if download_url:
            task.download_url = download_url
        
        if file_size:
            task.file_size = file_size
        
        if file_hash:
            task.file_hash = file_hash
        
        if error_message:
            task.error_message = error_message
        
        db.commit()
        db.refresh(task)
        
        return task
    
    @staticmethod
    def execute_packaging(
        task_id: str,
        config: Dict[str, Any],
        platform: str
    ) -> Dict[str, Any]:
        """
        执行打包（由Celery任务调用）
        
        这是一个简化的示例实现，实际生产环境需要更复杂的逻辑
        """
        try:
            # 1. 创建临时工作目录
            work_dir = tempfile.mkdtemp(prefix=f"packaging_{task_id}_")
            
            # 2. 复制基础应用
            base_app_dir = os.path.join(work_dir, "app")
            shutil.copytree(PackagingService.BASE_APP_PATH, base_app_dir)
            
            # 3. 注入配置
            config_file = os.path.join(base_app_dir, "config", "app.json")
            os.makedirs(os.path.dirname(config_file), exist_ok=True)
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            # 4. 下载并安装适配器
            adapters_dir = os.path.join(base_app_dir, "adapters")
            os.makedirs(adapters_dir, exist_ok=True)
            
            for adapter_id in config.get("adapters", []):
                # TODO: 从数据库获取适配器信息并下载
                # adapter_file = download_adapter(adapter_id)
                # extract_to(adapter_file, adapters_dir)
                pass
            
            # 5. 添加角色资源
            if config.get("character"):
                characters_dir = os.path.join(base_app_dir, "characters")
                os.makedirs(characters_dir, exist_ok=True)
                # TODO: 下载角色资源
                pass
            
            # 6. 构建安装包
            output_file = PackagingService._build_installer(
                base_app_dir,
                platform,
                config
            )
            
            # 7. 计算文件哈希
            file_hash = PackagingService._calculate_hash(output_file)
            file_size = os.path.getsize(output_file)
            
            # 8. 上传到存储
            download_url = PackagingService._upload_to_storage(
                output_file,
                task_id,
                platform
            )
            
            # 9. 清理临时文件
            shutil.rmtree(work_dir)
            
            return {
                "success": True,
                "download_url": download_url,
                "file_size": file_size,
                "file_hash": file_hash,
            }
            
        except Exception as e:
            # 清理临时文件
            if 'work_dir' in locals():
                shutil.rmtree(work_dir, ignore_errors=True)
            
            return {
                "success": False,
                "error": str(e),
            }
    
    @staticmethod
    def _build_installer(
        app_dir: str,
        platform: str,
        config: Dict[str, Any]
    ) -> str:
        """构建安装包"""
        output_dir = PackagingService.OUTPUT_PATH
        os.makedirs(output_dir, exist_ok=True)
        
        app_name = config.get("app_name", "ZishuApp")
        version = config.get("version", "1.0.0")
        
        if platform == Platform.WINDOWS:
            # Windows: 创建 ZIP 包（实际应该是 .exe 或 .msi）
            output_file = os.path.join(output_dir, f"{app_name}_{version}_windows.zip")
            PackagingService._create_zip(app_dir, output_file)
            
        elif platform == Platform.MACOS:
            # macOS: 创建 .dmg （简化为 .zip）
            output_file = os.path.join(output_dir, f"{app_name}_{version}_macos.zip")
            PackagingService._create_zip(app_dir, output_file)
            
        elif platform == Platform.LINUX:
            # Linux: 创建 .AppImage （简化为 .zip）
            output_file = os.path.join(output_dir, f"{app_name}_{version}_linux.zip")
            PackagingService._create_zip(app_dir, output_file)
            
        else:
            raise ValueError(f"不支持的平台: {platform}")
        
        return output_file
    
    @staticmethod
    def _create_zip(source_dir: str, output_file: str):
        """创建ZIP文件"""
        with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, source_dir)
                    zipf.write(file_path, arcname)
    
    @staticmethod
    def _calculate_hash(file_path: str) -> str:
        """计算文件SHA-256哈希"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    @staticmethod
    def _upload_to_storage(
        file_path: str,
        task_id: str,
        platform: str
    ) -> str:
        """上传文件到存储（简化版）"""
        # 实际应该上传到 S3 或其他云存储
        # 这里简化为返回一个模拟的URL
        
        filename = os.path.basename(file_path)
        
        # 复制到输出目录（模拟上传）
        output_file = os.path.join(
            PackagingService.OUTPUT_PATH,
            f"{task_id}_{filename}"
        )
        shutil.copy(file_path, output_file)
        
        # 返回下载URL
        return f"{PackagingService.STORAGE_URL_PREFIX}/packages/{task_id}_{filename}"
    
    @staticmethod
    def get_available_models() -> list:
        """获取可用的AI模型列表"""
        return [
            {
                "id": "qwen-max",
                "name": "通义千问 Max",
                "provider": "阿里云",
                "description": "最强大的通用模型",
                "requires_api_key": True,
            },
            {
                "id": "qwen-plus",
                "name": "通义千问 Plus",
                "provider": "阿里云",
                "description": "性能与成本平衡",
                "requires_api_key": True,
            },
            {
                "id": "gpt-4-turbo",
                "name": "GPT-4 Turbo",
                "provider": "OpenAI",
                "description": "OpenAI最新模型",
                "requires_api_key": True,
            },
            {
                "id": "gpt-3.5-turbo",
                "name": "GPT-3.5 Turbo",
                "provider": "OpenAI",
                "description": "快速且经济",
                "requires_api_key": True,
            },
        ]
    
    @staticmethod
    def get_available_characters() -> list:
        """获取可用的角色列表"""
        return [
            {
                "id": "shizuka",
                "name": "静香",
                "description": "温柔可爱的AI助手",
                "preview_url": "https://example.com/characters/shizuka.png",
            },
            {
                "id": "akira",
                "name": "明",
                "description": "专业的AI助理",
                "preview_url": "https://example.com/characters/akira.png",
            },
        ]

