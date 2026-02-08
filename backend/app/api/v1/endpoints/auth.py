from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.schemas.auth import LoginInput, TokenOut, RefreshInput, UsuarioMe
from app.services.auth_service import login, decode_token, create_token
from app.core.config import settings
from app.models.entities import Usuario
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
async def auth_login(payload: LoginInput, db: AsyncSession = Depends(get_db)):
    return await login(db, payload.email, payload.senha)


@router.post("/refresh", response_model=TokenOut)
async def auth_refresh(payload: RefreshInput):
    user_id = decode_token(payload.refresh_token, "refresh")
    access = create_token(str(user_id), "access", settings.access_token_expire_minutes)
    refresh = create_token(str(user_id), "refresh", settings.refresh_token_expire_minutes)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


@router.get("/me", response_model=UsuarioMe)
async def me(user: Usuario = Depends(get_current_user)):
    return UsuarioMe(id=user.id, nome=user.nome, email=user.email, role=user.role)

