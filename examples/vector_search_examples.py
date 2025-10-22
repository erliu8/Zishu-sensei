#!/usr/bin/env python3
"""
Qdrant语义搜索示例代码

展示如何使用Zishu-Sensei的向量搜索功能：
1. 适配器语义搜索
2. 知识库检索（RAG）
3. 对话历史搜索
4. 批量数据导入
"""

import os
import sys
from pathlib import Path
from uuid import uuid4

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from zishu.vector import SemanticSearchService


def example_1_adapter_search():
    """示例1: 适配器语义搜索"""
    print("\n" + "="*60)
    print("示例1: 适配器语义搜索")
    print("="*60)
    
    # 初始化服务
    search_service = SemanticSearchService()
    
    # 添加示例适配器
    print("\n1. 添加示例适配器...")
    adapters = [
        {
            "adapter_id": str(uuid4()),
            "name": "Excel报表生成器",
            "description": "自动生成Excel格式的数据报表，支持图表、格式化和数据透视表",
            "type": "intelligent_hard",
            "category": "办公自动化",
            "tags": ["Excel", "报表", "数据分析", "自动化"],
            "rating": 4.5,
            "downloads": 1250,
        },
        {
            "adapter_id": str(uuid4()),
            "name": "PDF文档解析器",
            "description": "智能解析PDF文档，提取文本、表格和图片内容",
            "type": "intelligent_hard",
            "category": "文档处理",
            "tags": ["PDF", "文档解析", "OCR", "数据提取"],
            "rating": 4.2,
            "downloads": 890,
        },
        {
            "adapter_id": str(uuid4()),
            "name": "代码质量检查器",
            "description": "自动检查代码质量，发现潜在bug和性能问题",
            "type": "intelligent_soft",
            "category": "开发工具",
            "tags": ["代码", "质量", "检查", "开发"],
            "rating": 4.8,
            "downloads": 2100,
        },
    ]
    
    added = search_service.batch_add_adapters(adapters, show_progress=True)
    print(f"成功添加 {added} 个适配器")
    
    # 搜索适配器
    print("\n2. 搜索适配器...")
    queries = [
        "我需要一个能自动生成Excel报表的工具",
        "如何解析PDF文件中的表格数据",
        "帮我找一个代码审查工具",
    ]
    
    for query in queries:
        print(f"\n查询: {query}")
        results = search_service.search_adapters(query, limit=3)
        
        for i, result in enumerate(results, 1):
            print(f"  {i}. {result['name']} (评分: {result['rating']}, 相似度: {result['score']:.3f})")
            print(f"     {result['description'][:60]}...")


def example_2_knowledge_base():
    """示例2: 知识库检索"""
    print("\n" + "="*60)
    print("示例2: 知识库检索（RAG）")
    print("="*60)
    
    # 初始化服务
    search_service = SemanticSearchService()
    
    # 添加知识片段
    print("\n1. 添加知识片段...")
    knowledge_chunks = [
        {
            "chunk_id": str(uuid4()),
            "source_type": "adapter_doc",
            "source_id": "adapter_001",
            "title": "适配器开发指南 - 第1章",
            "content": """
            适配器是Zishu-Sensei的核心扩展机制。开发适配器需要遵循以下步骤：
            1. 定义适配器接口
            2. 实现核心功能
            3. 编写配置文件
            4. 添加测试用例
            适配器分为智能硬适配器和智能软适配器两种类型。
            """,
            "metadata": {
                "page": 1,
                "section": "入门",
                "language": "zh-CN",
            },
        },
        {
            "chunk_id": str(uuid4()),
            "source_type": "adapter_doc",
            "source_id": "adapter_001",
            "title": "适配器开发指南 - 第2章",
            "content": """
            智能硬适配器提供具体的功能实现，如数据处理、文件操作等。
            开发硬适配器时需要注意：
            - 性能优化：避免阻塞操作
            - 错误处理：优雅地处理异常
            - 资源管理：及时释放资源
            - 安全性：验证输入参数
            """,
            "metadata": {
                "page": 2,
                "section": "硬适配器",
                "language": "zh-CN",
            },
        },
    ]
    
    for chunk in knowledge_chunks:
        success = search_service.add_knowledge_chunk(**chunk)
        if success:
            print(f"  ✓ 添加知识片段: {chunk['title']}")
    
    # 检索知识
    print("\n2. 检索知识...")
    queries = [
        "如何开发一个适配器？",
        "硬适配器开发时要注意什么？",
    ]
    
    for query in queries:
        print(f"\n查询: {query}")
        results = search_service.search_knowledge_base(query, limit=2)
        
        for i, result in enumerate(results, 1):
            print(f"  {i}. {result['title']} (相似度: {result['score']:.3f})")
            print(f"     {result['content'].strip()[:100]}...")


