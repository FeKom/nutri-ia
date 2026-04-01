"""add goals and activity_logs tables

Revision ID: d8e9f0a1b2c3
Revises: 20260326_weight
Create Date: 2026-04-01 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d8e9f0a1b2c3"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("target_value", sa.Float(), nullable=False),
        sa.Column("current_value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_goals_user_id", "goals", ["user_id"])

    op.create_table(
        "activity_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("calories_burned", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_activity_logs_user_id", "activity_logs", ["user_id"])
    op.create_index("idx_activity_logs_date", "activity_logs", ["date"])


def downgrade() -> None:
    op.drop_index("idx_activity_logs_date", table_name="activity_logs")
    op.drop_index("idx_activity_logs_user_id", table_name="activity_logs")
    op.drop_table("activity_logs")
    op.drop_index("idx_goals_user_id", table_name="goals")
    op.drop_table("goals")
