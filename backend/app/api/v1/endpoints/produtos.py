from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter(prefix="/produtos", tags=["produtos"])


async def ensure_produtos_table(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS produtos (
              id SERIAL PRIMARY KEY,
              nome VARCHAR(120) NOT NULL UNIQUE,
              status VARCHAR(20) NOT NULL DEFAULT 'ativo',
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
            """
        )
    )
    await db.commit()


@router.get("")
async def listar_produtos(db: AsyncSession = Depends(get_db)):
    await ensure_produtos_table(db)
    rows = (await db.execute(text("SELECT id, nome, status FROM produtos ORDER BY nome ASC"))).all()
    return [{"id": r[0], "nome": r[1], "status": r[2]} for r in rows]


@router.post("")
async def criar_produto(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_produtos_table(db)
    nome = (payload.get("nome") or "").strip()
    status = (payload.get("status") or "ativo").strip().lower()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome do produto e obrigatorio")
    row = (
        await db.execute(
            text("INSERT INTO produtos (nome, status, created_at, updated_at) VALUES (:nome, :status, NOW(), NOW()) RETURNING id"),
            {"nome": nome, "status": status},
        )
    ).first()
    await db.commit()
    return {"id": row[0]}


@router.put("/{produto_id}")
async def atualizar_produto(produto_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_produtos_table(db)
    nome = (payload.get("nome") or "").strip()
    status = (payload.get("status") or "ativo").strip().lower()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome do produto e obrigatorio")
    res = await db.execute(
        text("UPDATE produtos SET nome = :nome, status = :status, updated_at = NOW() WHERE id = :id"),
        {"id": produto_id, "nome": nome, "status": status},
    )
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    return {"ok": True}


@router.delete("/{produto_id}")
async def excluir_produto(produto_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_produtos_table(db)
    res = await db.execute(text("DELETE FROM produtos WHERE id = :id"), {"id": produto_id})
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    return {"ok": True}
