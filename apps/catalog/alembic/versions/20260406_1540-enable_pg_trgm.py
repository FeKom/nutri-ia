"""enable pg_trgm extension

Revision ID: 20260406_1540
Revises: 20260402_1100
Create Date: 2026-04-06 15:40:00
"""

from alembic import op

revision = "20260406_1540"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
