from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import date, datetime

from app.db.session import get_db

router = APIRouter(prefix="/contas-receber", tags=["contas-receber"])

async def ensure_finance_columns(db: AsyncSession):
    # Keep in sync with alunos.ensure_finance_columns (minimal subset used here).
    await db.execute(
        text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'data_pagamento'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN data_pagamento DATE;
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'conta_bancaria_id'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN conta_bancaria_id INTEGER;
              END IF;
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'aluno_id' AND is_nullable = 'NO'
              ) THEN
                ALTER TABLE contas_receber ALTER COLUMN aluno_id DROP NOT NULL;
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'cliente_nome'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN cliente_nome VARCHAR(120);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'descricao'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN descricao VARCHAR(255);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'categoria'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN categoria VARCHAR(120);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'subcategoria'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN subcategoria VARCHAR(120);
              END IF;
            END $$;
            """
        )
    )
    await db.commit()


@router.get("")
async def listar_contas_receber(
    status: str | None = Query(default=None, description="Filtra por status: aberto/pago"),
    db: AsyncSession = Depends(get_db),
):
    await ensure_finance_columns(db)
    where_status = ""
    params: dict[str, object] = {}
    if status:
        where_status = " AND LOWER(COALESCE(cr.status, 'aberto')) = LOWER(:status) "
        params["status"] = status

    rows = (
        await db.execute(
            text(
                f"""
                SELECT
                  cr.id,
                  cr.aluno_id,
                  COALESCE(u.nome, cr.cliente_nome, 'Sem cliente') AS aluno_nome,
                  cr.contrato_id,
                  COALESCE(c.plano_nome, '') AS plano_nome,
                  cr.valor,
                  cr.vencimento,
                  COALESCE(cr.status, 'aberto') AS status,
                  cr.data_pagamento,
                  COALESCE(cr.categoria, '') AS categoria,
                  COALESCE(cr.subcategoria, '') AS subcategoria,
                  COALESCE(cr.descricao, '') AS descricao,
                  CASE
                    WHEN cr.aluno_id IS NULL THEN NULL
                    ELSE (
                      SELECT COUNT(1)
                      FROM aulas a2
                      WHERE a2.aluno_id = cr.aluno_id
                        AND LOWER(COALESCE(a2.status, 'agendada')) <> 'realizada'
                    )
                  END AS aulas_pendentes
                FROM contas_receber cr
                LEFT JOIN alunos a ON a.id = cr.aluno_id
                LEFT JOIN usuarios u ON u.id = a.usuario_id
                LEFT JOIN aluno_contratos c ON c.id = cr.contrato_id
                WHERE 1=1
                {where_status}
                ORDER BY cr.vencimento DESC, cr.id DESC
                """
            ),
            params,
        )
    ).all()

    return [
        {
            "id": r[0],
            "aluno_id": r[1],
            "aluno_nome": r[2],
            "contrato_id": r[3],
            "plano_nome": r[4],
            "valor": float(r[5] or 0),
            "vencimento": r[6].strftime("%d/%m/%Y") if r[6] else "--",
            "status": r[7],
            "data_pagamento": r[8].strftime("%d/%m/%Y") if r[8] else None,
            "categoria": r[9],
            "subcategoria": r[10],
            "descricao": r[11],
            "aulas_pendentes": (int(r[12]) if r[12] is not None else None),
        }
        for r in rows
    ]


@router.post("/{conta_id}/pagar")
async def pagar_conta_receber(conta_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_finance_columns(db)
    data_pagamento_txt = payload.get("data_pagamento") or date.today().strftime("%Y-%m-%d")
    conta_bancaria_id = payload.get("conta_bancaria_id")
    try:
        data_pagamento = datetime.strptime(data_pagamento_txt, "%Y-%m-%d").date()
    except Exception:
        raise ValueError("Data de pagamento invalida")

    row = (
        await db.execute(
            text(
                """
                SELECT cr.id, cr.valor, cr.contrato_id, cr.aluno_id, u.nome
                     , cr.cliente_nome, cr.descricao, cr.categoria, cr.subcategoria
                FROM contas_receber cr
                LEFT JOIN alunos a ON a.id = cr.aluno_id
                LEFT JOIN usuarios u ON u.id = a.usuario_id
                WHERE cr.id = :id
                """
            ),
            {"id": conta_id},
        )
    ).first()
    if not row:
        return {"ok": False, "detail": "Conta a receber nao encontrada"}

    plano_nome = "Sem plano"
    categoria = row[7] if len(row) > 7 and row[7] else None
    subcategoria = row[8] if len(row) > 8 and row[8] else None
    if row[2]:
        c = (await db.execute(text("SELECT plano_nome FROM aluno_contratos WHERE id = :id"), {"id": row[2]})).first()
        if c and c[0]:
            plano_nome = c[0]
            p = (
                await db.execute(
                    text("SELECT categoria, subcategoria FROM planos WHERE nome = :nome ORDER BY id DESC LIMIT 1"),
                    {"nome": plano_nome},
                )
            ).first()
            if p:
                categoria = p[0]
                subcategoria = p[1]

    comprador_nome = row[4] or row[5] or "Cliente"
    descricao_mov = row[6] or f"{comprador_nome} + {plano_nome}"

    await db.execute(
        text(
            """
            UPDATE contas_receber
            SET status = 'pago', data_pagamento = :data_pagamento, conta_bancaria_id = :conta_bancaria_id
            WHERE id = :id
            """
        ),
        {"data_pagamento": data_pagamento, "conta_bancaria_id": conta_bancaria_id, "id": conta_id},
    )

    if conta_bancaria_id:
        await db.execute(
            text("UPDATE contas_bancarias SET saldo = COALESCE(saldo, 0) + :valor WHERE id = :id"),
            {"valor": float(row[1] or 0), "id": int(conta_bancaria_id)},
        )

    await db.execute(
        text(
            """
            INSERT INTO movimentos_bancarios (data_movimento, tipo, valor, descricao, categoria, subcategoria, conta_bancaria_id, created_at, updated_at)
            VALUES (:data_movimento, 'entrada', :valor, :descricao, :categoria, :subcategoria, :conta_bancaria_id, NOW(), NOW())
            """
        ),
        {
            "data_movimento": data_pagamento,
            "valor": float(row[1] or 0),
            "descricao": descricao_mov,
            "categoria": categoria,
            "subcategoria": subcategoria,
            "conta_bancaria_id": conta_bancaria_id,
        },
    )
    await db.commit()
    return {"ok": True}
