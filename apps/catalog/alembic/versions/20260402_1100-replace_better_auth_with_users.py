"""replace better-auth tables with custom users table

Revision ID: b7c8d9e0f1a2
Revises: f1e2d3c4b5a6
Create Date: 2026-04-02 11:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables that have a user_id column referencing the old better-auth user table
USER_DATA_TABLES = [
    "activity_logs",
    "goals",
    "daily_stats",
    "meal_logs",
    "meal_plans",
    "user_profiles",
]


def upgrade() -> None:
    # 1. Truncate all user-data tables — old UUIDs came from better-auth
    #    and no longer match anything in the new users table.
    for table in USER_DATA_TABLES:
        op.execute(f"TRUNCATE TABLE {table} CASCADE")

    # 2. Drop better-auth tables (created directly by the library, not via Alembic)
    # "user" is a reserved word in PostgreSQL and must be quoted
    for table in ["session", "account", "verification"]:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    op.execute('DROP TABLE IF EXISTS "user" CASCADE')

    # 3. Add FK constraints: every user_id now references users.id
    for table in USER_DATA_TABLES:
        op.create_foreign_key(
            f"fk_{table}_user_id",
            table,
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    for table in USER_DATA_TABLES:
        op.drop_constraint(f"fk_{table}_user_id", table, type_="foreignkey")
