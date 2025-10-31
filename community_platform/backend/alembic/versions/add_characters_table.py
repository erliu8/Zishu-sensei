"""add characters table

Revision ID: add_characters_table
Revises: 42243a1dcd31
Create Date: 2025-10-31 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_characters_table'
down_revision = '42243a1dcd31'
branch_labels = None
depends_on = None


def upgrade():
    # 创建characters表
    op.create_table(
        'characters',
        sa.Column('id', sa.String(36), primary_key=True, index=True),
        sa.Column('name', sa.String(100), nullable=False, index=True),
        sa.Column('display_name', sa.String(100), nullable=True),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('cover_url', sa.String(500), nullable=True),
        sa.Column('tags', sa.JSON, default=sa.text("'[]'")),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('visibility', sa.String(20), nullable=False, server_default='private'),
        sa.Column('published', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('version', sa.String(20), nullable=False, server_default='1.0.0'),
        sa.Column('adapters', sa.JSON, default=sa.text("'[]'")),
        sa.Column('config', sa.JSON, nullable=True),
        sa.Column('personality', sa.JSON, nullable=True),
        sa.Column('expressions', sa.JSON, default=sa.text("'[]'")),
        sa.Column('voices', sa.JSON, default=sa.text("'[]'")),
        sa.Column('models', sa.JSON, default=sa.text("'[]'")),
        sa.Column('stats', sa.JSON, default=sa.text("'{\"downloads\": 0, \"favorites\": 0, \"likes\": 0, \"rating\": 0.0, \"ratingCount\": 0, \"comments\": 0, \"views\": 0}'")),
        sa.Column('creator_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('creator_name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    
    # 创建索引
    op.create_index('ix_characters_name', 'characters', ['name'])
    op.create_index('ix_characters_creator_id', 'characters', ['creator_id'])
    op.create_index('ix_characters_status', 'characters', ['status'])
    op.create_index('ix_characters_visibility', 'characters', ['visibility'])
    op.create_index('ix_characters_published', 'characters', ['published'])


def downgrade():
    # 删除索引
    op.drop_index('ix_characters_published', table_name='characters')
    op.drop_index('ix_characters_visibility', table_name='characters')
    op.drop_index('ix_characters_status', table_name='characters')
    op.drop_index('ix_characters_creator_id', table_name='characters')
    op.drop_index('ix_characters_name', table_name='characters')
    
    # 删除表
    op.drop_table('characters')

