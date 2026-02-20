from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter(prefix="/planos", tags=["planos"])


def meses_por_recorrencia(recorrencia: str) -> int:
    r = str(recorrencia or "mensal").strip().lower()
    if r == "trimestral":
        return 3
    if r == "semestral":
        return 6
    if r == "anual":
        return 12
    return 1


def calcular_valor_por_aula(valor_total: float, recorrencia: str, qtd_aulas_semanais: int) -> float:
    semanas_mes = 4.0
    qtd = max(int(qtd_aulas_semanais or 0), 1)
    meses = max(meses_por_recorrencia(recorrencia), 1)
    valor_mensal = float(valor_total or 0) / meses
    return round(valor_mensal / (semanas_mes * qtd), 2)


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
              valor_por_aula NUMERIC(10,2) NOT NULL DEFAULT 0,
              categoria VARCHAR(120),
              subcategoria VARCHAR(120),
              status VARCHAR(20) NOT NULL DEFAULT 'ativo'
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
                WHERE table_name = 'planos' AND column_name = 'categoria'
              ) THEN
                ALTER TABLE planos ADD COLUMN categoria VARCHAR(120);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'planos' AND column_name = 'subcategoria'
              ) THEN
                ALTER TABLE planos ADD COLUMN subcategoria VARCHAR(120);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'planos' AND column_name = 'valor_por_aula'
              ) THEN
                ALTER TABLE planos ADD COLUMN valor_por_aula NUMERIC(10,2) NOT NULL DEFAULT 0;
              END IF;
            END $$;
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
                SELECT id, nome, valor, recorrencia, qtd_aulas_semanais, valor_por_aula, categoria, subcategoria, status
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
            "valor_por_aula": float(r[5] or 0),
            "categoria": r[6],
            "subcategoria": r[7],
            "status": r[8],
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
    valor_por_aula = calcular_valor_por_aula(valor, recorrencia, qtd_aulas_semanais)
    categoria = (payload.get("categoria") or "").strip() or None
    subcategoria = (payload.get("subcategoria") or "").strip() or None
    status = (payload.get("status") or "ativo").lower()
    row = (
        await db.execute(
            text(
                """
                INSERT INTO planos (nome, valor, recorrencia, qtd_aulas_semanais, valor_por_aula, categoria, subcategoria, status)
                VALUES (:nome, :valor, :recorrencia, :qtd_aulas_semanais, :valor_por_aula, :categoria, :subcategoria, :status)
                RETURNING id
                """
            ),
            {
                "nome": nome,
                "valor": valor,
                "recorrencia": recorrencia,
                "qtd_aulas_semanais": qtd_aulas_semanais,
                "valor_por_aula": valor_por_aula,
                "categoria": categoria,
                "subcategoria": subcategoria,
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
                valor_por_aula = :valor_por_aula,
                categoria = :categoria,
                subcategoria = :subcategoria,
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
            "valor_por_aula": calcular_valor_por_aula(
                float(payload.get("valor") or 0),
                (payload.get("recorrencia") or "mensal").lower(),
                int(payload.get("qtd_aulas_semanais") or 1),
            ),
            "categoria": (payload.get("categoria") or "").strip() or None,
            "subcategoria": (payload.get("subcategoria") or "").strip() or None,
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
