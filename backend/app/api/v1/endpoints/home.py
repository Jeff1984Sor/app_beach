from datetime import date, datetime, timedelta
import calendar

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Usuario, Role, Aula, ContaReceber, Aluno, Profissional

router = APIRouter(prefix="/home", tags=["home"])


def brl(v: float) -> str:
    # UI formats as BRL, but keeping a string avoids float parsing on the client.
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


@router.get("/kpis")
async def home_kpis(user: Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    hoje = date.today()
    agora = datetime.utcnow()
    inicio_mes = hoje.replace(day=1)
    fim_mes = hoje.replace(day=calendar.monthrange(hoje.year, hoje.month)[1])

    # Resolve domain ids (if any)
    aluno = await db.scalar(select(Aluno).where(Aluno.usuario_id == user.id))
    prof = await db.scalar(select(Profissional).where(Profissional.usuario_id == user.id))

    if user.role == Role.gestor:
        aulas_hoje = int(
            (await db.scalar(select(func.count(Aula.id)).where(func.date(Aula.inicio) == hoje))) or 0
        )
        receita_hoje = float(
            (await db.scalar(select(func.sum(ContaReceber.valor)).where(ContaReceber.data_pagamento == hoje))) or 0
        )
        recebido_mes = float(
            (
                await db.scalar(
                    select(func.sum(ContaReceber.valor)).where(
                        ContaReceber.data_pagamento >= inicio_mes,
                        ContaReceber.data_pagamento <= fim_mes,
                    )
                )
            )
            or 0
        )
        a_receber = float(
            (await db.scalar(select(func.sum(ContaReceber.valor)).where(ContaReceber.status == "aberto"))) or 0
        )
        alunos_ativos = int(
            (await db.scalar(select(func.count(Aluno.id)).where(Aluno.status == "ativo"))) or 0
        )
        return {
            "role": user.role,
            "kpis": [
                {"label": "Aulas Hoje", "value": str(aulas_hoje)},
                {"label": "Receita Hoje", "value": brl(receita_hoje)},
                {"label": "Recebido (Mes)", "value": brl(recebido_mes)},
                {"label": "A Receber", "value": brl(a_receber)},
                {"label": "Alunos Ativos", "value": str(alunos_ativos)},
            ],
        }

    if user.role == Role.professor:
        prof_id = prof.id if prof else None
        aulas_hoje = int(
            (await db.scalar(select(func.count(Aula.id)).where(func.date(Aula.inicio) == hoje, Aula.professor_id == prof_id))) or 0
        ) if prof_id else 0
        proxima = (
            await db.execute(
                select(Aula.inicio)
                .where(Aula.professor_id == prof_id, Aula.inicio >= agora, Aula.status == "agendada")
                .order_by(Aula.inicio.asc())
                .limit(1)
            )
        ).first()
        proxima_hora = proxima[0].strftime("%H:%M") if proxima and proxima[0] else "--"

        # Comissao do mes atual (baseado nas aulas realizadas no mes anterior, pela regra) ainda nao vira saldo automatico aqui.
        # Exibimos soma de aulas realizadas no mes atual como referencia rapida.
        inicio_mes = hoje.replace(day=1)
        total_realizadas_mes = float(
            (await db.scalar(select(func.sum(Aula.valor)).where(Aula.professor_id == prof_id, Aula.status == "realizada", func.date(Aula.inicio) >= inicio_mes))) or 0
        ) if prof_id else 0
        return {
            "role": user.role,
            "kpis": [
                {"label": "Aulas Hoje", "value": str(aulas_hoje)},
                {"label": "Proxima Aula", "value": proxima_hora},
                {"label": "Total Realizado (Mes)", "value": brl(total_realizadas_mes)},
            ],
        }

    # aluno
    aluno_id = aluno.id if aluno else None
    proxima = (
        await db.execute(
            select(Aula.inicio)
            .where(Aula.aluno_id == aluno_id, Aula.inicio >= agora, Aula.status == "agendada")
            .order_by(Aula.inicio.asc())
            .limit(1)
        )
    ).first() if aluno_id else None
    proxima_hora = proxima[0].strftime("%H:%M") if proxima and proxima[0] else "--"

    inicio_semana = hoje - timedelta(days=hoje.weekday())
    fim_semana = inicio_semana + timedelta(days=6)
    aulas_semana = int(
        (await db.scalar(select(func.count(Aula.id)).where(Aula.aluno_id == aluno_id, func.date(Aula.inicio) >= inicio_semana, func.date(Aula.inicio) <= fim_semana))) or 0
    ) if aluno_id else 0
    pendencias = float(
        (await db.scalar(select(func.sum(ContaReceber.valor)).where(ContaReceber.aluno_id == aluno_id, ContaReceber.status == "aberto"))) or 0
    ) if aluno_id else 0
    return {
        "role": user.role,
        "kpis": [
            {"label": "Proxima Aula", "value": proxima_hora},
            {"label": "Aulas da Semana", "value": str(aulas_semana)},
            {"label": "Pendencias", "value": brl(pendencias)},
        ],
    }
