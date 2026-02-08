from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter(tags=["bancario"])


async def ensure_contas_bancarias_table(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS contas_bancarias (
              id SERIAL PRIMARY KEY,
              nome_conta VARCHAR(120) NOT NULL,
              banco VARCHAR(120) NOT NULL,
              agencia VARCHAR(40) NOT NULL,
              cc VARCHAR(40) NOT NULL,
              saldo NUMERIC(12,2) NOT NULL DEFAULT 0
            )
            """
        )
    )
    await db.commit()


@router.get("/contas-bancarias")
async def listar_contas_bancarias(db: AsyncSession = Depends(get_db)):
    await ensure_contas_bancarias_table(db)
    rows = (
        await db.execute(
            text("SELECT id, nome_conta, banco, agencia, cc, saldo FROM contas_bancarias ORDER BY id DESC")
        )
    ).all()
    return [
        {"id": r[0], "nome_conta": r[1], "banco": r[2], "agencia": r[3], "cc": r[4], "saldo": float(r[5] or 0)}
        for r in rows
    ]


@router.post("/contas-bancarias")
async def criar_conta_bancaria(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_contas_bancarias_table(db)
    nome = (payload.get("nome_conta") or "").strip()
    banco = (payload.get("banco") or "").strip()
    agencia = (payload.get("agencia") or "").strip()
    cc = (payload.get("cc") or "").strip()
    if not (nome and banco and agencia and cc):
        raise HTTPException(status_code=400, detail="Preencha nome da conta, banco, agencia e CC")
    row = (
        await db.execute(
            text(
                """
                INSERT INTO contas_bancarias (nome_conta, banco, agencia, cc, saldo)
                VALUES (:nome, :banco, :agencia, :cc, 0)
                RETURNING id
                """
            ),
            {"nome": nome, "banco": banco, "agencia": agencia, "cc": cc},
        )
    ).first()
    await db.commit()
    return {"id": row[0]}


@router.put("/contas-bancarias/{conta_id}")
async def atualizar_conta_bancaria(conta_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_contas_bancarias_table(db)
    res = await db.execute(
        text(
            """
            UPDATE contas_bancarias
            SET nome_conta = :nome, banco = :banco, agencia = :agencia, cc = :cc
            WHERE id = :id
            """
        ),
        {
            "id": conta_id,
            "nome": (payload.get("nome_conta") or "").strip(),
            "banco": (payload.get("banco") or "").strip(),
            "agencia": (payload.get("agencia") or "").strip(),
            "cc": (payload.get("cc") or "").strip(),
        },
    )
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Conta bancaria nao encontrada")
    return {"ok": True}


@router.delete("/contas-bancarias/{conta_id}")
async def excluir_conta_bancaria(conta_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_contas_bancarias_table(db)
    res = await db.execute(text("DELETE FROM contas_bancarias WHERE id = :id"), {"id": conta_id})
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Conta bancaria nao encontrada")
    return {"ok": True}


@router.get("/movimentacoes-financeiras")
async def listar_movimentacoes_financeiras(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            text(
                """
                SELECT id, data_movimento, tipo, valor, descricao
                FROM movimentos_bancarios
                ORDER BY data_movimento DESC, id DESC
                LIMIT 300
                """
            )
        )
    ).all()
    return [
        {
            "id": r[0],
            "data_movimento": r[1].strftime("%d/%m/%Y") if r[1] else "--",
            "tipo": r[2],
            "valor": float(r[3] or 0),
            "descricao": r[4] or "",
        }
        for r in rows
    ]
