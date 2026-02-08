from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter(prefix="/planos", tags=["planos"])


async def ensure_planos_table(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS planos (
              id SERIAL PRIMARY KEY,
              nome VARCHAR(120) NOT NULL,
              valor NUMERIC(10,2) NOT NULL DEFAULT 0,
              recorrencia VARCHAR(20) NOT NULL DEFAULT 'mensal',
              qtd_aulas_semanais INTEGER NOT NULL DEFAULT 1,
              status VARCHAR(20) NOT NULL DEFAULT 'ativo'
            )
            """
        )
    )
    await db.commit()


@router.get("")
async def listar_planos(db: AsyncSession = Depends(get_db)):
    await ensure_planos_table(db)
    rows = (
        await db.execute(
            text(
                """
                SELECT id, nome, valor, recorrencia, qtd_aulas_semanais, status
                FROM planos
                ORDER BY id DESC
                """
            )
        )
    ).all()
    return [
        {
            "id": r[0],
            "nome": r[1],
            "valor": float(r[2] or 0),
            "recorrencia": r[3],
            "qtd_aulas_semanais": int(r[4] or 0),
            "status": r[5],
        }
        for r in rows
    ]


@router.post("")
async def criar_plano(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_planos_table(db)
    nome = (payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome do plano e obrigatorio")
    valor = float(payload.get("valor") or 0)
    recorrencia = (payload.get("recorrencia") or "mensal").lower()
    qtd_aulas_semanais = int(payload.get("qtd_aulas_semanais") or 1)
    status = (payload.get("status") or "ativo").lower()
    row = (
        await db.execute(
            text(
                """
                INSERT INTO planos (nome, valor, recorrencia, qtd_aulas_semanais, status)
                VALUES (:nome, :valor, :recorrencia, :qtd_aulas_semanais, :status)
                RETURNING id
                """
            ),
            {
                "nome": nome,
                "valor": valor,
                "recorrencia": recorrencia,
                "qtd_aulas_semanais": qtd_aulas_semanais,
                "status": status,
            },
        )
    ).first()
    await db.commit()
    return {"id": row[0]}


@router.put("/{plano_id}")
async def atualizar_plano(plano_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_planos_table(db)
    res = await db.execute(
        text(
            """
            UPDATE planos
            SET nome = :nome,
                valor = :valor,
                recorrencia = :recorrencia,
                qtd_aulas_semanais = :qtd_aulas_semanais,
                status = :status
            WHERE id = :id
            """
        ),
        {
            "id": plano_id,
            "nome": (payload.get("nome") or "").strip(),
            "valor": float(payload.get("valor") or 0),
            "recorrencia": (payload.get("recorrencia") or "mensal").lower(),
            "qtd_aulas_semanais": int(payload.get("qtd_aulas_semanais") or 1),
            "status": (payload.get("status") or "ativo").lower(),
        },
    )
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Plano nao encontrado")
    return {"ok": True}


@router.delete("/{plano_id}")
async def apagar_plano(plano_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_planos_table(db)
    res = await db.execute(text("DELETE FROM planos WHERE id = :id"), {"id": plano_id})
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Plano nao encontrado")
    return {"ok": True}
