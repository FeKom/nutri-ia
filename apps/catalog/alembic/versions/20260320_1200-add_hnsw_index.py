"""add hnsw index for embedding search

Revision ID: a3f7c8d2e1b0
Revises: bd1e66bb991d
Create Date: 2026-03-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a3f7c8d2e1b0'
down_revision: Union[str, None] = 'bd1e66bb991d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # HNSW index for cosine distance search on embeddings
    # Improves search from O(n) sequential scan to O(log n) approximate nearest neighbor
    # Parameters: m=16 (connections per layer), ef_construction=64 (build-time accuracy)
    op.execute(
        """
        CREATE INDEX idx_food_embedding_hnsw
        ON foods USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_food_embedding_hnsw;")
