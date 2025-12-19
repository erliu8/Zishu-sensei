"""
Zishu-sensei 数据模型模块

包含所有业务数据模型的定义，包括：
- 用户管理模型
- 适配器模型  
- 社区交互模型
- 文件管理模型
- 打包任务模型

所有模型都基于统一的基础模型类，提供：
- 时间戳管理
- 软删除支持
- 状态管理
- 审计追踪
- 元数据支持
"""

from .user import (
    User,
    UserProfile,
    UserRole,
    UserPermission,
    UserSession,
    UserPreference,
    # Pydantic schemas
    UserCreate,
    UserUpdate,
    UserResponse,
    UserProfileResponse,
    UserSessionResponse,
)

from .adapter import (
    Adapter,
    AdapterVersion,
    AdapterDependency,
    AdapterCategory,
    AdapterDownload,
    AdapterRating,
    # Pydantic schemas  
    AdapterCreate,
    AdapterUpdate,
    AdapterResponse,
    AdapterVersionCreate,
    AdapterVersionResponse,
)

from .community import (
    Forum,
    Topic,
    Post,
    Comment,
    Like,
    Follow,
    # Pydantic schemas
    ForumCreate,
    ForumResponse,
    TopicCreate,
    TopicResponse,
    PostCreate,
    PostResponse,
    CommentCreate,
    CommentResponse,
)

from .file import (
    File,
    FileVersion,
    FilePermission,
    FileShare,
    # Pydantic schemas
    FileCreate,
    FileUpdate,
    FileResponse,
    FileVersionResponse,
)

from .packaging import (
    PackagingTask,
    BuildLog,
    BuildArtifact,
    PackageTemplate,
    # Pydantic schemas
    PackagingTaskCreate,
    PackagingTaskUpdate,
    PackagingTaskResponse,
    BuildLogResponse,
)

from .conversation import (
    Conversation,
    Message,
    MessageAttachment,
    ConversationParticipant,
    ConversationContext,
    # Pydantic schemas
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
)

from .character import (
    Character,
    CharacterPersonality,
    CharacterExpression,
    CharacterVoice,
    CharacterModel,
    # Pydantic schemas
    CharacterCreate,
    CharacterUpdate,
    CharacterResponse,
)

from .workflow import (
    Workflow,
    WorkflowNode,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowTemplate,
    # Pydantic schemas
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowResponse,
    WorkflowExecutionCreate,
    WorkflowExecutionResponse,
)

from .skill_installation import (
    SkillInstallation,
    # Pydantic schemas
    SkillInstallationCreate,
    SkillInstallationUpdate,
    SkillInstallationResponse,
    SkillInstallationListResponse,
)

__all__ = [
    # 用户模型
    "User",
    "UserProfile", 
    "UserRole",
    "UserPermission",
    "UserSession",
    "UserPreference",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserProfileResponse",
    "UserSessionResponse",
    
    # 适配器模型
    "Adapter",
    "AdapterVersion",
    "AdapterDependency", 
    "AdapterCategory",
    "AdapterDownload",
    "AdapterRating",
    "AdapterCreate",
    "AdapterUpdate",
    "AdapterResponse",
    "AdapterVersionCreate",
    "AdapterVersionResponse",
    
    # 社区模型
    "Forum",
    "Topic",
    "Post", 
    "Comment",
    "Like",
    "Follow",
    "ForumCreate",
    "ForumResponse",
    "TopicCreate",
    "TopicResponse",
    "PostCreate",
    "PostResponse",
    "CommentCreate",
    "CommentResponse",
    
    # 文件模型
    "File",
    "FileVersion",
    "FilePermission",
    "FileShare",
    "FileCreate",
    "FileUpdate", 
    "FileResponse",
    "FileVersionResponse",
    
    # 打包模型
    "PackagingTask",
    "BuildLog",
    "BuildArtifact",
    "PackageTemplate",
    "PackagingTaskCreate",
    "PackagingTaskUpdate",
    "PackagingTaskResponse",
    "BuildLogResponse",
    
    # 对话模型
    "Conversation",
    "Message",
    "MessageAttachment",
    "ConversationParticipant",
    "ConversationContext",
    "ConversationCreate",
    "ConversationUpdate",
    "ConversationResponse",
    "MessageCreate",
    "MessageResponse",
    
    # 角色模型
    "Character",
    "CharacterPersonality",
    "CharacterExpression",
    "CharacterVoice",
    "CharacterModel",
    "CharacterCreate",
    "CharacterUpdate",
    "CharacterResponse",
    
    # 工作流模型
    "Workflow",
    "WorkflowNode",
    "WorkflowEdge",
    "WorkflowExecution",
    "WorkflowTemplate",
    "WorkflowCreate",
    "WorkflowUpdate",
    "WorkflowResponse",
    "WorkflowExecutionCreate",
    "WorkflowExecutionResponse",

    # 技能安装模型
    "SkillInstallation",
    "SkillInstallationCreate",
    "SkillInstallationUpdate",
    "SkillInstallationResponse",
    "SkillInstallationListResponse",
]
