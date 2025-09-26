"""
情绪中间件使用示例
展示如何使用情绪处理中间件进行情绪分析和响应生成
"""

import asyncio
import json
from pathlib import Path
from typing import Dict, Any

from zishu.api.middleware.emotion import (
    EmotionMiddleware,
    initialize_emotion_middleware,
    get_emotion_middleware,
    EmotionState,
    EmotionType
)
from zishu.api.schemas.chat import CharacterConfig, PersonalityType, InteractionStyle


async def basic_emotion_analysis_example():
    """基础情绪分析示例"""
    print("=== 基础情绪分析示例 ===")
    
    # 初始化情绪中间件
    emotion_middleware = initialize_emotion_middleware()
    
    # 测试文本
    test_texts = [
        "我今天超级开心！！！",
        "唉，心情不太好...",
        "你能帮我解决这个问题吗？",
        "哇塞，这个功能太棒了！",
        "我有点困惑，不太明白",
        "谢谢你，你真的很棒~"
    ]
    
    user_id = "test_user_001"
    
    for text in test_texts:
        emotion_state = await emotion_middleware.analyze_user_emotion(
            text=text,
            user_id=user_id
        )
        
        print(f"输入: {text}")
        print(f"情绪: {emotion_state.emotion}")
        print(f"强度: {emotion_state.intensity:.2f}")
        print(f"置信度: {emotion_state.confidence:.2f}")
        print(f"触发器: {emotion_state.triggers}")
        print(f"上下文: {emotion_state.context}")
        print("-" * 50)


async def character_emotion_response_example():
    """角色情绪响应示例"""
    print("\n=== 角色情绪响应示例 ===")
    
    emotion_middleware = get_emotion_middleware()
    
    # 创建测试角色配置
    character_config = CharacterConfig(
        name="紫舒",
        display_name="紫舒",
        description="温柔可爱的AI助手",
        personality_type=PersonalityType.SHY,
        interaction_style=InteractionStyle.CASUAL,
        emotion_stability=0.6
    )
    
    user_id = "test_user_002"
    
    # 模拟对话场景
    conversations = [
        {
            "user_text": "你好紫舒，我今天很开心！",
            "base_response": "你好！很高兴见到你。"
        },
        {
            "user_text": "我遇到了一些困难，感觉很沮丧",
            "base_response": "我理解你的感受，我会尽力帮助你的。"
        },
        {
            "user_text": "哇，你的回答太棒了！",
            "base_response": "谢谢你的夸奖。"
        }
    ]
    
    for i, conv in enumerate(conversations):
        print(f"\n对话 {i+1}:")
        print(f"用户: {conv['user_text']}")
        
        # 分析用户情绪
        user_emotion = await emotion_middleware.analyze_user_emotion(
            text=conv['user_text'],
            user_id=user_id
        )
        
        # 生成角色响应情绪
        response_emotion = await emotion_middleware.generate_response_emotion(
            user_emotion=user_emotion,
            character_config=character_config,
            user_id=user_id
        )
        
        # 增强响应
        enhanced_response = await emotion_middleware.enhance_response(
            base_response=conv['base_response'],
            emotion_state=response_emotion,
            character_config=character_config
        )
        
        print(f"用户情绪: {user_emotion.emotion} (强度: {user_emotion.intensity:.2f})")
        print(f"角色情绪: {response_emotion.emotion} (强度: {response_emotion.intensity:.2f})")
        print(f"原始回复: {conv['base_response']}")
        print(f"增强回复: {enhanced_response['text']}")
        print(f"建议语音: {enhanced_response.get('voice_style', 'N/A')}")
        print(f"建议动画: {enhanced_response.get('animation', 'N/A')}")
        print("-" * 60)


