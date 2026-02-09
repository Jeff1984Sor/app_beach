from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.db.session import get_db
from app.models.entities import RegraComissao, Profissional, Usuario

router = APIRouter(prefix="/regras-comissao", tags=["regras-comissao"])


async def ensure_regras_comissao_columns(db: AsyncSession):
    await db.execute(
        text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'regras_comissao' AND column_name = 'tipo'
              ) THEN
                ALTER TABLE regras_comissao ADD COLUMN tipo VARCHAR(20) DEFAULT 'percentual';
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'regras_comissao' AND column_name = 'valor_por_aula'
              ) THEN
                ALTER TABLE regras_comissao ADD COLUMN valor_por_aula NUMERIC(10,2) DEFAULT 0;
              END IF;
            END $$;
            """
        )
    )
    await db.commit()


@router.get("")
async def listar_regras(db: AsyncSession = Depends(get_db)):
    await ensure_regras_comissao_columns(db)
    rows = (
        await db.execute(
            select(RegraComissao, Profissional, Usuario)
            .join(Profissional, Profissional.id == RegraComissao.profissional_id)
            .join(Usuario, Usuario.id == Profissional.usuario_id)
            .order_by(RegraComissao.id.desc())
        )
    ).all()
    return [
        {
            "id": r.RegraComissao.id,
            "profissional_id": r.RegraComissao.profissional_id,
            "professor_nome": r.Usuario.nome,
            "tipo": getattr(r.RegraComissao, "tipo", "percentual"),
            "percentual": float(getattr(r.RegraComissao, "percentual", 0) or 0),
            "valor_por_aula": float(getattr(r.RegraComissao, "valor_por_aula", 0) or 0),
        }
        for r in rows
    ]


@router.post("")
async def criar_regra(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_regras_comissao_columns(db)
    try:
        profissional_id = int(payload.get("profissional_id"))
    except Exception:
        raise HTTPException(status_code=400, detail="profissional_id invalido")
    tipo = (payload.get("tipo") or "percentual").strip().lower()
    if tipo not in ("percentual", "valor_aula"):
        raise HTTPException(status_code=400, detail="tipo deve ser percentual ou valor_aula")
    percentual = float(payload.get("percentual") or 0)
    valor_por_aula = float(payload.get("valor_por_aula") or 0)
    if tipo == "percentual" and percentual <= 0:
        raise HTTPException(status_code=400, detail="percentual deve ser > 0")
    if tipo == "valor_aula" and valor_por_aula <= 0:
        raise HTTPException(status_code=400, detail="valor_por_aula deve ser > 0")

    prof = await db.get(Profissional, profissional_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional nao encontrado")

    # 1 regra por professor (upsert simples)
    existente = await db.scalar(select(RegraComissao).where(RegraComissao.profissional_id == profissional_id))
    if existente:
        existente.tipo = tipo
        existente.percentual = percentual
        existente.valor_por_aula = valor_por_aula
        await db.commit()
        return {"ok": True, "id": existente.id, "updated": True}

    row = RegraComissao(profissional_id=profissional_id, tipo=tipo, percentual=percentual, valor_por_aula=valor_por_aula)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"ok": True, "id": row.id}


@router.put("/{regra_id}")
async def atualizar_regra(regra_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_regras_comissao_columns(db)
    row = await db.get(RegraComissao, regra_id)
    if not row:
        raise HTTPException(status_code=404, detail="Regra nao encontrada")
    tipo = (payload.get("tipo") or getattr(row, "tipo", "percentual")).strip().lower()
    if tipo not in ("percentual", "valor_aula"):
        raise HTTPException(status_code=400, detail="tipo deve ser percentual ou valor_aula")
    row.tipo = tipo
    if "percentual" in payload:
        row.percentual = float(payload.get("percentual") or 0)
    if "valor_por_aula" in payload:
        row.valor_por_aula = float(payload.get("valor_por_aula") or 0)
    await db.commit()
    return {"ok": True}


@router.delete("/{regra_id}")
async def deletar_regra(regra_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_regras_comissao_columns(db)
    row = await db.get(RegraComissao, regra_id)
    if not row:
        raise HTTPException(status_code=404, detail="Regra nao encontrada")
    await db.delete(row)
    await db.commit()
    return {"ok": True}

