from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.db.session import get_db
from app.models.entities import ContaPagar

router = APIRouter(prefix="/contas-pagar", tags=["contas-pagar"])


async def ensure_contas_pagar_columns(db: AsyncSession):
    await db.execute(
        text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_pagar' AND column_name = 'categoria'
              ) THEN
                ALTER TABLE contas_pagar ADD COLUMN categoria VARCHAR(120);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_pagar' AND column_name = 'subcategoria'
              ) THEN
                ALTER TABLE contas_pagar ADD COLUMN subcategoria VARCHAR(120);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_pagar' AND column_name = 'status'
              ) THEN
                ALTER TABLE contas_pagar ADD COLUMN status VARCHAR(20) DEFAULT 'aberto';
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_pagar' AND column_name = 'data_pagamento'
              ) THEN
                ALTER TABLE contas_pagar ADD COLUMN data_pagamento DATE;
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_pagar' AND column_name = 'profissional_id'
              ) THEN
                ALTER TABLE contas_pagar ADD COLUMN profissional_id INTEGER;
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_pagar' AND column_name = 'referencia_mes'
              ) THEN
                ALTER TABLE contas_pagar ADD COLUMN referencia_mes VARCHAR(7);
              END IF;
            END $$;
            """
        )
    )
    await db.commit()


def add_months(d: date, months: int) -> date:
    yy = d.year + (d.month - 1 + months) // 12
    mm = (d.month - 1 + months) % 12 + 1
    # clamp day to month length
    import calendar

    last_day = calendar.monthrange(yy, mm)[1]
    dd = min(d.day, last_day)
    return date(yy, mm, dd)


@router.get("")
async def listar_contas_pagar(db: AsyncSession = Depends(get_db)):
    await ensure_contas_pagar_columns(db)
    rows = (await db.execute(select(ContaPagar).order_by(ContaPagar.vencimento.desc(), ContaPagar.id.desc()))).scalars().all()
    return [
        {
            "id": r.id,
            "descricao": r.descricao,
            "valor": float(r.valor or 0),
            "vencimento": r.vencimento.strftime("%Y-%m-%d") if r.vencimento else None,
            "vencimento_br": r.vencimento.strftime("%d/%m/%Y") if r.vencimento else "--",
            "categoria": getattr(r, "categoria", None),
            "subcategoria": getattr(r, "subcategoria", None),
            "status": getattr(r, "status", "aberto"),
            "data_pagamento": r.data_pagamento.strftime("%Y-%m-%d") if getattr(r, "data_pagamento", None) else None,
            "data_pagamento_br": r.data_pagamento.strftime("%d/%m/%Y") if getattr(r, "data_pagamento", None) else None,
        }
        for r in rows
    ]


@router.post("")
async def criar_conta_pagar(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_contas_pagar_columns(db)
    descricao = (payload.get("descricao") or payload.get("titulo") or "").strip()
    if not descricao:
        raise HTTPException(status_code=400, detail="Informe a descricao")
    try:
        valor = float(payload.get("valor") or 0)
    except Exception:
        raise HTTPException(status_code=400, detail="Valor invalido")
    if valor <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")

    venc_raw = payload.get("vencimento") or payload.get("data")
    try:
        venc = datetime.strptime(venc_raw, "%Y-%m-%d").date() if venc_raw else date.today()
    except Exception:
        raise HTTPException(status_code=400, detail="Vencimento invalido. Use AAAA-MM-DD")

    categoria = (payload.get("categoria") or "").strip() or None
    subcategoria = (payload.get("subcategoria") or "").strip() or None

    recorrencia = (payload.get("recorrencia") or "").strip().lower()
    qtd = int(payload.get("quantidade_recorrencias") or payload.get("qtd_recorrencias") or 1)
    if recorrencia in ("mensal", "monthly"):
        qtd = max(1, min(qtd, 60))
        ids: list[int] = []
        for i in range(qtd):
            row = ContaPagar(
                descricao=descricao,
                valor=valor,
                vencimento=add_months(venc, i),
                categoria=categoria,
                subcategoria=subcategoria,
                status="aberto",
            )
            db.add(row)
            await db.flush()
            ids.append(row.id)
        await db.commit()
        return {"ok": True, "ids": ids, "criadas": len(ids)}

    # sem recorrencia
    row = ContaPagar(
        descricao=descricao,
        valor=valor,
        vencimento=venc,
        categoria=categoria,
        subcategoria=subcategoria,
        status="aberto",
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"ok": True, "id": row.id}


@router.put("/{conta_id}")
async def atualizar_conta_pagar(conta_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_contas_pagar_columns(db)
    row = await db.get(ContaPagar, conta_id)
    if not row:
        raise HTTPException(status_code=404, detail="Conta a pagar nao encontrada")

    if "descricao" in payload or "titulo" in payload:
        row.descricao = (payload.get("descricao") or payload.get("titulo") or "").strip() or row.descricao
    if "valor" in payload:
        try:
            row.valor = float(payload.get("valor") or 0)
        except Exception:
            raise HTTPException(status_code=400, detail="Valor invalido")
    if "vencimento" in payload:
        try:
            row.vencimento = datetime.strptime(payload.get("vencimento"), "%Y-%m-%d").date()
        except Exception:
            raise HTTPException(status_code=400, detail="Vencimento invalido. Use AAAA-MM-DD")
    if "categoria" in payload:
        row.categoria = (payload.get("categoria") or "").strip() or None
    if "subcategoria" in payload:
        row.subcategoria = (payload.get("subcategoria") or "").strip() or None
    if "status" in payload:
        row.status = (payload.get("status") or "aberto").strip().lower()
    await db.commit()
    return {"ok": True}


@router.delete("/{conta_id}")
async def deletar_conta_pagar(conta_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_contas_pagar_columns(db)
    row = await db.get(ContaPagar, conta_id)
    if not row:
        raise HTTPException(status_code=404, detail="Conta a pagar nao encontrada")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
