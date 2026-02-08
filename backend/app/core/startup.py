from __future__ import annotations

import os

from sqlalchemy import select, text

from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.entities import Usuario, Role


async def ensure_schema() -> None:
    # Dev-friendly: keep the app usable even if migrations weren't run yet.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def ensure_admin_user() -> None:
    """
    Guarantee an admin login exists so deployments don't lock you out.

    Defaults:
    - login: gestor
    - senha: Admin@123
    """
    admin_login = (os.getenv("ADMIN_LOGIN") or "gestor").strip()
    admin_password = os.getenv("ADMIN_PASSWORD") or "Admin@123"
    admin_name = (os.getenv("ADMIN_NAME") or "Gestor Master").strip()

    async with SessionLocal() as db:
        # If the table doesn't exist yet, create schema first.
        try:
            await db.execute(text("SELECT 1 FROM usuarios LIMIT 1"))
        except Exception:
            await ensure_schema()

        exists = await db.scalar(select(Usuario).where(Usuario.email == admin_login))
        if exists:
            return

        db.add(
            Usuario(
                nome=admin_name,
                email=admin_login,
                senha_hash=get_password_hash(admin_password),
                role=Role.gestor,
                ativo=True,
            )
        )
        await db.commit()

