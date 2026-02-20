from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.endpoints.regras_comissao import ensure_regras_comissao_columns

router = APIRouter(prefix="/relatorios", tags=["relatorios"])

BR_TZ = ZoneInfo("America/Sao_Paulo")


def period_to_dates(periodo: str, data_inicio: str | None, data_fim: str | None) -> tuple[date, date]:
    hoje = date.today()
    if periodo == "custom":
        if not data_inicio or not data_fim:
            raise HTTPException(status_code=400, detail="Informe data_inicio e data_fim")
        ini = datetime.strptime(data_inicio, "%Y-%m-%d").date()
        fim = datetime.strptime(data_fim, "%Y-%m-%d").date()
        return ini, fim
    if periodo == "semana":
        ini = hoje - timedelta(days=hoje.weekday())
        return ini, hoje
    if periodo == "mes":
        ini = date(hoje.year, hoje.month, 1)
        return ini, hoje
    raise HTTPException(status_code=400, detail="Periodo invalido")


@router.get("/quantidade-aulas-professor")
async def relatorio_quantidade_aulas_professor(
    professor_id: int = Query(...),
    periodo: str = Query(default="mes"),
    data_inicio: str | None = Query(default=None),
    data_fim: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    await ensure_regras_comissao_columns(db)
    dt_ini, dt_fim = period_to_dates(periodo, data_inicio, data_fim)

    prof = (
        await db.execute(
            text(
                """
                SELECT p.id, COALESCE(u.nome, 'Sem professor')
                FROM profissionais p
                LEFT JOIN usuarios u ON u.id = p.usuario_id
                WHERE p.id = :id
                """
            ),
            {"id": professor_id},
        )
    ).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professor nao encontrado")

    regra = (
        await db.execute(
            text(
                """
                SELECT tipo, percentual, valor_por_aula
                FROM regras_comissao
                WHERE profissional_id = :id
                ORDER BY id DESC
                LIMIT 1
                """
            ),
            {"id": professor_id},
        )
    ).first()
    valor_por_aula = float(regra[2] or 0) if regra and str(regra[0] or "") == "valor_aula" else 0.0

    rows = (
        await db.execute(
            text(
                """
                SELECT a.id, a.inicio, COALESCE(a.status, 'agendada') AS status,
                       COALESCE(ua.nome, 'Sem aluno') AS aluno_nome
                FROM aulas a
                LEFT JOIN alunos al ON al.id = a.aluno_id
                LEFT JOIN usuarios ua ON ua.id = al.usuario_id
                WHERE a.professor_id = :professor_id
                  AND DATE(a.inicio AT TIME ZONE 'America/Sao_Paulo') BETWEEN :ini AND :fim
                ORDER BY a.inicio ASC
                """
            ),
            {"professor_id": professor_id, "ini": dt_ini, "fim": dt_fim},
        )
    ).all()

    aulas = []
    qtd_total = 0
    qtd_realizadas = 0
    for r in rows:
        dt = r[1]
        dt_br = dt.astimezone(BR_TZ) if getattr(dt, "tzinfo", None) else dt
        status = str(r[2] or "").lower()
        if status == "cancelada":
            continue
        qtd_total += 1
        if status == "realizada":
            qtd_realizadas += 1
        aulas.append(
            {
                "id": r[0],
                "data": dt_br.strftime("%Y-%m-%d"),
                "data_br": dt_br.strftime("%d/%m/%Y"),
                "hora_br": dt_br.strftime("%H:%M"),
                "aluno_nome": r[3] or "Sem aluno",
                "status": status or "agendada",
            }
        )

    return {
        "professor_id": int(prof[0]),
        "professor_nome": prof[1],
        "periodo": {"data_inicio": dt_ini.strftime("%Y-%m-%d"), "data_fim": dt_fim.strftime("%Y-%m-%d")},
        "valor_por_aula": valor_por_aula,
        "quantidade_aulas": qtd_total,
        "quantidade_realizadas": qtd_realizadas,
        "total_estimado": round(valor_por_aula * qtd_total, 2),
        "aulas": aulas,
    }
