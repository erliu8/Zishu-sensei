"""add skill installations table

Revision ID: skill_installations_001
Revises: adapter_config_001
Create Date: 2025-12-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'skill_installations_001'
down_revision = 'adapter_config_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """创建技能安装记录表"""
    op.create_table(
        'skill_installations',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False, comment='主键ID'),
        sa.Column('package_id', sa.String(length=255), nullable=False, comment='技能包唯一标识符'),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=False, comment='用户ID'),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=False), nullable=False, comment='工作流ID'),
        sa.Column('adapter_id', sa.String(length=255), nullable=False, comment='适配器唯一标识符'),
        sa.Column('package_version', sa.String(length=50), nullable=False, comment='技能包版本'),
        sa.Column('manifest', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}', comment='安装时的完整 manifest'),
        sa.Column('installation_status', sa.String(length=20), nullable=False, server_default='installed', comment='安装状态'),
        sa.Column('installed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), comment='安装时间'),
        sa.Column('uninstalled_at', sa.DateTime(timezone=True), nullable=True, comment='卸载时间'),
        sa.Column('error_message', sa.String(length=1000), nullable=True, comment='错误信息'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), comment='创建时间'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), comment='更新时间'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, comment='删除时间'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='是否已删除'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active', comment='记录状态'),
        sa.Column('created_by', sa.String(length=255), nullable=True, comment='创建者'),
        sa.Column('updated_by', sa.String(length=255), nullable=True, comment='更新者'),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1', comment='版本号'),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='元数据'),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='标签'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='pk_skill_installations'),
        sa.UniqueConstraint('user_id', 'package_id', name='uq_skill_installations_user_package'),
        sa.UniqueConstraint('adapter_id', name='uq_skill_installations_adapter_id'),
        sa.CheckConstraint('installation_status IN (\'installing\', \'installed\', \'uninstalled\', \'failed\', \'pending_approval\')', name='ck_skill_installations_status'),
        comment='技能包安装记录表'
    )

    # 创建索引
    op.create_index('idx_skill_installations_user_id', 'skill_installations', ['user_id'])
    op.create_index('idx_skill_installations_workflow_id', 'skill_installations', ['workflow_id'])
    op.create_index('idx_skill_installations_installation_status', 'skill_installations', ['installation_status'])
    op.create_index('idx_skill_installations_package_id', 'skill_installations', ['package_id'])
    op.create_index('idx_skill_installations_adapter_id', 'skill_installations', ['adapter_id'])


def downgrade() -> None:
    """删除技能安装记录表"""
    # 先删除索引
    op.drop_index('idx_skill_installations_adapter_id', table_name='skill_installations')
    op.drop_index('idx_skill_installations_package_id', table_name='skill_installations')
    op.drop_index('idx_skill_installations_installation_status', table_name='skill_installations')
    op.drop_index('idx_skill_installations_workflow_id', table_name='skill_installations')
    op.drop_index('idx_skill_installations_user_id', table_name='skill_installations')

    # 删除表
    op.drop_table('skill_installations')