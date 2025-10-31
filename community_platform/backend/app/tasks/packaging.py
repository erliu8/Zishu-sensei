"""
打包相关的Celery任务
"""
import os
import json
import shutil
import tempfile
import zipfile
import hashlib
import logging
from typing import Dict, Any
from celery import Task

from app.tasks.celery_app import celery_app
from app.db.session import SessionLocal
from app.services.adapter import PackagingService
from app.models.adapter import Adapter

logger = logging.getLogger(__name__)


class PackagingTask(Task):
    """打包任务基类，支持进度回调"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败时的回调"""
        logger.error(f"打包任务 {task_id} 失败: {exc}")
        
        # 更新数据库状态
        db = SessionLocal()
        try:
            packaging_task_id = args[0] if args else kwargs.get('task_id')
            if packaging_task_id:
                PackagingService.update_task_status(
                    db=db,
                    task_id=packaging_task_id,
                    status="failed",
                    error_message=str(exc)
                )
        finally:
            db.close()


@celery_app.task(
    bind=True,
    base=PackagingTask,
    name="tasks.create_package"
)
def create_package_task(self, task_id: str):
    """
    创建打包任务
    
    Args:
        task_id: 打包任务ID
    """
    db = SessionLocal()
    
    try:
        # 获取任务信息
        task = PackagingService.get_task(db, task_id, user=None)
        
        if not task:
            raise ValueError(f"打包任务 {task_id} 不存在")
        
        logger.info(f"开始执行打包任务: {task_id}")
        
        # 更新状态为打包中
        PackagingService.update_task_status(
            db=db,
            task_id=task_id,
            status="packaging",
            progress=0
        )
        
        config = task.config
        platform = task.platform
        
        # 步骤1: 创建工作目录 (10%)
        self.update_state(state='PROGRESS', meta={'progress': 10, 'status': '创建工作目录'})
        PackagingService.update_task_status(db, task_id, status="packaging", progress=10)
        
        work_dir = tempfile.mkdtemp(prefix=f"packaging_{task_id}_")
        logger.info(f"工作目录: {work_dir}")
        
        # 步骤2: 复制基础应用 (30%)
        self.update_state(state='PROGRESS', meta={'progress': 30, 'status': '准备基础应用'})
        PackagingService.update_task_status(db, task_id, status="packaging", progress=30)
        
        base_app_dir = os.path.join(work_dir, "app")
        base_app_path = os.getenv("BASE_APP_PATH", "/opt/zishu-sensei/desktop_app")
        
        if os.path.exists(base_app_path):
            shutil.copytree(base_app_path, base_app_dir, ignore=shutil.ignore_patterns(
                'node_modules', '.git', '__pycache__', 'target', 'dist', 'build'
            ))
        else:
            # 如果基础应用不存在，创建一个基本结构
            os.makedirs(base_app_dir, exist_ok=True)
            logger.warning(f"基础应用路径不存在: {base_app_path}, 创建空白结构")
        
        # 步骤3: 注入配置 (40%)
        self.update_state(state='PROGRESS', meta={'progress': 40, 'status': '注入配置'})
        PackagingService.update_task_status(db, task_id, status="packaging", progress=40)
        
        config_dir = os.path.join(base_app_dir, "config")
        os.makedirs(config_dir, exist_ok=True)
        
        config_file = os.path.join(config_dir, "app.json")
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        logger.info(f"配置文件已写入: {config_file}")
        
        # 步骤4: 下载并安装适配器 (60%)
        self.update_state(state='PROGRESS', meta={'progress': 60, 'status': '安装适配器'})
        PackagingService.update_task_status(db, task_id, status="packaging", progress=60)
        
        adapters_dir = os.path.join(base_app_dir, "adapters")
        os.makedirs(adapters_dir, exist_ok=True)
        
        adapter_ids = config.get("adapters", [])
        for idx, adapter_id in enumerate(adapter_ids):
            logger.info(f"处理适配器 {idx+1}/{len(adapter_ids)}: {adapter_id}")
            
            # 从数据库获取适配器信息
            adapter = db.query(Adapter).filter(Adapter.id == adapter_id).first()
            if adapter:
                # 创建适配器元数据文件
                adapter_info = {
                    "id": adapter.id,
                    "name": adapter.name,
                    "version": adapter.version,
                    "description": adapter.description,
                    "category": adapter.category,
                    "file_url": adapter.file_url,
                }
                
                adapter_meta_file = os.path.join(
                    adapters_dir,
                    f"{adapter.name}.json"
                )
                with open(adapter_meta_file, 'w', encoding='utf-8') as f:
                    json.dump(adapter_info, f, indent=2, ensure_ascii=False)
                
                logger.info(f"适配器元数据已创建: {adapter_meta_file}")
                
                # TODO: 实际下载适配器文件并解压
                # download_and_extract_adapter(adapter.file_url, adapters_dir)
        
        # 步骤5: 添加角色资源 (70%)
        self.update_state(state='PROGRESS', meta={'progress': 70, 'status': '添加角色资源'})
        PackagingService.update_task_status(db, task_id, status="packaging", progress=70)
        
        character_config = config.get("character", {})
        if character_config:
            characters_dir = os.path.join(base_app_dir, "characters")
            os.makedirs(characters_dir, exist_ok=True)
            
            # 创建角色配置文件
            character_file = os.path.join(characters_dir, "character.json")
            with open(character_file, 'w', encoding='utf-8') as f:
                json.dump(character_config, f, indent=2, ensure_ascii=False)
            
            logger.info(f"角色配置已创建: {character_file}")
            
            # TODO: 下载Live2D模型等资源
        
        # 步骤6: 构建安装包 (85%)
        self.update_state(state='PROGRESS', meta={'progress': 85, 'status': '构建安装包'})
        PackagingService.update_task_status(db, task_id, status="packaging", progress=85)
        
        output_file = _build_installer(base_app_dir, platform, config, task_id)
        logger.info(f"安装包已构建: {output_file}")
        
        # 步骤7: 计算哈希和大小 (90%)
        self.update_state(state='PROGRESS', meta={'progress': 90, 'status': '计算文件信息'})
        PackagingService.update_task_status(db, task_id, status="packaging", progress=90)
        
        file_hash = _calculate_hash(output_file)
        file_size = os.path.getsize(output_file)
        
        logger.info(f"文件大小: {file_size} bytes, 哈希: {file_hash}")
        
        # 步骤8: 上传到存储 (95%)
        self.update_state(state='PROGRESS', meta={'progress': 95, 'status': '上传文件'})
        PackagingService.update_task_status(db, task_id, status="packaging", progress=95)
        
        download_url = _upload_to_storage(output_file, task_id, platform)
        logger.info(f"下载链接: {download_url}")
        
        # 步骤9: 完成 (100%)
        self.update_state(state='PROGRESS', meta={'progress': 100, 'status': '完成'})
        PackagingService.update_task_status(
            db=db,
            task_id=task_id,
            status="completed",
            progress=100,
            download_url=download_url,
            file_size=file_size,
            file_hash=file_hash
        )
        
        # 清理工作目录
        shutil.rmtree(work_dir, ignore_errors=True)
        logger.info(f"打包任务完成: {task_id}")
        
        return {
            "task_id": task_id,
            "status": "completed",
            "download_url": download_url,
            "file_size": file_size,
            "file_hash": file_hash,
        }
        
    except Exception as e:
        logger.exception(f"打包任务失败: {task_id}")
        
        # 更新状态为失败
        PackagingService.update_task_status(
            db=db,
            task_id=task_id,
            status="failed",
            error_message=str(e)
        )
        
        # 清理工作目录
        if 'work_dir' in locals():
            shutil.rmtree(work_dir, ignore_errors=True)
        
        raise
        
    finally:
        db.close()


