from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.entities import EmpresaConfig

router = APIRouter(tags=["public"])


@router.get("/public/branding")
async def branding(db: AsyncSession = Depends(get_db)):
    cfg = await db.scalar(select(EmpresaConfig).limit(1))
    if not cfg:
        return {"nome_fantasia": "Beach Club", "logo_url": None, "cor_primaria": "#0A84FF"}
    return {
        "nome_fantasia": cfg.nome_fantasia,
        "logo_url": cfg.logo_url,
        "cor_primaria": cfg.cor_primaria,
    }


@router.get("/public/cep/{cep}")
async def cep_lookup(cep: str):
    cep_clean = cep.replace("-", "")
    if len(cep_clean) != 8 or not cep_clean.isdigit():
        raise HTTPException(status_code=400, detail="CEP invalido")
    return {"cep": cep, "logradouro": "Rua Exemplo", "bairro": "Centro", "cidade": "São Paulo", "uf": "SP"}