def example_3_conversation_history():
    """示例3: 对话历史搜索"""
    print("\n" + "="*60)
    print("示例3: 对话历史搜索")
    print("="*60)
    
    # 初始化服务
    search_service = SemanticSearchService()
    
    # 添加对话消息
    print("\n1. 添加对话消息...")
    conversation_id = str(uuid4())
    user_id = "user_001"
    
    messages = [
        {
            "message_id": str(uuid4()),
            "conversation_id": conversation_id,
            "user_id": user_id,
            "role": "user",
            "content": "如何使用Python进行数据分析？",
            "summary": "询问Python数据分析方法",
        },
        {
            "message_id": str(uuid4()),
            "conversation_id": conversation_id,
            "user_id": user_id,
            "role": "assistant",
            "content": "Python数据分析主要使用pandas、numpy和matplotlib等库。首先导入数据，然后进行清洗和转换，最后可视化结果。",
            "summary": "介绍Python数据分析工具",
            "adapters_used": ["pandas_helper", "data_viz"],
        },
        {
            "message_id": str(uuid4()),
            "conversation_id": conversation_id,
            "user_id": user_id,
            "role": "user",
            "content": "能推荐一些机器学习的资源吗？",
            "summary": "请求机器学习学习资源",
        },
    ]
    
    for msg in messages:
        success = search_service.add_conversation_message(**msg)
        if success:
            print(f"  ✓ 添加消息: {msg['role']} - {msg['content'][:30]}...")
    
    # 搜索历史对话
    print("\n2. 搜索历史对话...")
    queries = [
        "上次我问的关于数据分析的问题",
        "机器学习相关的讨论",
    ]
    
    for query in queries:
        print(f"\n查询: {query}")
        results = search_service.search_conversation_history(
            query,
            user_id=user_id,
            limit=2
        )
        
        for i, result in enumerate(results, 1):
            print(f"  {i}. [{result['role']}] {result['content'][:50]}... (相似度: {result['score']:.3f})")


def example_4_batch_operations():
    """示例4: 批量操作"""
    print("\n" + "="*60)
    print("示例4: 批量数据导入")
    print("="*60)
    
    # 初始化服务
    search_service = SemanticSearchService()
    
    # 批量添加适配器
    print("\n批量添加50个模拟适配器...")
    
    categories = ["办公自动化", "数据分析", "文档处理", "开发工具", "AI助手"]
    types = ["intelligent_hard", "intelligent_soft"]
    
    adapters = []
    for i in range(50):
        adapters.append({
            "adapter_id": str(uuid4()),
            "name": f"测试适配器{i+1}",
            "description": f"这是第{i+1}个测试适配器，用于演示批量导入功能",
            "type": types[i % 2],
            "category": categories[i % 5],
            "tags": ["测试", f"标签{i%3}", f"类别{i%5}"],
            "rating": 3.0 + (i % 20) * 0.1,
            "downloads": i * 10,
        })
    
    added = search_service.batch_add_adapters(adapters, show_progress=True)
    print(f"\n成功添加 {added} 个适配器")
    
    # 获取集合信息
    print("\n集合信息:")
    info = search_service.qdrant.get_collection_info("adapters_semantic")
    if info:
        print(f"  - 集合名称: {info['name']}")
        print(f"  - 点数量: {info['points_count']}")
        print(f"  - 向量数量: {info['vectors_count']}")
        print(f"  - 状态: {info['status']}")


def example_5_health_check():
    """示例5: 健康检查"""
    print("\n" + "="*60)
    print("示例5: 服务健康检查")
    print("="*60)
    
    # 初始化服务
    search_service = SemanticSearchService()
    
    # 执行健康检查
    print("\n正在检查服务健康状态...")
    is_healthy = search_service.health_check()
    
    if is_healthy:
        print("✓ 服务状态正常")
        
        # 显示缓存信息
        cache_size = search_service.embedding.get_cache_size()
        print(f"  - Embedding缓存大小: {cache_size}")
        print(f"  - 向量维度: {search_service.embedding.get_vector_dimension()}")
    else:
        print("✗ 服务状态异常，请检查配置")


def main():
    """主函数"""
    print("\n" + "="*70)
    print(" "*15 + "Zishu-Sensei 向量搜索示例")
    print("="*70)
    
    try:
        # 运行示例
        example_5_health_check()
        example_1_adapter_search()
        example_2_knowledge_base()
        example_3_conversation_history()
        example_4_batch_operations()
        
        print("\n" + "="*70)
        print("所有示例运行完成!")
        print("="*70 + "\n")
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

