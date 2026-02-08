from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta
from app.models.entities import Aula, ContaReceber, ContaPagar, RegraComissao


async def gerar_comissao(db: AsyncSession):
    hoje = date.today()
    inicio_mes_atual = hoje.replace(day=1)
    fim_mes_anterior = inicio_mes_atual - timedelta(days=1)
    inicio_mes_anterior = fim_mes_anterior.replace(day=1)

    aulas = await db.execute(
        select(Aula.professor_id, func.sum(Aula.valor)).where(
            Aula.inicio >= inicio_mes_anterior,
            Aula.inicio <= fim_mes_anterior,
            Aula.status == "realizada",
        ).group_by(Aula.professor_id)
    )
    regras = {r.profissional_id: float(r.percentual) for r in (await db.execute(select(RegraComissao))).scalars()}
    resultado = []
    for prof_id, total in aulas.all():
        perc = regras.get(prof_id, 0)
        valor = float(total or 0) * (perc / 100)
        resultado.append({"profissional_id": prof_id, "percentual": perc, "valor": round(valor, 2)})
    return resultado


async def dre(db: AsyncSession):
    receita = float((await db.scalar(select(func.sum(ContaReceber.valor)).where(ContaReceber.status == "pago"))) or 0)
    despesas = float((await db.scalar(select(func.sum(ContaPagar.valor)))) or 0)
    custo_aulas = float((await db.scalar(select(func.sum(Aula.valor)).where(Aula.status == "realizada"))) or 0)
    comissao = round(custo_aulas * 0.1, 2)
    resultado = receita - despesas - comissao
    total_aulas = int((await db.scalar(select(func.count(Aula.id)).where(Aula.status == "realizada"))) or 0)
    custo_por_aula = round((custo_aulas / total_aulas), 2) if total_aulas else 0

    detalhamento_receitas = (
        await db.execute(
            text(
                """
                SELECT COALESCE(categoria, 'Sem categoria') AS categoria,
                       COALESCE(subcategoria, 'Sem subcategoria') AS subcategoria,
                       COALESCE(SUM(valor), 0) AS total
                FROM movimentos_bancarios
                WHERE LOWER(COALESCE(tipo, '')) = 'entrada'
                GROUP BY categoria, subcategoria
                ORDER BY total DESC
                """
            )
        )
    ).all()

    return {
        "receita": receita,
        "despesas": despesas,
        "comissao": comissao,
        "custo_por_aula": custo_por_aula,
        "resultado_final": round(resultado, 2),
        "receitas_por_categoria": [
            {"categoria": r[0], "subcategoria": r[1], "total": float(r[2] or 0)} for r in detalhamento_receitas
        ],
    }
