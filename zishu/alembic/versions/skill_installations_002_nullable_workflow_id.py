"""make skill_installations.workflow_id nullable

Revision ID: skill_installations_002
Revises: skill_installations_001
Create Date: 2025-12-19 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "skill_installations_002"
down_revision = "skill_installations_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """允许 installing/pending_approval 状态下 workflow_id 为空"""
    op.alter_column(
        "skill_installations",
        "workflow_id",
        existing_type=postgresql.UUID(as_uuid=False),
        nullable=True,
    )


def downgrade() -> None:
    """恢复 workflow_id 非空限制"""
    op.alter_column(
        "skill_installations",
        "workflow_id",
        existing_type=postgresql.UUID(as_uuid=False),
        nullable=False,
    )

