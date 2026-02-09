from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.request import urlopen
import json
from app.db.session import get_db
from app.models.entities import EmpresaConfig

router = APIRouter(tags=["public"])


@router.get("/public/branding")
async def branding(db: AsyncSession = Depends(get_db)):
    cfg = await db.scalar(select(EmpresaConfig).limit(1))
    if not cfg:
        return {"nome_fantasia": "Next Level Assessoria Esportiva", "logo_url": None, "cor_primaria": "#0A84FF"}
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

    try:
        with urlopen(f"https://viacep.com.br/ws/{cep_clean}/json/", timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data.get("erro"):
                raise HTTPException(status_code=404, detail="CEP nao encontrado")
            return {
                "cep": cep_clean,
                "logradouro": data.get("logradouro"),
                "bairro": data.get("bairro"),
                "cidade": data.get("localidade"),
                "uf": data.get("uf"),
            }
    except HTTPException:
        raise
    except Exception:
        return {"cep": cep_clean, "logradouro": "", "bairro": "", "cidade": "", "uf": ""}
