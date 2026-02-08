from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.entities import Usuario, Role
from app.services.auth_service import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> Usuario:
    user_id = decode_token(token, "access")
    user = await db.scalar(select(Usuario).where(Usuario.id == user_id))
    if not user:
        raise HTTPException(status_code=401, detail="Usuario nao encontrado")
    return user


def require_role(*roles: Role):
    async def checker(user: Usuario = Depends(get_current_user)) -> Usuario:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Sem permissao")
        return user

    return checker
