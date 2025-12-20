#!/usr/bin/env python
"""
情绪日记功能测试脚本

使用方法:
python test_mood_diary.py

功能:
1. 测试情绪日记记录功能
2. 测试情绪日记回顾功能
3. 验证用户隔离
4. 验证持久化存储
"""

import asyncio
import json
import aiohttp
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 测试配置
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
# Server may expose routes under multiple prefixes (e.g. /api/v1 and /api).
API_PREFIXES = [p for p in [os.getenv("API_PREFIX"), "/api/v1", "/api", ""] if p is not None]
TEST_USER_ID = "test_user_001"
TEST_USER_ID_2 = "test_user_002"

# If you enable header-based user override (ALLOW_HEADER_USER_ID=1), the backend
# expects UUID user IDs (DB FK points to users.id).
TEST_USER_ID = os.getenv("TEST_USER_ID", TEST_USER_ID)
TEST_USER_ID_2 = os.getenv("TEST_USER_ID_2", TEST_USER_ID_2)
if TEST_USER_ID == "test_user_001":
    TEST_USER_ID = str(uuid.uuid4())
if TEST_USER_ID_2 == "test_user_002":
    TEST_USER_ID_2 = str(uuid.uuid4())

# 测试 token（实际使用时需要替换为真实的认证 token）
TEST_TOKEN = "test_token"

# 测试用例
TEST_ENTRIES = [
    {
        "turn": {
            "user_text": "我今天心情不太好，工作上遇到了一些困难",
            "assistant_text": "我在，你愿意多说一点吗？我在听。",
            "ts": datetime.now(timezone.utc).isoformat()
        },
        "context": {
            "conversation_id": "conv_001",
            "character_id": "char_001",
            "source": "chat"
        }
    },
    {
        "turn": {
            "user_text": "今天和朋友聊天很开心，感觉心情好多了",
            "assistant_text": "很高兴听到你心情变好了，朋友的支持真的很重要。",
            "ts": datetime.now(timezone.utc).isoformat()
        },
        "context": {
            "conversation_id": "conv_002",
            "character_id": "char_001",
            "source": "chat"
        }
    },
    {
        "turn": {
            "user_text": "最近工作压力很大，感觉有些焦虑",
            "assistant_text": "我能理解你的感受。工作压力确实会让人焦虑，要记得适当放松。",
            "ts": datetime.now(timezone.utc).isoformat()
        },
        "context": {
            "conversation_id": "conv_003",
            "character_id": "char_001",
            "source": "chat"
        }
    }
]


async def test_record_mood(session: aiohttp.ClientSession, user_id: str, entry_data: dict) -> dict:
    """测试记录情绪日记"""
    logger.info(f"Testing mood record for user {user_id}")

    path = "/skills/skill.builtin.mood.record/execute"
    headers = {
        "Authorization": f"Bearer {TEST_TOKEN}",
        "Content-Type": "application/json"
    }

    # 模拟用户认证（实际使用时需要替换为真实的认证）
    headers["X-User-ID"] = user_id

    for prefix in API_PREFIXES:
        url = f"{API_BASE_URL}{prefix}{path}"
        async with session.post(url, json=entry_data, headers=headers) as response:
            if response.status == 404:
                continue
            if response.status == 200:
                result = await response.json()
                logger.info(f"Record successful: {json.dumps(result, indent=2, ensure_ascii=False)}")
                return result
            error_text = await response.text()
            logger.error(f"Record failed with status {response.status}: {error_text}")
            return None

    logger.error(f"Record failed: endpoint not found under prefixes {API_PREFIXES}")
    return None


async def test_review_mood(session: aiohttp.ClientSession, user_id: str, filters: dict = None) -> dict:
    """测试回顾情绪日记"""
    logger.info(f"Testing mood review for user {user_id}")

    path = "/skills/skill.builtin.mood.review/execute"
    headers = {
        "Authorization": f"Bearer {TEST_TOKEN}",
        "Content-Type": "application/json"
    }

    # 模拟用户认证
    headers["X-User-ID"] = user_id

    # 默认过滤器
    if filters is None:
        filters = {"limit": 10}

    for prefix in API_PREFIXES:
        url = f"{API_BASE_URL}{prefix}{path}"
        async with session.post(url, json=filters, headers=headers) as response:
            if response.status == 404:
                continue
            if response.status == 200:
                result = await response.json()
                logger.info(f"Review successful: {json.dumps(result, indent=2, ensure_ascii=False)}")
                return result
            error_text = await response.text()
            logger.error(f"Review failed with status {response.status}: {error_text}")
            return None

    logger.error(f"Review failed: endpoint not found under prefixes {API_PREFIXES}")
    return None


