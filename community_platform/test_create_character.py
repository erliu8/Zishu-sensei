#!/usr/bin/env python3
"""
测试创建角色 API
"""
import requests
import json

# API 配置
BASE_URL = "http://localhost:8001/api/v1"
LOGIN_URL = f"{BASE_URL}/auth/login"
CREATE_CHARACTER_URL = f"{BASE_URL}/characters"

# 测试用户
TEST_USER = {
    "username": "admin",
    "password": "admin123"
}

def get_auth_token():
    """获取认证令牌"""
    response = requests.post(LOGIN_URL, json=TEST_USER)
    if response.status_code == 200:
        data = response.json()
        if data.get("success"):
            return data.get("data", {}).get("accessToken")
    print(f"登录失败: {response.status_code}")
    print(response.text)
    return None

def test_create_minimal_character(token):
    """测试创建最小化角色（无 config）"""
    print("\n=== 测试 1: 创建最小化角色（无 config）===")
    
    character_data = {
        "name": "test-character",
        "displayName": "测试角色",
        "description": "这是一个测试角色",
        "tags": [],
        "visibility": "private",
        "version": "1.0.0",
        "adapters": []
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"请求数据: {json.dumps(character_data, indent=2, ensure_ascii=False)}")
    response = requests.post(CREATE_CHARACTER_URL, json=character_data, headers=headers)
    print(f"响应状态: {response.status_code}")
    print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    return response.status_code == 200

def test_create_character_with_prompt_config(token):
    """测试创建带提示词工程配置的角色"""
    print("\n=== 测试 2: 创建带提示词工程配置的角色 ===")
    
    character_data = {
        "name": "test-character-2",
        "displayName": "测试角色2",
        "description": "这是一个带AI配置的测试角色",
        "tags": ["测试"],
        "visibility": "private",
        "version": "1.0.0",
        "adapters": [],
        "config": {
            "aiModel": {
                "type": "prompt_engineering",
                "provider": "openai",
                "modelId": "gpt-4",
                "modelName": "GPT-4",
                "systemPrompt": "你是一个友好的AI助手",
                "characterPrompt": "以友好的方式回答用户问题"
            }
        }
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"请求数据: {json.dumps(character_data, indent=2, ensure_ascii=False)}")
    response = requests.post(CREATE_CHARACTER_URL, json=character_data, headers=headers)
    print(f"响应状态: {response.status_code}")
    print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    return response.status_code == 200

def main():
    print("开始测试创建角色 API...")
    
    # 1. 获取认证令牌
    print("\n获取认证令牌...")
    token = get_auth_token()
    if not token:
        print("❌ 无法获取认证令牌，测试终止")
        return
    print(f"✅ 成功获取令牌: {token[:20]}...")
    
    # 2. 测试创建最小化角色
    success1 = test_create_minimal_character(token)
    
    # 3. 测试创建带配置的角色
    success2 = test_create_character_with_prompt_config(token)
    
    # 总结
    print("\n" + "="*50)
    print("测试结果:")
    print(f"  最小化角色: {'✅ 成功' if success1 else '❌ 失败'}")
    print(f"  带配置角色: {'✅ 成功' if success2 else '❌ 失败'}")

if __name__ == "__main__":
    main()

