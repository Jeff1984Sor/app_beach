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
        select(Aula.professor_id, func.sum(Aula.valor), func.count(Aula.id)).where(
            Aula.inicio >= inicio_mes_anterior,
            Aula.inicio <= fim_mes_anterior,
            Aula.status == "realizada",
        ).group_by(Aula.professor_id)
    )
    regras = {
        r.profissional_id: {
            "tipo": (getattr(r, "tipo", "percentual") or "percentual"),
            "percentual": float(getattr(r, "percentual", 0) or 0),
            "valor_por_aula": float(getattr(r, "valor_por_aula", 0) or 0),
        }
        for r in (await db.execute(select(RegraComissao))).scalars().all()
    }
    resultado = []
    for prof_id, total, qtd in aulas.all():
        regra = regras.get(prof_id) or {"tipo": "percentual", "percentual": 0, "valor_por_aula": 0}
        tipo = (regra.get("tipo") or "percentual").lower()
        if tipo == "valor_aula":
            valor = float(qtd or 0) * float(regra.get("valor_por_aula") or 0)
            resultado.append(
                {
                    "profissional_id": prof_id,
                    "tipo": "valor_aula",
                    "qtd_aulas": int(qtd or 0),
                    "valor_por_aula": float(regra.get("valor_por_aula") or 0),
                    "valor": round(valor, 2),
                }
            )
        else:
            perc = float(regra.get("percentual") or 0)
            valor = float(total or 0) * (perc / 100)
            resultado.append(
                {
                    "profissional_id": prof_id,
                    "tipo": "percentual",
                    "percentual": perc,
                    "base": float(total or 0),
                    "valor": round(valor, 2),
                }
            )
    return resultado


async def dre(db: AsyncSession):
    receita = float((await db.scalar(select(func.sum(ContaReceber.valor)).where(ContaReceber.status == "pago"))) or 0)
    despesas = float((await db.scalar(select(func.sum(ContaPagar.valor)))) or 0)
    custo_aulas = float((await db.scalar(select(func.sum(Aula.valor)).where(Aula.status == "realizada"))) or 0)
    # Comissao real: contas a pagar categorizadas como "Comissao"
    comissao = float((await db.scalar(select(func.sum(ContaPagar.valor)).where(ContaPagar.categoria == "Comissao"))) or 0)
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