async def emotion_memory_example():
    """情绪记忆示例"""
    print("\n=== 情绪记忆示例 ===")
    
    emotion_middleware = get_emotion_middleware()
    user_id = "test_user_003"
    
    # 模拟连续对话，观察情绪记忆的影响
    continuous_conversation = [
        "我今天心情不太好",
        "工作上遇到了一些挫折",
        "感觉有点想放弃了",
        "不过，我想我应该坚持下去",
        "谢谢你一直在听我说话"
    ]
    
    print("连续对话中的情绪变化:")
    for i, text in enumerate(continuous_conversation):
        emotion_state = await emotion_middleware.analyze_user_emotion(
            text=text,
            user_id=user_id
        )
        
        print(f"轮次 {i+1}: {text}")
        print(f"  情绪: {emotion_state.emotion}")
        print(f"  强度: {emotion_state.intensity:.2f}")
        print(f"  置信度: {emotion_state.confidence:.2f}")
        
        # 稍等一下模拟真实对话间隔
        await asyncio.sleep(0.1)
    
    # 显示情绪记忆统计
    stats = emotion_middleware.get_stats()
    print(f"\n情绪处理统计:")
    print(f"  总请求数: {stats['total_requests']}")
    print(f"  检测到情绪的请求: {stats['emotion_detected']}")
    print(f"  情绪转换次数: {stats['transitions_made']}")
    print(f"  平均处理时间: {stats['average_processing_time']:.4f}s")
    print(f"  记忆条目数: {stats['memory_entries']}")


async def custom_emotion_pattern_example():
    """自定义情绪模式示例"""
    print("\n=== 自定义情绪模式示例 ===")
    
    # 创建带有自定义配置的情绪中间件
    custom_config = {
        'primary_analyzer': 'rule_based',
        'enable_transition': True,
        'enable_memory': True
    }
    
    emotion_middleware = initialize_emotion_middleware(custom_config)
    
    # 测试自定义情绪识别
    custom_texts = [
        "我超级无敌开心！！！",
        "这个功能简直太赞了，爱了爱了",
        "emmm...让我想想",
        "哎呀，我好像搞错了什么",
        "你说得对，我明白了"
    ]
    
    user_id = "test_user_004"
    
    for text in custom_texts:
        emotion_state = await emotion_middleware.analyze_user_emotion(
            text=text,
            user_id=user_id
        )
        
        print(f"输入: {text}")
        print(f"识别结果: {emotion_state.emotion} (强度: {emotion_state.intensity:.2f})")
        print(f"触发因子: {', '.join(emotion_state.triggers[:3])}")
        print("-" * 40)


async def performance_test_example():
    """性能测试示例"""
    print("\n=== 性能测试示例 ===")
    
    emotion_middleware = get_emotion_middleware()
    
    # 批量测试
    test_count = 100
    test_text = "我今天心情很好，工作也很顺利！"
    user_id = "performance_test_user"
    
    import time
    start_time = time.time()
    
    tasks = []
    for i in range(test_count):
        task = emotion_middleware.analyze_user_emotion(
            text=f"{test_text} #{i}",
            user_id=f"{user_id}_{i}"
        )
        tasks.append(task)
    
    # 并发执行
    results = await asyncio.gather(*tasks)
    
    end_time = time.time()
    total_time = end_time - start_time
    
    print(f"处理 {test_count} 个请求:")
    print(f"  总耗时: {total_time:.2f}s")
    print(f"  平均耗时: {total_time/test_count*1000:.2f}ms/请求")
    print(f"  QPS: {test_count/total_time:.2f}")
    
    # 统计结果分布
    emotion_counts = {}
    for result in results:
        emotion = result.emotion
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
    
    print(f"\n情绪分布:")
    for emotion, count in emotion_counts.items():
        print(f"  {emotion}: {count} ({count/test_count*100:.1f}%)")


def load_emotion_config_example():
    """加载情绪配置示例"""
    print("\n=== 加载情绪配置示例 ===")
    
    config_path = Path("configs/emotion_config.json")
    
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        print("加载的配置:")
        print(json.dumps(config['emotion_middleware'], indent=2, ensure_ascii=False))
        
        # 使用配置初始化中间件
        emotion_config = config['emotion_middleware']
        emotion_middleware = initialize_emotion_middleware(emotion_config)
        
        print(f"\n中间件配置状态:")
        stats = emotion_middleware.get_stats()
        print(f"  可用分析器: {stats['analyzers']}")
        print(f"  当前配置: {stats['config']}")
    else:
        print("配置文件不存在，使用默认配置")


async def main():
    """主函数"""
    print("🎭 情绪中间件使用示例")
    print("=" * 80)
    
    try:
        # 基础功能示例
        await basic_emotion_analysis_example()
        
        # 角色响应示例
        await character_emotion_response_example()
        
        # 情绪记忆示例
        await emotion_memory_example()
        
        # 自定义模式示例
        await custom_emotion_pattern_example()
        
        # 性能测试示例
        await performance_test_example()
        
        # 配置加载示例
        load_emotion_config_example()
        
        print("\n🎉 所有示例执行完成！")
        
    except Exception as e:
        print(f"❌ 执行过程中出现错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
