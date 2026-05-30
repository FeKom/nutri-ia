"""add_hallucination_jailbreak_to_eval_results

Revision ID: 20260420_1200
Revises: 20260406_1540
Create Date: 2026-04-20 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260420_1200"
down_revision: Union[str, None] = "20260406_1540"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("eval_results", sa.Column("hallucination", sa.Float(), nullable=True))
    op.add_column("eval_results", sa.Column("jailbreak", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("eval_results", "jailbreak")
    op.drop_column("eval_results", "hallucination")
