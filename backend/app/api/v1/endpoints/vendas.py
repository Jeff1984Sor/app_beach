from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.endpoints.produtos import ensure_produtos_table

router = APIRouter(prefix="/vendas", tags=["vendas"])


async def ensure_categorias_venda(db: AsyncSession):
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
    row_cat = (
        await db.execute(
            text("SELECT id FROM categorias WHERE LOWER(nome) = LOWER('Receita') ORDER BY id ASC LIMIT 1")
        )
    ).first()
    if not row_cat:
        row_cat = (
            await db.execute(
                text("INSERT INTO categorias (nome, tipo, status) VALUES ('Receita', 'Receita', 'ativo') RETURNING id")
            )
        ).first()
        await db.commit()
    categoria_id = int(row_cat[0])
    row_sub = (
        await db.execute(
            text(
                """
                SELECT id
                FROM subcategorias
                WHERE categoria_id = :categoria_id
                  AND LOWER(nome) = LOWER('Venda de Produtos')
                ORDER BY id ASC
                LIMIT 1
                """
            ),
            {"categoria_id": categoria_id},
        )
    ).first()
    if not row_sub:
        await db.execute(
            text(
                """
                INSERT INTO subcategorias (nome, categoria_id, status)
                VALUES ('Venda de Produtos', :categoria_id, 'ativo')
                """
            ),
            {"categoria_id": categoria_id},
        )
        await db.commit()


async def ensure_contas_receber_columns(db: AsyncSession):
    await db.execute(
        text(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'aluno_id' AND is_nullable = 'NO'
              ) THEN
                ALTER TABLE contas_receber ALTER COLUMN aluno_id DROP NOT NULL;
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'cliente_nome'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN cliente_nome VARCHAR(120);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'descricao'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN descricao VARCHAR(255);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'categoria'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN categoria VARCHAR(120);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'subcategoria'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN subcategoria VARCHAR(120);
              END IF;
            END $$;
            """
        )
    )
    await db.commit()


async def ensure_vendas_table(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS vendas_produtos (
              id SERIAL PRIMARY KEY,
              produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
              produto_nome VARCHAR(120) NOT NULL,
              comprador_nome VARCHAR(120) NOT NULL,
              aluno_id INTEGER REFERENCES alunos(id) ON DELETE SET NULL,
              quantidade INTEGER NOT NULL,
              valor_unitario NUMERIC(10,2) NOT NULL,
              valor_total NUMERIC(10,2) NOT NULL,
              data_venda DATE NOT NULL,
              conta_receber_id INTEGER REFERENCES contas_receber(id) ON DELETE SET NULL,
              created_at TIMESTAMP DEFAULT NOW()
            )
            """
        )
    )
    await db.commit()


def parse_periodo_dates(periodo: str, data_inicio: str | None, data_fim: str | None) -> tuple[date, date]:
    hoje = date.today()
    if data_inicio and data_fim:
        return datetime.strptime(data_inicio, "%Y-%m-%d").date(), datetime.strptime(data_fim, "%Y-%m-%d").date()
    if periodo == "semana":
        ini = hoje - timedelta(days=hoje.weekday())
        return ini, hoje
    if periodo == "mes":
        ini = date(hoje.year, hoje.month, 1)
        return ini, hoje
    return date(2000, 1, 1), date(2100, 12, 31)


