"""upgrade embeddings to 768 dims and add documents blob_chunks tables

Revision ID: 834ab827a710
Revises: 20260420_1200
Create Date: 2026-05-14 17:59:00.785867

"""
from typing import Sequence, Union

import pgvector.sqlalchemy.vector
import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '834ab827a710'
down_revision: Union[str, None] = '20260420_1200'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'documents',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('b2_key', sqlmodel.sql.sqltypes.AutoString(length=512), nullable=False),
        sa.Column('mime_type', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'INDEXED', 'FAILED', name='documentstatus'), nullable=False),
        sa.Column('error_message', sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_documents_status'), 'documents', ['status'], unique=False)
    op.create_index(op.f('ix_documents_user_id'), 'documents', ['user_id'], unique=False)

    op.create_table(
        'blob_chunks',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('document_id', sa.Uuid(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('chunk_size', sa.Integer(), nullable=False),
        sa.Column('chunk_overlap', sa.Integer(), nullable=False),
        sa.Column('embedding_model', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('embedding', pgvector.sqlalchemy.vector.VECTOR(dim=768), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_blob_chunks_document_id'), 'blob_chunks', ['document_id'], unique=False)

    op.alter_column(
        'document_chunks', 'embedding',
        existing_type=pgvector.sqlalchemy.vector.VECTOR(dim=384),
        type_=pgvector.sqlalchemy.vector.VECTOR(dim=768),
        existing_nullable=True,
    )
    op.alter_column(
        'foods', 'embedding',
        existing_type=pgvector.sqlalchemy.vector.VECTOR(dim=384),
        type_=pgvector.sqlalchemy.vector.VECTOR(dim=768),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'foods', 'embedding',
        existing_type=pgvector.sqlalchemy.vector.VECTOR(dim=768),
        type_=pgvector.sqlalchemy.vector.VECTOR(dim=384),
        existing_nullable=True,
    )
    op.alter_column(
        'document_chunks', 'embedding',
        existing_type=pgvector.sqlalchemy.vector.VECTOR(dim=768),
        type_=pgvector.sqlalchemy.vector.VECTOR(dim=384),
        existing_nullable=True,
    )
    op.drop_index(op.f('ix_blob_chunks_document_id'), table_name='blob_chunks')
    op.drop_table('blob_chunks')
    op.drop_index(op.f('ix_documents_user_id'), table_name='documents')
    op.drop_index(op.f('ix_documents_status'), table_name='documents')
    op.drop_table('documents')
