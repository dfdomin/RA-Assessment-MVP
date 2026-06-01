"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("hashed_password", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("auth_provider", sa.String(20), nullable=False, server_default="local"),
        sa.Column("microsoft_oid", sa.String(255), nullable=True),
        sa.Column("pege_id", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("microsoft_oid", name="uq_users_microsoft_oid"),
        sa.UniqueConstraint("pege_id", name="uq_users_pege_id"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "revoked_tokens",
        sa.Column("jti", sa.String(36), primary_key=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "security_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "ts",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("event", sa.String(100), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("severity", sa.String(10), nullable=False, server_default="INFO"),
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.create_table(
        "periods",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("academic_year", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("periods")
    op.drop_table("security_events")
    op.drop_table("revoked_tokens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
