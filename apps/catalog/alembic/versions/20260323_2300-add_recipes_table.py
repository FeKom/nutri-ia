"""add recipes table

Revision ID: c9d4e5f6a7b8
Revises: a3f7c8d2e1b0
Create Date: 2026-03-23 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9d4e5f6a7b8'
down_revision: Union[str, None] = 'a3f7c8d2e1b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create recipes table
    op.create_table(
        'recipes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=1000), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('prep_time_minutes', sa.Integer(), nullable=False),
        sa.Column('difficulty', sa.String(length=20), nullable=False),
        sa.Column('calories', sa.Integer(), nullable=False),
        sa.Column('protein_g', sa.Float(), nullable=False),
        sa.Column('carbs_g', sa.Float(), nullable=False),
        sa.Column('fat_g', sa.Float(), nullable=False),
        sa.Column('ingredients', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('instructions', sa.String(length=5000), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for recipes table
    op.create_index('idx_recipe_name', 'recipes', ['name'])
    op.create_index('idx_recipe_category', 'recipes', ['category'])
    op.create_index('idx_recipe_difficulty', 'recipes', ['difficulty'])
    op.create_index('idx_recipe_created_at', 'recipes', ['created_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_recipe_created_at', table_name='recipes')
    op.drop_index('idx_recipe_difficulty', table_name='recipes')
    op.drop_index('idx_recipe_category', table_name='recipes')
    op.drop_index('idx_recipe_name', table_name='recipes')

    # Drop table
    op.drop_table('recipes')
