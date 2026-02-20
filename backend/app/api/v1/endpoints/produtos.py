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
              valor_custo NUMERIC(10,2) NOT NULL DEFAULT 0,
              valor_venda NUMERIC(10,2) NOT NULL DEFAULT 0,
              status VARCHAR(20) NOT NULL DEFAULT 'ativo',
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'produtos' AND column_name = 'valor_custo'
              ) THEN
                ALTER TABLE produtos ADD COLUMN valor_custo NUMERIC(10,2) NOT NULL DEFAULT 0;
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'produtos' AND column_name = 'valor_venda'
              ) THEN
                ALTER TABLE produtos ADD COLUMN valor_venda NUMERIC(10,2) NOT NULL DEFAULT 0;
              END IF;
            END $$;
            """
        )
    )
    await db.commit()


@router.get("")
async def listar_produtos(db: AsyncSession = Depends(get_db)):
    await ensure_produtos_table(db)
    rows = (await db.execute(text("SELECT id, nome, valor_custo, valor_venda, status FROM produtos ORDER BY nome ASC"))).all()
    return [
        {
            "id": r[0],
            "nome": r[1],
            "valor_custo": float(r[2] or 0),
            "valor_venda": float(r[3] or 0),
            "lucro": float((r[3] or 0) - (r[2] or 0)),
            "status": r[4],
        }
        for r in rows
    ]


@router.post("")
async def criar_produto(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_produtos_table(db)
    nome = (payload.get("nome") or "").strip()
    valor_custo = float(payload.get("valor_custo") or 0)
    valor_venda = float(payload.get("valor_venda") or 0)
    status = (payload.get("status") or "ativo").strip().lower()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome do produto e obrigatorio")
    if valor_custo < 0 or valor_venda < 0:
        raise HTTPException(status_code=400, detail="Valores nao podem ser negativos")
    row = (
        await db.execute(
            text(
                """
                INSERT INTO produtos (nome, valor_custo, valor_venda, status, created_at, updated_at)
                VALUES (:nome, :valor_custo, :valor_venda, :status, NOW(), NOW())
                RETURNING id
                """
            ),
            {"nome": nome, "valor_custo": valor_custo, "valor_venda": valor_venda, "status": status},
        )
    ).first()
    await db.commit()
    return {"id": row[0]}


@router.put("/{produto_id}")
async def atualizar_produto(produto_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_produtos_table(db)
    nome = (payload.get("nome") or "").strip()
    valor_custo = float(payload.get("valor_custo") or 0)
    valor_venda = float(payload.get("valor_venda") or 0)
    status = (payload.get("status") or "ativo").strip().lower()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome do produto e obrigatorio")
    if valor_custo < 0 or valor_venda < 0:
        raise HTTPException(status_code=400, detail="Valores nao podem ser negativos")
    res = await db.execute(
        text(
            """
            UPDATE produtos
            SET nome = :nome, valor_custo = :valor_custo, valor_venda = :valor_venda, status = :status, updated_at = NOW()
            WHERE id = :id
            """
        ),
        {"id": produto_id, "nome": nome, "valor_custo": valor_custo, "valor_venda": valor_venda, "status": status},
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
