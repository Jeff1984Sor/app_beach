from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
from fastapi import HTTPException, status
from app.core.security import verify_password, create_token
from app.core.config import settings
from app.models.entities import Usuario


async def login(db: AsyncSession, login: str, senha: str):
    user = await db.scalar(select(Usuario).where(Usuario.email == login, Usuario.ativo == True))
    if not user or not verify_password(senha, user.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais invalidas")

    access = create_token(str(user.id), "access", settings.access_token_expire_minutes)
    refresh = create_token(str(user.id), "refresh", settings.refresh_token_expire_minutes)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


def decode_token(token: str, expected_type: str) -> int:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("type") != expected_type:
            raise HTTPException(status_code=401, detail="Token invalido")
        return int(payload["sub"])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Token invalido") from exc
