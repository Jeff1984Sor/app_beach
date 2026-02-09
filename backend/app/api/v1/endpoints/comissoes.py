from datetime import date, timedelta, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.db.session import get_db
from app.models.entities import Aula, RegraComissao, ContaPagar, Profissional, Usuario
from app.api.v1.endpoints.contas_pagar import ensure_contas_pagar_columns
from app.api.v1.endpoints.regras_comissao import ensure_regras_comissao_columns

router = APIRouter(prefix="/comissoes", tags=["comissoes"])


def mes_anterior(ref: date) -> str:
    inicio_mes = ref.replace(day=1)
    ultimo_mes_anterior = inicio_mes - timedelta(days=1)
    return f"{ultimo_mes_anterior.year:04d}-{ultimo_mes_anterior.month:02d}"


def parse_ym(s: str) -> tuple[date, date]:
    try:
        yy, mm = s.split("-")
        y = int(yy)
        m = int(mm)
        inicio = date(y, m, 1)
        if m == 12:
            prox = date(y + 1, 1, 1)
        else:
            prox = date(y, m + 1, 1)
        fim = prox - timedelta(days=1)
        return inicio, fim
    except Exception:
        raise HTTPException(status_code=400, detail="mes_referencia invalido. Use YYYY-MM")


@router.post("/gerar-contas-pagar")
async def gerar_contas_pagar_comissao(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_regras_comissao_columns(db)
    await ensure_contas_pagar_columns(db)

    hoje = date.today()
    mes_ref = payload.get("mes_referencia") or mes_anterior(hoje)
    inicio, fim = parse_ym(str(mes_ref))

    venc_raw = payload.get("vencimento")
    if venc_raw:
        try:
            vencimento = datetime.strptime(venc_raw, "%Y-%m-%d").date()
        except Exception:
            raise HTTPException(status_code=400, detail="vencimento invalido. Use YYYY-MM-DD")
    else:
        # default: dia 5 do mes atual
        vencimento = hoje.replace(day=5)

    # Map regras
    regras = {
        r.profissional_id: {
            "tipo": (getattr(r, "tipo", "percentual") or "percentual"),
            "percentual": float(getattr(r, "percentual", 0) or 0),
            "valor_por_aula": float(getattr(r, "valor_por_aula", 0) or 0),
        }
        for r in (await db.execute(select(RegraComissao))).scalars().all()
    }

    # Base: aulas realizadas no periodo, por professor
    sums = (
        await db.execute(
            select(Aula.professor_id, func.sum(Aula.valor), func.count(Aula.id))
            .where(
                func.date(Aula.inicio) >= inicio,
                func.date(Aula.inicio) <= fim,
                Aula.status == "realizada",
            )
            .group_by(Aula.professor_id)
        )
    ).all()

    criadas = []
    ignoradas = []
    for prof_id, total_valor, qtd_aulas in sums:
        regra = regras.get(prof_id)
        if not regra:
            ignoradas.append({"profissional_id": prof_id, "motivo": "Sem regra de comissao"})
            continue

        tipo = (regra.get("tipo") or "percentual").lower()
        if tipo == "valor_aula":
            valor = float(qtd_aulas or 0) * float(regra.get("valor_por_aula") or 0)
            base = f"{int(qtd_aulas or 0)} aula(s)"
        else:
            valor = float(total_valor or 0) * (float(regra.get("percentual") or 0) / 100.0)
            base = f"{float(total_valor or 0):.2f}"

        valor = round(valor, 2)
        if valor <= 0:
            ignoradas.append({"profissional_id": prof_id, "motivo": "Comissao zerada"})
            continue

        # Evita duplicar por professor + mes
        existe = await db.scalar(
            select(ContaPagar.id).where(
                ContaPagar.profissional_id == prof_id,
                ContaPagar.referencia_mes == str(mes_ref),
                ContaPagar.categoria == "Comissao",
            )
        )
        if existe:
            ignoradas.append({"profissional_id": prof_id, "motivo": "Ja gerada"})
            continue

        prof = await db.get(Profissional, prof_id)
        nome = ""
        if prof:
            user = await db.get(Usuario, prof.usuario_id)
            nome = user.nome if user else ""

        descricao = f"Comissao {nome or ('Professor ' + str(prof_id))} - {mes_ref} ({tipo})"
        row = ContaPagar(
            vencimento=vencimento,
            valor=valor,
            descricao=descricao,
            categoria="Comissao",
            subcategoria=nome or None,
            status="aberto",
            profissional_id=prof_id,
            referencia_mes=str(mes_ref),
        )
        db.add(row)
        await db.flush()
        criadas.append({"id": row.id, "profissional_id": prof_id, "professor_nome": nome, "valor": valor, "base": base, "tipo": tipo})

    await db.commit()
    return {"ok": True, "mes_referencia": str(mes_ref), "vencimento": vencimento.strftime("%Y-%m-%d"), "criadas": criadas, "ignoradas": ignoradas}

