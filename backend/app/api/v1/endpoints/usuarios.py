from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.api.deps import require_role
from app.models.entities import Usuario, Role
from app.schemas.usuario import UsuarioCreate, UsuarioOut
from app.core.security import get_password_hash

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("", response_model=list[UsuarioOut])
async def listar_usuarios(
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_role(Role.gestor)),
):
    rows = (await db.execute(select(Usuario))).scalars().all()
    return [UsuarioOut(id=r.id, nome=r.nome, login=r.email, role=r.role, ativo=r.ativo) for r in rows]


@router.post("", response_model=UsuarioOut)
async def criar_usuario(
    payload: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_role(Role.gestor)),
):
    if payload.role not in {Role.gestor, Role.professor, Role.aluno}:
        raise HTTPException(status_code=400, detail="Role invalida")

    exists = await db.scalar(select(Usuario).where(Usuario.email == payload.login))
    if exists:
        raise HTTPException(status_code=409, detail="Login ja existe")

    row = Usuario(
        nome=payload.nome,
        email=payload.login,
        senha_hash=get_password_hash(payload.senha),
        role=payload.role,
        ativo=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return UsuarioOut(id=row.id, nome=row.nome, login=row.email, role=row.role, ativo=row.ativo)