def _build_installer(
    app_dir: str,
    platform: str,
    config: Dict[str, Any],
    task_id: str
) -> str:
    """构建安装包"""
    output_dir = os.getenv("PACKAGING_OUTPUT_PATH", "/tmp/packaging_output")
    os.makedirs(output_dir, exist_ok=True)
    
    app_name = config.get("app_name", "ZishuApp")
    version = config.get("version", "1.0.0")
    
    # 简化实现：创建ZIP包
    # 实际生产环境应该根据平台构建真正的安装包（.exe, .dmg, .AppImage等）
    
    filename = f"{app_name}_{version}_{platform}_{task_id}.zip"
    output_file = os.path.join(output_dir, filename)
    
    logger.info(f"创建ZIP包: {output_file}")
    
    with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(app_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, app_dir)
                zipf.write(file_path, arcname)
    
    return output_file


def _calculate_hash(file_path: str) -> str:
    """计算文件SHA-256哈希"""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def _upload_to_storage(
    file_path: str,
    task_id: str,
    platform: str
) -> str:
    """
    上传文件到存储
    
    实际生产环境应该上传到S3或其他云存储
    这里简化为本地存储
    """
    storage_url_prefix = os.getenv("STORAGE_URL_PREFIX", "https://storage.zishu.ai")
    output_dir = os.getenv("PACKAGING_OUTPUT_PATH", "/tmp/packaging_output")
    
    filename = os.path.basename(file_path)
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 如果文件不在输出目录，复制过去
    dest_path = os.path.join(output_dir, filename)
    if os.path.abspath(file_path) != os.path.abspath(dest_path):
        shutil.copy(file_path, dest_path)
    
    logger.info(f"文件已保存到: {dest_path}")
    
    # 返回下载URL
    download_url = f"{storage_url_prefix}/packages/{filename}"
    
    # TODO: 实际上传到S3
    # s3_client = boto3.client('s3')
    # s3_client.upload_file(file_path, bucket_name, f"packages/{filename}")
    # download_url = f"https://{bucket_name}.s3.amazonaws.com/packages/{filename}"
    
    return download_url

