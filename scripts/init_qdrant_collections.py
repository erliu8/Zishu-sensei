#!/usr/bin/env python3
"""
Qdrant向量集合初始化脚本

该脚本用于初始化Qdrant中的所有向量集合，包括：
1. adapters_semantic - 适配器语义搜索
2. knowledge_base - 知识库RAG
3. conversation_history - 对话历史搜索
4. user_documents - 用户文档搜索
5. code_snippets - 代码片段搜索
"""

import os
import sys
import logging
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from zishu.vector.qdrant_client import QdrantManager
import yaml


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_collection_configs(config_path: str) -> dict:
    """加载集合配置"""
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        return config.get("collections", {})
    except Exception as e:
        logger.error(f"加载配置文件失败: {e}")
        return {}


def init_collections(qdrant_manager: QdrantManager, collections_config: dict):
    """初始化所有集合"""
    success_count = 0
    failed_count = 0
    
    for collection_name, config in collections_config.items():
        logger.info(f"\n{'='*60}")
        logger.info(f"正在创建集合: {collection_name}")
        logger.info(f"描述: {config.get('description', 'N/A')}")
        logger.info(f"向量维度: {config.get('vector_size', 1536)}")
        logger.info(f"距离度量: {config.get('distance', 'Cosine')}")
        
        try:
            # 检查集合是否已存在
            if qdrant_manager.collection_exists(collection_name):
                logger.warning(f"集合 {collection_name} 已存在，跳过创建")
                
                # 显示集合信息
                info = qdrant_manager.get_collection_info(collection_name)
                if info:
                    logger.info(f"  - 点数量: {info['points_count']}")
                    logger.info(f"  - 向量数量: {info['vectors_count']}")
                    logger.info(f"  - 状态: {info['status']}")
                
                success_count += 1
                continue
            
            # 创建集合
            result = qdrant_manager.create_collection(
                collection_name=collection_name,
                vector_size=config.get("vector_size", 1536),
                distance=config.get("distance", "Cosine"),
                on_disk_payload=config.get("on_disk_payload", True),
                replication_factor=config.get("replication_factor", 1),
                write_consistency_factor=config.get("write_consistency_factor", 1),
                hnsw_config=config.get("hnsw_config"),
                optimizer_config=config.get("optimizer_config"),
            )
            
            if result:
                logger.info(f"✓ 集合 {collection_name} 创建成功")
                success_count += 1
            else:
                logger.error(f"✗ 集合 {collection_name} 创建失败")
                failed_count += 1
                
        except Exception as e:
            logger.error(f"✗ 创建集合 {collection_name} 时出错: {e}")
            failed_count += 1
    
    return success_count, failed_count


def main():
    """主函数"""
    logger.info("="*60)
    logger.info("Qdrant向量集合初始化脚本")
    logger.info("="*60)
    
    # 获取配置
    config_path = os.path.join(project_root, "config/services/qdrant.yml")
    logger.info(f"\n配置文件: {config_path}")
    
    # 加载集合配置
    collections_config = load_collection_configs(config_path)
    if not collections_config:
        logger.error("未找到集合配置，退出")
        return 1
    
    logger.info(f"找到 {len(collections_config)} 个集合配置")
    
    # 获取连接参数
    qdrant_host = os.getenv("QDRANT_HOST", "localhost")
    qdrant_port = int(os.getenv("QDRANT_PORT", "6333"))
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    
    logger.info(f"\nQdrant连接信息:")
    logger.info(f"  - 主机: {qdrant_host}")
    logger.info(f"  - 端口: {qdrant_port}")
    logger.info(f"  - API密钥: {'已设置' if qdrant_api_key else '未设置'}")
    
    try:
        # 初始化Qdrant管理器
        logger.info("\n正在连接Qdrant...")
        qdrant_manager = QdrantManager(
            host=qdrant_host,
            port=qdrant_port,
            api_key=qdrant_api_key,
            config_path=config_path,
        )
        
        # 健康检查
        if not qdrant_manager.health_check():
            logger.error("Qdrant健康检查失败，请检查服务是否运行")
            return 1
        
        logger.info("✓ Qdrant连接成功")
        
        # 初始化集合
        logger.info("\n开始创建集合...")
        success_count, failed_count = init_collections(qdrant_manager, collections_config)
        
        # 总结
        logger.info("\n" + "="*60)
        logger.info("初始化完成!")
        logger.info(f"  - 成功: {success_count}")
        logger.info(f"  - 失败: {failed_count}")
        logger.info(f"  - 总计: {len(collections_config)}")
        logger.info("="*60)
        
        return 0 if failed_count == 0 else 1
        
    except Exception as e:
        logger.error(f"\n初始化过程中出错: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

