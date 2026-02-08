from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.entities import Aula, MovimentoBancario, ContaReceber, ContaPagar
from app.schemas.domain import AulaIn, FinanceiroIn
from app.services.finance_service import gerar_comissao, dre

router = APIRouter(tags=["core"])


@router.get("/aulas")
async def list_aulas(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Aula))).scalars().all()
    return [{"id": r.id, "status": r.status, "inicio": r.inicio, "valor": float(r.valor)} for r in rows]


@router.post("/aulas")
async def create_aula(payload: AulaIn, db: AsyncSession = Depends(get_db)):
    row = Aula(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"id": row.id}


@router.put("/aulas/{aula_id}")
async def update_aula(aula_id: int, payload: AulaIn, db: AsyncSession = Depends(get_db)):
    row = await db.get(Aula, aula_id)
    if not row:
        raise HTTPException(status_code=404, detail="Aula nao encontrada")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    return {"ok": True}


@router.delete("/aulas/{aula_id}")
async def delete_aula(aula_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(Aula, aula_id)
    if not row:
        raise HTTPException(status_code=404, detail="Aula nao encontrada")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


@router.get("/financeiro")
async def list_financeiro(db: AsyncSession = Depends(get_db)):
    movimentos = (await db.execute(select(MovimentoBancario))).scalars().all()
    return [{"id": m.id, "tipo": m.tipo, "valor": float(m.valor), "data": m.data_movimento} for m in movimentos]


@router.post("/financeiro")
async def create_financeiro(payload: FinanceiroIn, db: AsyncSession = Depends(get_db)):
    row = MovimentoBancario(data_movimento=payload.data, tipo=payload.tipo, valor=payload.valor, descricao=payload.descricao)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"id": row.id}


@router.delete("/financeiro/{movimento_id}")
async def delete_financeiro(movimento_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(MovimentoBancario, movimento_id)
    if not row:
        raise HTTPException(status_code=404, detail="Movimento nao encontrado")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


@router.post("/gerar-comissao")
async def gerar_comissao_endpoint(db: AsyncSession = Depends(get_db)):
    return await gerar_comissao(db)


@router.get("/dre")
async def dre_endpoint(db: AsyncSession = Depends(get_db)):
    return await dre(db)


