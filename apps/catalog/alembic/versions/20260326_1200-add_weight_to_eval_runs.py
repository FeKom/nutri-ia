"""add weight to eval_runs

Revision ID: a1b2c3d4e5f6
Revises: ef7048c18bba
Create Date: 2026-03-26 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'ef7048c18bba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('eval_runs', sa.Column('weight', sa.Float(), nullable=False, server_default='1.0'))


def downgrade() -> None:
    op.drop_column('eval_runs', 'weight')
