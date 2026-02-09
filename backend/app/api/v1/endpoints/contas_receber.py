from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_db

router = APIRouter(prefix="/contas-receber", tags=["contas-receber"])


@router.get("")
async def listar_contas_receber(
    status: str | None = Query(default=None, description="Filtra por status: aberto/pago"),
    db: AsyncSession = Depends(get_db),
):
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
                  u.nome AS aluno_nome,
                  cr.contrato_id,
                  COALESCE(c.plano_nome, '') AS plano_nome,
                  cr.valor,
                  cr.vencimento,
                  COALESCE(cr.status, 'aberto') AS status,
                  cr.data_pagamento
                FROM contas_receber cr
                JOIN alunos a ON a.id = cr.aluno_id
                JOIN usuarios u ON u.id = a.usuario_id
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
        }
        for r in rows
    ]

