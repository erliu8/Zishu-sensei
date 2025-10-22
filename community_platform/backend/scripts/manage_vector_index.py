#!/usr/bin/env python3
"""
向量索引管理工具

用于管理 Qdrant 向量索引：
- 重新索引所有帖子
- 索引新帖子
- 删除索引
- 查看索引状态
"""
import asyncio
import sys
import os
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.db.qdrant import qdrant_manager
from app.models.post import Post
from app.services.search import get_vector_search_service, get_embedding_service


async def init_qdrant():
    """初始化 Qdrant 连接"""
    print("🔌 连接到 Qdrant...")
    await qdrant_manager.connect()
    print("✅ Qdrant 连接成功\n")


async def get_index_status():
    """获取索引状态"""
    print("📊 获取索引状态...\n")
    
    # 获取集合信息
    info = await qdrant_manager.get_collection_info()
    if info:
        print(f"集合名称: {qdrant_manager.collection_name}")
        print(f"向量维度: {qdrant_manager.vector_size}")
        print(f"点数量: {info.get('points_count', 0)}")
        print(f"向量数量: {info.get('vectors_count', 0)}")
    else:
        print("⚠️  无法获取集合信息")
    
    # 获取数据库中的帖子数量
    async with async_session_maker() as db:
        result = await db.execute(
            select(Post).where(Post.is_published == True)
        )
        posts = list(result.scalars().all())
        print(f"已发布帖子数量: {len(posts)}")
    
    print()


async def reindex_all():
    """重新索引所有帖子"""
    print("🔄 开始重新索引所有帖子...\n")
    
    async with async_session_maker() as db:
        vector_service = get_vector_search_service(db)
        
        # 获取所有已发布的帖子
        result = await db.execute(
            select(Post).where(Post.is_published == True)
        )
        posts = list(result.scalars().all())
        
        print(f"找到 {len(posts)} 个已发布的帖子")
        
        if not posts:
            print("⚠️  没有需要索引的帖子")
            return
        
        # 批量索引
        success_count = await vector_service.batch_index_posts(posts, batch_size=50)
        
        print(f"\n✅ 完成！成功索引 {success_count}/{len(posts)} 个帖子")


async def index_post(post_id: int):
    """索引单个帖子"""
    print(f"📝 索引帖子 ID: {post_id}...\n")
    
    async with async_session_maker() as db:
        # 获取帖子
        result = await db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        
        if not post:
            print(f"❌ 帖子不存在: {post_id}")
            return
        
        # 索引帖子
        vector_service = get_vector_search_service(db)
        success = await vector_service.index_post(post)
        
        if success:
            print(f"✅ 成功索引帖子: {post.title}")
        else:
            print(f"❌ 索引失败")


async def delete_index(post_id: int):
    """删除帖子索引"""
    print(f"🗑️  删除帖子索引 ID: {post_id}...\n")
    
    async with async_session_maker() as db:
        vector_service = get_vector_search_service(db)
        success = await vector_service.delete_post_index(post_id)
        
        if success:
            print(f"✅ 成功删除索引")
        else:
            print(f"❌ 删除失败")


async def test_search(query: str, limit: int = 5):
    """测试向量搜索"""
    print(f"🔍 测试搜索: \"{query}\"\n")
    
    async with async_session_maker() as db:
        vector_service = get_vector_search_service(db)
        
        results = await vector_service.search_similar_posts(
            query=query,
            limit=limit,
            score_threshold=0.5,
        )
        
        if not results:
            print("⚠️  没有找到相关结果")
            return
        
        print(f"找到 {len(results)} 个相关帖子:\n")
        
        for i, (post, score) in enumerate(results, 1):
            print(f"{i}. [{score:.3f}] {post.title}")
            print(f"   ID: {post.id} | 分类: {post.category}")
            print(f"   内容: {post.content[:100]}...")
            print()


async def test_embedding():
    """测试嵌入服务"""
    print("🧪 测试嵌入服务...\n")
    
    embedding_service = get_embedding_service()
    
    # 测试文本
    test_texts = [
        "如何学习 Python 编程？",
        "人工智能的未来发展趋势",
        "健康饮食的重要性",
    ]
    
    print(f"向量维度: {embedding_service.vector_size}")
    print(f"\n正在生成 {len(test_texts)} 个文本的向量...\n")
    
    vectors = await embedding_service.encode(test_texts)
    
    for i, (text, vector) in enumerate(zip(test_texts, vectors), 1):
        print(f"{i}. \"{text}\"")
        print(f"   向量长度: {len(vector)}")
        print(f"   前5个值: {vector[:5]}")
        print()
    
    # 测试相似度
    print("计算文本1和文本2的相似度:")
    similarity = embedding_service.calculate_similarity(vectors[0], vectors[1])
    print(f"相似度: {similarity:.3f}\n")
    
    print("✅ 嵌入服务测试完成")


async def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("""
向量索引管理工具

用法:
  python scripts/manage_vector_index.py <command> [args]

命令:
  status              - 查看索引状态
  reindex             - 重新索引所有帖子
  index <post_id>     - 索引单个帖子
  delete <post_id>    - 删除帖子索引
  search <query>      - 测试向量搜索
  test-embedding      - 测试嵌入服务

示例:
  python scripts/manage_vector_index.py status
  python scripts/manage_vector_index.py reindex
  python scripts/manage_vector_index.py index 1
  python scripts/manage_vector_index.py search "Python编程"
  python scripts/manage_vector_index.py test-embedding
        """)
        return
    
    command = sys.argv[1].lower()
    
    try:
        # 初始化 Qdrant
        await init_qdrant()
        
        if command == "status":
            await get_index_status()
        
        elif command == "reindex":
            await reindex_all()
        
        elif command == "index":
            if len(sys.argv) < 3:
                print("❌ 请提供帖子 ID")
                return
            post_id = int(sys.argv[2])
            await index_post(post_id)
        
        elif command == "delete":
            if len(sys.argv) < 3:
                print("❌ 请提供帖子 ID")
                return
            post_id = int(sys.argv[2])
            await delete_index(post_id)
        
        elif command == "search":
            if len(sys.argv) < 3:
                print("❌ 请提供搜索查询")
                return
            query = " ".join(sys.argv[2:])
            await test_search(query)
        
        elif command == "test-embedding":
            await test_embedding()
        
        else:
            print(f"❌ 未知命令: {command}")
            print("运行不带参数以查看帮助")
    
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # 清理
        await qdrant_manager.disconnect()


if __name__ == "__main__":
    asyncio.run(main())

