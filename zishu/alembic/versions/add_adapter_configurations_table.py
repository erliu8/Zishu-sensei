"""add adapter configurations table

Revision ID: adapter_config_001
Revises: 10967fd178d8
Create Date: 2025-11-18 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'adapter_config_001'
down_revision = '10967fd178d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """创建适配器配置表"""
    op.create_table(
        'adapter_configurations',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, comment='主键ID'),
        sa.Column('adapter_id', sa.String(length=255), nullable=False, comment='适配器唯一标识符'),
        sa.Column('name', sa.String(length=255), nullable=False, comment='适配器名称'),
        sa.Column('adapter_type', sa.String(length=50), nullable=False, comment='适配器类型（soft/hard）'),
        sa.Column('adapter_class', sa.String(length=500), nullable=False, comment='适配器类路径'),
        sa.Column('version', sa.String(length=50), nullable=False, server_default='1.0.0', comment='适配器版本'),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}', comment='适配器配置（JSON格式）'),
        sa.Column('dependencies', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='依赖的其他适配器ID列表'),
        sa.Column('description', sa.Text(), nullable=True, comment='适配器描述'),
        sa.Column('author', sa.String(length=255), nullable=True, comment='作者'),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='标签列表'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true'), comment='是否启用'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='registered', comment='适配器状态'),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True, comment='最后使用时间'),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0', comment='使用次数'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), comment='创建时间'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), comment='更新时间'),
        sa.PrimaryKeyConstraint('id', name='pk_adapter_configurations'),
        sa.UniqueConstraint('adapter_id', name='uk_adapter_configurations_adapter_id'),
        comment='适配器运行时配置表'
    )
    
    # 创建索引
    op.create_index('idx_adapter_configurations_adapter_id', 'adapter_configurations', ['adapter_id'])
    op.create_index('idx_adapter_configurations_type', 'adapter_configurations', ['adapter_type'])
    op.create_index('idx_adapter_configurations_status', 'adapter_configurations', ['status'])
    op.create_index('idx_adapter_configurations_enabled', 'adapter_configurations', ['is_enabled'])
    op.create_index('idx_adapter_configurations_last_used', 'adapter_configurations', ['last_used_at'])


def downgrade() -> None:
    """删除适配器配置表"""
    op.drop_index('idx_adapter_configurations_last_used', table_name='adapter_configurations')
    op.drop_index('idx_adapter_configurations_enabled', table_name='adapter_configurations')
    op.drop_index('idx_adapter_configurations_status', table_name='adapter_configurations')
    op.drop_index('idx_adapter_configurations_type', table_name='adapter_configurations')
    op.drop_index('idx_adapter_configurations_adapter_id', table_name='adapter_configurations')
    op.drop_table('adapter_configurations')
