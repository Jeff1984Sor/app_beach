from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.entities import Unidade

router = APIRouter(prefix="/unidades", tags=["unidades"])


@router.get("")
async def listar_unidades(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Unidade).order_by(Unidade.id.desc()))).scalars().all()
    return [{"id": r.id, "nome": r.nome, "cep": r.cep, "endereco": r.endereco} for r in rows]


@router.post("")
async def criar_unidade(payload: dict, db: AsyncSession = Depends(get_db)):
    nome = (payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da unidade e obrigatorio")
    row = Unidade(nome=nome, cep=(payload.get("cep") or "").strip(), endereco=(payload.get("endereco") or "").strip())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"id": row.id}


@router.put("/{unidade_id}")
async def atualizar_unidade(unidade_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    row = await db.get(Unidade, unidade_id)
    if not row:
        raise HTTPException(status_code=404, detail="Unidade nao encontrada")
    row.nome = (payload.get("nome") or row.nome).strip()
    row.cep = (payload.get("cep") if payload.get("cep") is not None else row.cep).strip()
    row.endereco = (payload.get("endereco") if payload.get("endereco") is not None else row.endereco).strip()
    await db.commit()
    return {"ok": True}


@router.delete("/{unidade_id}")
async def apagar_unidade(unidade_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(Unidade, unidade_id)
    if not row:
        raise HTTPException(status_code=404, detail="Unidade nao encontrada")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
