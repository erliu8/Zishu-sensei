"""
安全模块单元测试
"""
import pytest
from datetime import timedelta
from jose import jwt

from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_token,
)
from app.core.config.settings import settings


@pytest.mark.unit
@pytest.mark.auth
class TestPasswordHashing:
    """密码哈希测试"""
    
    def test_hash_password(self):
        """测试密码哈希"""
        password = "my_secret_password"
        hashed = get_password_hash(password)
        
        # 哈希后的密码不应该等于原密码
        assert hashed != password
        # 哈希后的密码应该是字符串
        assert isinstance(hashed, str)
        # 哈希后的密码长度应该大于原密码
        assert len(hashed) > len(password)
    
    def test_verify_password_correct(self):
        """测试验证正确的密码"""
        password = "my_secret_password"
        hashed = get_password_hash(password)
        
        # 应该验证成功
        assert verify_password(password, hashed) is True
    
    def test_verify_password_incorrect(self):
        """测试验证错误的密码"""
        password = "my_secret_password"
        wrong_password = "wrong_password"
        hashed = get_password_hash(password)
        
        # 应该验证失败
        assert verify_password(wrong_password, hashed) is False
    
    def test_same_password_different_hashes(self):
        """测试相同密码产生不同的哈希（salt 机制）"""
        password = "my_secret_password"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        
        # 两次哈希应该不同（因为使用了随机 salt）
        assert hash1 != hash2
        # 但都应该能验证原密码
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


@pytest.mark.unit
@pytest.mark.auth
class TestAccessToken:
    """访问令牌测试"""
    
    def test_create_access_token(self):
        """测试创建访问令牌"""
        user_id = 123
        data = {"sub": str(user_id)}
        token = create_access_token(data)
        
        # 令牌应该是字符串
        assert isinstance(token, str)
        # 令牌应该不为空
        assert len(token) > 0
    
    def test_create_access_token_with_custom_expiry(self):
        """测试创建带自定义过期时间的访问令牌"""
        user_id = 123
        data = {"sub": str(user_id)}
        expires_delta = timedelta(minutes=15)
        token = create_access_token(data, expires_delta=expires_delta)
        
        # 令牌应该被创建
        assert isinstance(token, str)
        assert len(token) > 0
        
        # 解码并验证过期时间
        payload = decode_token(token)
        assert payload is not None
        assert "exp" in payload
    
    def test_decode_access_token(self):
        """测试解码访问令牌"""
        user_id = 123
        username = "testuser"
        data = {"sub": str(user_id), "username": username}
        token = create_access_token(data)
        
        # 解码令牌
        payload = decode_token(token)
        
        # 验证载荷
        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["username"] == username
        assert payload["type"] == "access"
        assert "exp" in payload
    
    def test_decode_invalid_token(self):
        """测试解码无效令牌"""
        invalid_token = "invalid.token.here"
        payload = decode_token(invalid_token)
        
        # 应该返回 None
        assert payload is None
    
    def test_verify_access_token(self):
        """测试验证访问令牌"""
        user_id = 123
        data = {"sub": str(user_id)}
        token = create_access_token(data)
        
        # 验证令牌
        verified_user_id = verify_token(token, token_type="access")
        
        # 应该返回用户 ID
        assert verified_user_id == user_id
    
    def test_verify_token_wrong_type(self):
        """测试验证错误类型的令牌"""
        user_id = 123
        data = {"sub": str(user_id)}
        access_token = create_access_token(data)
        
        # 用 refresh 类型验证 access token 应该失败
        verified_user_id = verify_token(access_token, token_type="refresh")
        
        # 应该返回 None
        assert verified_user_id is None


@pytest.mark.unit
@pytest.mark.auth
class TestRefreshToken:
    """刷新令牌测试"""
    
    def test_create_refresh_token(self):
        """测试创建刷新令牌"""
        user_id = 123
        data = {"sub": str(user_id)}
        token = create_refresh_token(data)
        
        # 令牌应该是字符串
        assert isinstance(token, str)
        # 令牌应该不为空
        assert len(token) > 0
    
    def test_create_refresh_token_with_custom_expiry(self):
        """测试创建带自定义过期时间的刷新令牌"""
        user_id = 123
        data = {"sub": str(user_id)}
        expires_delta = timedelta(days=30)
        token = create_refresh_token(data, expires_delta=expires_delta)
        
        # 令牌应该被创建
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_decode_refresh_token(self):
        """测试解码刷新令牌"""
        user_id = 123
        data = {"sub": str(user_id)}
        token = create_refresh_token(data)
        
        # 解码令牌
        payload = decode_token(token)
        
        # 验证载荷
        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "refresh"
        assert "exp" in payload
    
    def test_verify_refresh_token(self):
        """测试验证刷新令牌"""
        user_id = 123
        data = {"sub": str(user_id)}
        token = create_refresh_token(data)
        
        # 验证令牌
        verified_user_id = verify_token(token, token_type="refresh")
        
        # 应该返回用户 ID
        assert verified_user_id == user_id
    
    def test_verify_refresh_token_with_access_type(self):
        """测试用 access 类型验证 refresh token"""
        user_id = 123
        data = {"sub": str(user_id)}
        refresh_token = create_refresh_token(data)
        
        # 用 access 类型验证 refresh token 应该失败
        verified_user_id = verify_token(refresh_token, token_type="access")
        
        # 应该返回 None
        assert verified_user_id is None


@pytest.mark.unit
@pytest.mark.auth
class TestTokenEdgeCases:
    """令牌边界情况测试"""
    
    def test_token_with_extra_data(self):
        """测试令牌包含额外数据"""
        user_id = 123
        data = {
            "sub": str(user_id),
            "username": "testuser",
            "email": "test@example.com",
            "role": "admin",
        }
        token = create_access_token(data)
        
        # 解码令牌
        payload = decode_token(token)
        
        # 所有数据都应该被保留
        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["username"] == "testuser"
        assert payload["email"] == "test@example.com"
        assert payload["role"] == "admin"
    
    def test_verify_token_without_sub(self):
        """测试验证没有 sub 的令牌"""
        data = {"username": "testuser"}
        
        # 手动创建令牌（不通过我们的函数）
        encoded_jwt = jwt.encode(
            data,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        
        # 验证应该失败
        verified_user_id = verify_token(encoded_jwt)
        assert verified_user_id is None
    
    def test_verify_token_with_invalid_sub(self):
        """测试验证 sub 不是数字的令牌"""
        data = {"sub": "not_a_number"}
        token = create_access_token(data)
        
        # 验证应该失败
        verified_user_id = verify_token(token)
        assert verified_user_id is None
    
    def test_empty_token(self):
        """测试空令牌"""
        payload = decode_token("")
        assert payload is None
    
    def test_malformed_token(self):
        """测试格式错误的令牌"""
        malformed_tokens = [
            "just.two.parts",
            "only_one_part",
            "four.parts.are.wrong",
            "eyJ0eXAi",  # 不完整的 JWT
        ]
        
        for token in malformed_tokens:
            payload = decode_token(token)
            assert payload is None