async def run_smoke_test():
    """运行冒烟测试"""
    logger.info("Starting mood diary smoke test...")
    failed = False

    async with aiohttp.ClientSession() as session:
        # 测试 1: 记录多条日记（用户1）
        logger.info("\n=== Test 1: Recording entries for user 1 ===")
        for i, entry in enumerate(TEST_ENTRIES):
            logger.info(f"\nRecording entry {i+1}")
            result = await test_record_mood(session, TEST_USER_ID, entry)
            if result:
                logger.info(f"✓ Entry {i+1} recorded successfully")
            else:
                logger.error(f"✗ Failed to record entry {i+1}")
                failed = True

        # 等待一下确保写入完成
        await asyncio.sleep(1)

        # 测试 2: 回顾日记（用户1）
        logger.info("\n=== Test 2: Reviewing entries for user 1 ===")
        review_result = await test_review_mood(session, TEST_USER_ID, {"limit": 5})
        if review_result and review_result.get("data", {}).get("result", {}).get("items"):
            items = review_result["data"]["result"]["items"]
            logger.info(f"✓ Found {len(items)} entries for user 1")

            # 验证数量
            if len(items) >= 3:
                logger.info("✓ All 3 entries found")
            else:
                logger.warning(f"Expected 3 entries, found {len(items)}")
        else:
            logger.error("✗ Failed to review entries for user 1")
            failed = True

        # 测试 3: 按情绪过滤
        logger.info("\n=== Test 3: Filtering by mood ===")
        mood_filter = {
            "mood": ["happy"],
            "limit": 10
        }
        mood_result = await test_review_mood(session, TEST_USER_ID, mood_filter)
        if mood_result and mood_result.get("data", {}).get("result", {}).get("items"):
            items = mood_result["data"]["result"]["items"]
            logger.info(f"✓ Found {len(items)} happy entries")
        else:
            logger.error("✗ Failed to filter by mood")
            failed = True

        # 测试 4: 用户隔离测试
        logger.info("\n=== Test 4: User isolation test ===")
        # 记录一条用户2的日记
        user2_entry = {
            "turn": {
                "user_text": "这是用户2的私密日记",
                "assistant_text": "我会保密的。",
                "ts": datetime.now(timezone.utc).isoformat()
            },
            "context": {
                "conversation_id": "conv_999",
                "character_id": "char_999",
                "source": "chat"
            }
        }

        await test_record_mood(session, TEST_USER_ID_2, user2_entry)
        await asyncio.sleep(1)

        # 用户1回顾，不应该看到用户2的日记
        user1_review = await test_review_mood(session, TEST_USER_ID)
        user2_review = await test_review_mood(session, TEST_USER_ID_2)

        if (user1_review and user2_review and
            user1_review["data"]["result"]["items"] and
            user2_review["data"]["result"]["items"]):

            user1_count = len(user1_review["data"]["result"]["items"])
            user2_count = len(user2_review["data"]["result"]["items"])

            logger.info(f"✓ User 1 has {user1_count} entries")
            logger.info(f"✓ User 2 has {user2_count} entries")

            # 验证用户1看不到用户2的内容
            if all(entry.get("user_id") != TEST_USER_ID_2 for entry in user1_review["data"]["result"]["items"]):
                logger.info("✓ User isolation working correctly")
            else:
                logger.error("✗ User isolation failed!")
        else:
            logger.error("✗ User isolation test failed")
            failed = True

        # 测试 5: 统计信息验证
        logger.info("\n=== Test 5: Summary statistics ===")
        review_result = await test_review_mood(session, TEST_USER_ID)
        if review_result and review_result.get("data", {}).get("result", {}).get("summary"):
            summary = review_result["data"]["result"]["summary"]
            logger.info(f"Summary: {json.dumps(summary, indent=2, ensure_ascii=False)}")

            if "mood_counts" in summary and "topic_counts" in summary:
                logger.info("✓ Summary statistics present")
            else:
                logger.error("✗ Missing summary statistics")
        else:
            logger.error("✗ Failed to get summary statistics")
            failed = True

    logger.info("\n=== Smoke test completed ===")

    if failed:
        raise RuntimeError("Smoke test failed (see logs above)")


async def main():
    """主函数"""
    print("Mood Diary Smoke Test")
    print("=" * 50)
    print("This script tests the mood diary functionality.")
    print("Make sure the API server is running on http://localhost:8000")
    print("=" * 50)
    print()

    try:
        await run_smoke_test()
        print("\n✅ All tests completed!")
    except Exception as e:
        logger.error(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
