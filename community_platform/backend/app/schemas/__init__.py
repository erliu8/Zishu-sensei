"""
数据验证模式（Schemas）
"""
from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserChangePassword,
    UserInDB,
    UserPublic,
    UserProfile,
    UserStats,
)
from app.schemas.auth import (
    Token,
    TokenData,
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
)
from app.schemas.post import (
    PostBase,
    PostCreate,
    PostUpdate,
    PostInDB,
    PostPublic,
    PostDetail,
    PostStats,
)
from app.schemas.comment import (
    CommentBase,
    CommentCreate,
    CommentUpdate,
    CommentInDB,
    CommentPublic,
)
from app.schemas.notification import (
    NotificationBase,
    NotificationCreate,
    NotificationInDB,
    NotificationPublic,
    NotificationStats,
)
from app.schemas.search import (
    SearchRequest,
    VectorSearchRequest,
    SearchResult,
    VectorSearchResult,
)
from app.schemas.common import (
    Response,
    PaginationParams,
    PaginatedResponse,
)
from app.schemas.websocket import (
    WebSocketMessage,
    UserStatusMessage,
    NotificationMessage,
    ChatMessage,
    PostUpdateMessage,
    OnlineStatus,
    OnlineUsersResponse,
    TypingIndicator,
    PresenceUpdate,
    PingPong,
    ErrorMessage,
)

__all__ = [
    # User
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserChangePassword",
    "UserInDB",
    "UserPublic",
    "UserProfile",
    "UserStats",
    # Auth
    "Token",
    "TokenData",
    "LoginRequest",
    "RegisterRequest",
    "RefreshTokenRequest",
    "PasswordResetRequest",
    "PasswordResetConfirm",
    # Post
    "PostBase",
    "PostCreate",
    "PostUpdate",
    "PostInDB",
    "PostPublic",
    "PostDetail",
    "PostStats",
    # Comment
    "CommentBase",
    "CommentCreate",
    "CommentUpdate",
    "CommentInDB",
    "CommentPublic",
    # Notification
    "NotificationBase",
    "NotificationCreate",
    "NotificationInDB",
    "NotificationPublic",
    "NotificationStats",
    # Search
    "SearchRequest",
    "VectorSearchRequest",
    "SearchResult",
    "VectorSearchResult",
    # Common
    "Response",
    "PaginationParams",
    "PaginatedResponse",
    # WebSocket
    "WebSocketMessage",
    "UserStatusMessage",
    "NotificationMessage",
    "ChatMessage",
    "PostUpdateMessage",
    "OnlineStatus",
    "OnlineUsersResponse",
    "TypingIndicator",
    "PresenceUpdate",
    "PingPong",
    "ErrorMessage",
]

