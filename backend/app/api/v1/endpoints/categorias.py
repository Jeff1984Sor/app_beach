from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter(tags=["categorias"])


async def ensure_categorias_tables(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS categorias (
              id SERIAL PRIMARY KEY,
              nome VARCHAR(120) NOT NULL UNIQUE,
              tipo VARCHAR(20) NOT NULL DEFAULT 'Receita',
              status VARCHAR(20) NOT NULL DEFAULT 'ativo'
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS subcategorias (
              id SERIAL PRIMARY KEY,
              nome VARCHAR(120) NOT NULL,
              categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
              status VARCHAR(20) NOT NULL DEFAULT 'ativo'
            )
            """
        )
    )
    await db.commit()


@router.get("/categorias")
async def listar_categorias(db: AsyncSession = Depends(get_db)):
    await ensure_categorias_tables(db)
    rows = (
        await db.execute(
            text(
                """
                SELECT id, nome, tipo, status
                FROM categorias
                ORDER BY nome ASC
                """
            )
        )
    ).all()
    return [{"id": r[0], "nome": r[1], "tipo": r[2], "status": r[3]} for r in rows]


@router.post("/categorias")
async def criar_categoria(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_categorias_tables(db)
    nome = (payload.get("nome") or "").strip()
    tipo = (payload.get("tipo") or "Receita").strip().title()
    status = (payload.get("status") or "ativo").strip().lower()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da categoria e obrigatorio")
    if tipo not in {"Receita", "Despesa"}:
        raise HTTPException(status_code=400, detail="Tipo deve ser Receita ou Despesa")
    row = (
        await db.execute(
            text(
                """
                INSERT INTO categorias (nome, tipo, status)
                VALUES (:nome, :tipo, :status)
                RETURNING id
                """
            ),
            {"nome": nome, "tipo": tipo, "status": status},
        )
    ).first()
    await db.commit()
    return {"id": row[0]}


@router.put("/categorias/{categoria_id}")
async def atualizar_categoria(categoria_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_categorias_tables(db)
    nome = (payload.get("nome") or "").strip()
    tipo = (payload.get("tipo") or "Receita").strip().title()
    status = (payload.get("status") or "ativo").strip().lower()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da categoria e obrigatorio")
    if tipo not in {"Receita", "Despesa"}:
        raise HTTPException(status_code=400, detail="Tipo deve ser Receita ou Despesa")
    res = await db.execute(
        text(
            """
            UPDATE categorias
            SET nome = :nome, tipo = :tipo, status = :status
            WHERE id = :id
            """
        ),
        {"id": categoria_id, "nome": nome, "tipo": tipo, "status": status},
    )
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")
    return {"ok": True}


@router.delete("/categorias/{categoria_id}")
async def excluir_categoria(categoria_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_categorias_tables(db)
    res = await db.execute(text("DELETE FROM categorias WHERE id = :id"), {"id": categoria_id})
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")
    return {"ok": True}


@router.get("/subcategorias")
async def listar_subcategorias(db: AsyncSession = Depends(get_db)):
    await ensure_categorias_tables(db)
    rows = (
        await db.execute(
            text(
                """
                SELECT s.id, s.nome, s.categoria_id, c.nome AS categoria_nome, c.tipo AS categoria_tipo, s.status
                FROM subcategorias s
                JOIN categorias c ON c.id = s.categoria_id
                ORDER BY s.nome ASC
                """
            )
        )
    ).all()
    return [
        {
            "id": r[0],
            "nome": r[1],
            "categoria_id": r[2],
            "categoria_nome": r[3],
            "categoria_tipo": r[4],
            "status": r[5],
        }
        for r in rows
    ]


@router.post("/subcategorias")
async def criar_subcategoria(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_categorias_tables(db)
    nome = (payload.get("nome") or "").strip()
    categoria_id = payload.get("categoria_id")
    status = (payload.get("status") or "ativo").strip().lower()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da subcategoria e obrigatorio")
    if not categoria_id:
        raise HTTPException(status_code=400, detail="Categoria e obrigatoria")
    categoria = (await db.execute(text("SELECT id FROM categorias WHERE id = :id"), {"id": int(categoria_id)})).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")
    row = (
        await db.execute(
            text(
                """
                INSERT INTO subcategorias (nome, categoria_id, status)
                VALUES (:nome, :categoria_id, :status)
                RETURNING id
                """
            ),
            {"nome": nome, "categoria_id": int(categoria_id), "status": status},
        )
    ).first()
    await db.commit()
    return {"id": row[0]}


@router.put("/subcategorias/{subcategoria_id}")
async def atualizar_subcategoria(subcategoria_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_categorias_tables(db)
    nome = (payload.get("nome") or "").strip()
    categoria_id = payload.get("categoria_id")
    status = (payload.get("status") or "ativo").strip().lower()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da subcategoria e obrigatorio")
    if not categoria_id:
        raise HTTPException(status_code=400, detail="Categoria e obrigatoria")
    categoria = (await db.execute(text("SELECT id FROM categorias WHERE id = :id"), {"id": int(categoria_id)})).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")
    res = await db.execute(
        text(
            """
            UPDATE subcategorias
            SET nome = :nome, categoria_id = :categoria_id, status = :status
            WHERE id = :id
            """
        ),
        {"id": subcategoria_id, "nome": nome, "categoria_id": int(categoria_id), "status": status},
    )
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Subcategoria nao encontrada")
    return {"ok": True}


@router.delete("/subcategorias/{subcategoria_id}")
async def excluir_subcategoria(subcategoria_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_categorias_tables(db)
    res = await db.execute(text("DELETE FROM subcategorias WHERE id = :id"), {"id": subcategoria_id})
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Subcategoria nao encontrada")
    return {"ok": True}
