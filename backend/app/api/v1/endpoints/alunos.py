from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.entities import Aluno
from app.schemas.domain import AlunoIn

router = APIRouter(prefix="/alunos", tags=["alunos"])


@router.get("")
async def list_alunos(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Aluno))).scalars().all()
    return [{"id": r.id, "usuario_id": r.usuario_id, "telefone": r.telefone, "status": r.status} for r in rows]


@router.post("")
async def create_aluno(payload: AlunoIn, db: AsyncSession = Depends(get_db)):
    row = Aluno(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"id": row.id}


@router.put("/{aluno_id}")
async def update_aluno(aluno_id: int, payload: AlunoIn, db: AsyncSession = Depends(get_db)):
    row = await db.get(Aluno, aluno_id)
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    return {"ok": True}


@router.delete("/{aluno_id}")
async def delete_aluno(aluno_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(Aluno, aluno_id)
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


