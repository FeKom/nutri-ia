"""initial migration

Revision ID: 001
Revises:
Create Date: 2024-12-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Create foods table
    op.create_table(
        'foods',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('name_normalized', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('serving_size_g', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('serving_unit', sa.String(length=20), nullable=False),
        sa.Column('calorie_per_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('usda_id', sa.String(length=50), nullable=True),
        sa.Column('source', sa.Enum('USDA', 'TACO', 'CUSTOM', name='foodsource'), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('embedding', Vector(384), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for foods table
    op.create_index('idx_food_category', 'foods', ['category'])
    op.create_index('idx_food_name_normalized', 'foods', ['name_normalized'])
    op.create_index('idx_food_source', 'foods', ['source'])
    op.create_index(op.f('ix_foods_name'), 'foods', ['name'])
    op.create_index(op.f('ix_foods_name_normalized'), 'foods', ['name_normalized'], unique=True)
    op.create_index(op.f('ix_foods_usda_id'), 'foods', ['usda_id'], unique=True)

    # Create food_nutrients table
    op.create_table(
        'food_nutrients',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('food_id', sa.UUID(), nullable=False),
        sa.Column('calories_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('protein_g_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('carbs_g_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('fat_g_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('saturated_fat_g_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('fiber_g_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('sugar_g_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('sodium_mg_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('calcium_mg_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('iron_mg_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_c_mg_100g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['food_id'], ['foods.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for food_nutrients table
    op.create_index('idx_food_nutrient_food_id', 'food_nutrients', ['food_id'])


def downgrade() -> None:
    # Drop food_nutrients table
    op.drop_index('idx_food_nutrient_food_id', table_name='food_nutrients')
    op.drop_table('food_nutrients')

    # Drop foods table
    op.drop_index(op.f('ix_foods_usda_id'), table_name='foods')
    op.drop_index(op.f('ix_foods_name_normalized'), table_name='foods')
    op.drop_index(op.f('ix_foods_name'), table_name='foods')
    op.drop_index('idx_food_source', table_name='foods')
    op.drop_index('idx_food_name_normalized', table_name='foods')
    op.drop_index('idx_food_category', table_name='foods')
    op.drop_table('foods')

    # Drop enum type
    sa.Enum(name='foodsource').drop(op.get_bind())

    # Optionally drop pgvector extension (commented out for safety)
    # op.execute('DROP EXTENSION IF EXISTS vector')