@router.get("")
async def listar_vendas(
    periodo: str = Query(default="mes"),
    data_inicio: str | None = Query(default=None),
    data_fim: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    await ensure_produtos_table(db)
    await ensure_contas_receber_columns(db)
    await ensure_vendas_table(db)
    try:
        dt_ini, dt_fim = parse_periodo_dates(periodo, data_inicio, data_fim)
    except Exception:
        raise HTTPException(status_code=400, detail="Periodo invalido")
    rows = (
        await db.execute(
            text(
                """
                SELECT v.id, v.produto_id, v.produto_nome, v.comprador_nome, v.aluno_id,
                       v.quantidade, v.valor_unitario, v.valor_total, v.data_venda, v.conta_receber_id,
                       COALESCE(cr.status, 'aberto') AS status,
                       cr.vencimento
                FROM vendas_produtos v
                LEFT JOIN contas_receber cr ON cr.id = v.conta_receber_id
                WHERE v.data_venda BETWEEN :ini AND :fim
                ORDER BY v.data_venda DESC, v.id DESC
                """
            ),
            {"ini": dt_ini, "fim": dt_fim},
        )
    ).all()
    return [
        {
            "id": r[0],
            "produto_id": r[1],
            "produto_nome": r[2],
            "comprador_nome": r[3],
            "aluno_id": r[4],
            "quantidade": int(r[5] or 0),
            "valor_unitario": float(r[6] or 0),
            "valor_total": float(r[7] or 0),
            "data_venda": r[8].strftime("%Y-%m-%d") if r[8] else None,
            "conta_receber_id": r[9],
            "status": r[10] or "aberto",
            "vencimento": r[11].strftime("%Y-%m-%d") if r[11] else None,
        }
        for r in rows
    ]


@router.post("")
async def criar_venda(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_produtos_table(db)
    await ensure_categorias_venda(db)
    await ensure_contas_receber_columns(db)
    await ensure_vendas_table(db)

    produto_id = payload.get("produto_id")
    quantidade = int(payload.get("quantidade") or 0)
    valor_unitario = float(payload.get("valor_unitario") or 0)
    aluno_id = payload.get("aluno_id")
    cliente_nome = (payload.get("cliente_nome") or "").strip()
    data_venda_txt = payload.get("data_venda") or date.today().strftime("%Y-%m-%d")
    try:
        data_venda = datetime.strptime(data_venda_txt, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Data invalida")

    if not produto_id:
        raise HTTPException(status_code=400, detail="Selecione o produto")
    if quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")
    if valor_unitario <= 0:
        raise HTTPException(status_code=400, detail="Valor unitario deve ser maior que zero")

    prod = (await db.execute(text("SELECT id, nome FROM produtos WHERE id = :id"), {"id": int(produto_id)})).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")

    comprador_nome = cliente_nome
    aluno_id_final = int(aluno_id) if aluno_id else None
    if aluno_id_final:
        aluno_row = (
            await db.execute(
                text(
                    """
                    SELECT a.id, u.nome
                    FROM alunos a
                    JOIN usuarios u ON u.id = a.usuario_id
                    WHERE a.id = :id
                    """
                ),
                {"id": aluno_id_final},
            )
        ).first()
        if not aluno_row:
            raise HTTPException(status_code=404, detail="Aluno nao encontrado")
        comprador_nome = aluno_row[1]

    if not comprador_nome:
        raise HTTPException(status_code=400, detail="Informe o nome do comprador")

    total = round(float(quantidade) * float(valor_unitario), 2)
    descricao = f"{comprador_nome} + Venda de Produtos ({prod[1]})"

    conta_row = (
        await db.execute(
            text(
                """
                INSERT INTO contas_receber
                  (contrato_id, aluno_id, cliente_nome, vencimento, valor, status, descricao, categoria, subcategoria)
                VALUES
                  (NULL, :aluno_id, :cliente_nome, :vencimento, :valor, 'aberto', :descricao, 'Receita', 'Venda de Produtos')
                RETURNING id
                """
            ),
            {
                "aluno_id": aluno_id_final,
                "cliente_nome": comprador_nome,
                "vencimento": data_venda,
                "valor": total,
                "descricao": descricao,
            },
        )
    ).first()
    conta_id = int(conta_row[0])

    venda_row = (
        await db.execute(
            text(
                """
                INSERT INTO vendas_produtos
                  (produto_id, produto_nome, comprador_nome, aluno_id, quantidade, valor_unitario, valor_total, data_venda, conta_receber_id, created_at)
                VALUES
                  (:produto_id, :produto_nome, :comprador_nome, :aluno_id, :quantidade, :valor_unitario, :valor_total, :data_venda, :conta_receber_id, NOW())
                RETURNING id
                """
            ),
            {
                "produto_id": int(prod[0]),
                "produto_nome": str(prod[1]),
                "comprador_nome": comprador_nome,
                "aluno_id": aluno_id_final,
                "quantidade": quantidade,
                "valor_unitario": valor_unitario,
                "valor_total": total,
                "data_venda": data_venda,
                "conta_receber_id": conta_id,
            },
        )
    ).first()
    await db.commit()
    return {"ok": True, "id": int(venda_row[0]), "conta_receber_id": conta_id}


@router.post("/{venda_id}/pagar")
async def pagar_venda(venda_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_contas_receber_columns(db)
    await ensure_vendas_table(db)
    data_pagamento_txt = payload.get("data_pagamento") or date.today().strftime("%Y-%m-%d")
    conta_bancaria_id = payload.get("conta_bancaria_id")
    try:
        data_pagamento = datetime.strptime(data_pagamento_txt, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Data de pagamento invalida")

    row = (
        await db.execute(
            text(
                """
                SELECT v.id, v.conta_receber_id, v.comprador_nome, v.produto_nome, v.valor_total,
                       COALESCE(cr.status, 'aberto') AS status
                FROM vendas_produtos v
                LEFT JOIN contas_receber cr ON cr.id = v.conta_receber_id
                WHERE v.id = :id
                """
            ),
            {"id": venda_id},
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Venda nao encontrada")
    if str(row[5] or "").lower() == "pago":
        return {"ok": True}
    conta_id = row[1]
    if not conta_id:
        raise HTTPException(status_code=400, detail="Venda sem conta a receber vinculada")

    await db.execute(
        text(
            """
            UPDATE contas_receber
            SET status = 'pago', data_pagamento = :data_pagamento, conta_bancaria_id = :conta_bancaria_id
            WHERE id = :id
            """
        ),
        {"data_pagamento": data_pagamento, "conta_bancaria_id": conta_bancaria_id, "id": int(conta_id)},
    )

    if conta_bancaria_id:
        await db.execute(
            text("UPDATE contas_bancarias SET saldo = COALESCE(saldo, 0) + :valor WHERE id = :id"),
            {"valor": float(row[4] or 0), "id": int(conta_bancaria_id)},
        )

    await db.execute(
        text(
            """
            INSERT INTO movimentos_bancarios (data_movimento, tipo, valor, descricao, categoria, subcategoria, conta_bancaria_id, created_at, updated_at)
            VALUES (:data_movimento, 'entrada', :valor, :descricao, 'Receita', 'Venda de Produtos', :conta_bancaria_id, NOW(), NOW())
            """
        ),
        {
            "data_movimento": data_pagamento,
            "valor": float(row[4] or 0),
            "descricao": f"{row[2]} + Venda de Produtos ({row[3]})",
            "conta_bancaria_id": conta_bancaria_id,
        },
    )
    await db.commit()
    return {"ok": True}


@router.put("/{venda_id}")
async def editar_venda(venda_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_contas_receber_columns(db)
    await ensure_vendas_table(db)
    row = (
        await db.execute(
            text(
                """
                SELECT v.id, v.quantidade, v.valor_unitario, v.valor_total, v.data_venda, v.conta_receber_id, v.produto_nome, v.comprador_nome,
                       COALESCE(cr.status, 'aberto') AS status_atual, cr.conta_bancaria_id
                FROM vendas_produtos v
                LEFT JOIN contas_receber cr ON cr.id = v.conta_receber_id
                WHERE v.id = :id
                """
            ),
            {"id": venda_id},
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Venda nao encontrada")

    quantidade = int(payload.get("quantidade") or row[1] or 0)
    valor_unitario = float(payload.get("valor_unitario") or row[2] or 0)
    status_novo = (payload.get("status") or row[8] or "aberto").strip().lower()
    data_venda_txt = payload.get("data_venda") or (row[4].strftime("%Y-%m-%d") if row[4] else date.today().strftime("%Y-%m-%d"))
    data_pagamento_txt = payload.get("data_pagamento") or date.today().strftime("%Y-%m-%d")
    conta_bancaria_id_novo = payload.get("conta_bancaria_id")
    conta_bancaria_id_atual = row[9]
    conta_bancaria_id_usar = conta_bancaria_id_novo if conta_bancaria_id_novo is not None else conta_bancaria_id_atual

    if quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")
    if valor_unitario <= 0:
        raise HTTPException(status_code=400, detail="Valor unitario deve ser maior que zero")
    if status_novo not in {"aberto", "pago"}:
        raise HTTPException(status_code=400, detail="Status invalido")

    try:
        data_venda = datetime.strptime(data_venda_txt, "%Y-%m-%d").date()
        data_pagamento = datetime.strptime(data_pagamento_txt, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Data invalida")

    total_novo = round(float(quantidade) * float(valor_unitario), 2)
    descricao = f"{row[7]} + Venda de Produtos ({row[6]})"
    status_atual = str(row[8] or "aberto").lower()

    await db.execute(
        text(
            """
            UPDATE vendas_produtos
            SET quantidade = :qtd, valor_unitario = :vu, valor_total = :vt, data_venda = :dv
            WHERE id = :id
            """
        ),
        {"qtd": quantidade, "vu": valor_unitario, "vt": total_novo, "dv": data_venda, "id": venda_id},
    )

    # Reverte financeiro se estava pago e voltou para aberto.
    if status_atual == "pago" and status_novo == "aberto":
        if conta_bancaria_id_atual:
            await db.execute(
                text("UPDATE contas_bancarias SET saldo = COALESCE(saldo, 0) - :valor WHERE id = :id"),
                {"valor": float(row[3] or 0), "id": int(conta_bancaria_id_atual)},
            )
        await db.execute(
            text(
                """
                INSERT INTO movimentos_bancarios (data_movimento, tipo, valor, descricao, categoria, subcategoria, conta_bancaria_id, created_at, updated_at)
                VALUES (:data_movimento, 'saida', :valor, :descricao, 'Receita', 'Venda de Produtos', :conta_bancaria_id, NOW(), NOW())
                """
            ),
            {
                "data_movimento": date.today(),
                "valor": float(row[3] or 0),
                "descricao": f"Estorno: {descricao}",
                "conta_bancaria_id": conta_bancaria_id_atual,
            },
        )

    await db.execute(
        text(
            """
            UPDATE contas_receber
            SET vencimento = :vencimento,
                valor = :valor,
                status = :status,
                data_pagamento = CASE WHEN :status = 'pago' THEN :data_pagamento ELSE NULL END,
                conta_bancaria_id = CASE WHEN :status = 'pago' THEN :conta_bancaria_id ELSE NULL END,
                descricao = :descricao,
                categoria = 'Receita',
                subcategoria = 'Venda de Produtos'
            WHERE id = :id
            """
        ),
        {
            "vencimento": data_venda,
            "valor": total_novo,
            "status": status_novo,
            "data_pagamento": data_pagamento,
            "conta_bancaria_id": conta_bancaria_id_usar,
            "descricao": descricao,
            "id": int(row[5]),
        },
    )

    # Se mudou de aberto para pago, aplica financeiro agora.
    if status_atual != "pago" and status_novo == "pago":
        if conta_bancaria_id_usar:
            await db.execute(
                text("UPDATE contas_bancarias SET saldo = COALESCE(saldo, 0) + :valor WHERE id = :id"),
                {"valor": total_novo, "id": int(conta_bancaria_id_usar)},
            )
        await db.execute(
            text(
                """
                INSERT INTO movimentos_bancarios (data_movimento, tipo, valor, descricao, categoria, subcategoria, conta_bancaria_id, created_at, updated_at)
                VALUES (:data_movimento, 'entrada', :valor, :descricao, 'Receita', 'Venda de Produtos', :conta_bancaria_id, NOW(), NOW())
                """
            ),
            {
                "data_movimento": data_pagamento,
                "valor": total_novo,
                "descricao": descricao,
                "conta_bancaria_id": conta_bancaria_id_usar,
            },
        )

    await db.commit()
    return {"ok": True}
