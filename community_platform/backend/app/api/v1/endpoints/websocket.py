"""
WebSocket 端点
"""
import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.core.security import verify_token
from app.models.user import User
from app.services.websocket import manager
from app.services.websocket.presence import presence_service
from app.schemas.websocket import OnlineUsersResponse, OnlineStatus
from app.db.repositories.user import UserRepository

router = APIRouter()


async def get_user_from_token(
    token: str,
    db: AsyncSession
) -> Optional[User]:
    """
    从 token 获取用户
    
    Args:
        token: JWT token
        db: 数据库会话
    
    Returns:
        Optional[User]: 用户对象，验证失败返回 None
    """
    user_id = verify_token(token, token_type="access")
    if user_id is None:
        return None
    
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    
    if user is None or not user.is_active:
        return None
    
    return user


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT 访问令牌"),
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket 连接端点
    
    客户端需要通过查询参数传递 JWT token 进行认证
    
    ### 连接示例
    ```javascript
    const token = "your_jwt_token";
    const ws = new WebSocket(`ws://localhost:8000/api/v1/ws?token=${token}`);
    ```
    
    ### 消息格式
    
    **发送消息**:
    ```json
    {
        "type": "ping",
        "timestamp": "2025-10-22T10:00:00Z"
    }
    ```
    
    **接收消息类型**:
    - `user_status`: 用户状态变化
    - `notification`: 通知消息
    - `chat`: 聊天消息
    - `post_update`: 帖子更新
    - `typing`: 正在输入
    - `presence`: 在线状态更新
    - `pong`: 心跳响应
    - `error`: 错误消息
    """
    # 验证用户
    user = await get_user_from_token(token, db)
    if user is None:
        await websocket.close(code=4001, reason="认证失败")
        return
    
    # 连接用户
    await manager.connect(websocket, user.id)
    
    # 更新在线状态
    await presence_service.set_user_online(
        user.id,
        connections_count=manager.get_user_connections_count(user.id)
    )
    
    try:
        # 发送欢迎消息
        await manager.send_personal_message(
            {
                "type": "connected",
                "data": {
                    "message": f"欢迎, {user.username}!",
                    "user_id": user.id,
                    "online_count": manager.get_online_count()
                }
            },
            websocket
        )
        
        # 保持连接，处理消息
        while True:
            # 接收消息
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                # 处理不同类型的消息
                if message_type == "ping":
                    # 心跳响应
                    await manager.send_personal_message(
                        {
                            "type": "pong",
                            "timestamp": message.get("timestamp")
                        },
                        websocket
                    )
                    # 更新最后在线时间
                    await presence_service.update_last_seen(user.id)
                
                elif message_type == "typing":
                    # 正在输入指示器
                    # 可以广播给相关用户（例如，正在查看同一帖子的用户）
                    typing_data = message.get("data", {})
                    typing_data["user_id"] = user.id
                    await manager.broadcast(
                        {
                            "type": "typing",
                            "data": typing_data
                        },
                        exclude_user_id=user.id
                    )
                
                elif message_type == "presence":
                    # 在线状态更新
                    presence_status = message.get("status", "online")
                    presence_data = message.get("data")
                    
                    await presence_service.set_user_presence(
                        user.id,
                        presence_status,
                        presence_data
                    )
                    
                    # 广播状态变化
                    await manager.broadcast(
                        {
                            "type": "presence",
                            "data": {
                                "user_id": user.id,
                                "status": presence_status,
                                "data": presence_data
                            }
                        },
                        exclude_user_id=user.id
                    )
                
                elif message_type == "message":
                    # 聊天消息（如果实现了聊天功能）
                    to_user_id = message.get("to_user_id")
                    if to_user_id:
                        await manager.send_to_user(
                            {
                                "type": "chat",
                                "data": {
                                    "from_user_id": user.id,
                                    "from_username": user.username,
                                    "message": message.get("message"),
                                    "timestamp": message.get("timestamp")
                                }
                            },
                            to_user_id
                        )
                
                else:
                    # 未知消息类型
                    await manager.send_personal_message(
                        {
                            "type": "error",
                            "error_code": "UNKNOWN_MESSAGE_TYPE",
                            "message": f"未知的消息类型: {message_type}"
                        },
                        websocket
                    )
                    
            except json.JSONDecodeError:
                await manager.send_personal_message(
                    {
                        "type": "error",
                        "error_code": "INVALID_JSON",
                        "message": "无效的 JSON 格式"
                    },
                    websocket
                )
            except Exception as e:
                print(f"处理 WebSocket 消息错误: {e}")
                await manager.send_personal_message(
                    {
                        "type": "error",
                        "error_code": "MESSAGE_PROCESSING_ERROR",
                        "message": "处理消息时发生错误"
                    },
                    websocket
                )
    
    except WebSocketDisconnect:
        # 断开连接
        await manager.disconnect(websocket)
        
        # 更新在线状态
        if manager.get_user_connections_count(user.id) == 0:
            await presence_service.set_user_offline(user.id)
    
    except Exception as e:
        print(f"WebSocket 错误: {e}")
        await manager.disconnect(websocket)
        
        # 更新在线状态
        if manager.get_user_connections_count(user.id) == 0:
            await presence_service.set_user_offline(user.id)


@router.get("/online", response_model=OnlineUsersResponse)
async def get_online_users(
    limit: int = Query(default=100, ge=1, le=1000, description="返回数量限制"),
    current_user: User = Depends(get_current_user)
):
    """
    获取在线用户列表
    
    需要认证。返回当前在线的用户列表及其状态。
    """
    # 获取在线用户 ID
    online_user_ids = manager.get_online_users()[:limit]
    
    # 获取用户状态
    online_statuses = []
    for user_id in online_user_ids:
        status = await presence_service.get_user_status(user_id)
        if status:
            online_statuses.append(status)
        else:
            # 如果 Redis 中没有，从管理器获取
            online_statuses.append(
                OnlineStatus(
                    user_id=user_id,
                    online=True,
                    last_seen=manager.online_users.get(user_id, None),
                    connections_count=manager.get_user_connections_count(user_id)
                )
            )
    
    return OnlineUsersResponse(
        online_count=manager.get_online_count(),
        users=online_statuses
    )


@router.get("/online/count")
async def get_online_count(
    current_user: User = Depends(get_current_user)
):
    """
    获取在线用户数量
    
    需要认证。返回当前在线的用户总数。
    """
    return {
        "online_count": manager.get_online_count()
    }


@router.get("/status/{user_id}", response_model=OnlineStatus)
async def get_user_online_status(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取指定用户的在线状态
    
    需要认证。返回指定用户的在线状态信息。
    """
    # 首先从管理器检查
    if manager.is_user_online(user_id):
        return OnlineStatus(
            user_id=user_id,
            online=True,
            last_seen=manager.online_users.get(user_id, None),
            connections_count=manager.get_user_connections_count(user_id)
        )
    
    # 从 Redis 获取状态
    status = await presence_service.get_user_status(user_id)
    if status:
        return status
    
    # 用户不存在或从未上线
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="未找到用户状态信息"
    )

