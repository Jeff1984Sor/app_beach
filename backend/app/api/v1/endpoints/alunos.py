from datetime import date, datetime, timedelta
import calendar
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.db.session import get_db
from app.api.deps import require_role
from app.models.entities import Aluno, Usuario, Role, Aula, ContaReceber, Agenda, Unidade, Profissional
from app.schemas.domain import AlunoIn, AlunoCadastroIn
from app.core.security import get_password_hash

router = APIRouter(prefix="/alunos", tags=["alunos"])


def render_template(template: str, variables: dict[str, str]) -> str:
    rendered = template
    for k, v in variables.items():
        rendered = rendered.replace(f"{{{{{k}}}}}", str(v))
    return rendered


async def ensure_details_table(db: AsyncSession):
    await db.execute(text("""
    CREATE TABLE IF NOT EXISTS aluno_detalhes (
      aluno_id INTEGER PRIMARY KEY,
      email_contato VARCHAR(120),
      data_aniversario VARCHAR(20),
      cep VARCHAR(12),
      endereco VARCHAR(255),
      idade INTEGER,
      unidade VARCHAR(120)
    )
    """))
    await db.commit()


async def ensure_contracts_table(db: AsyncSession):
    await db.execute(text("""
    CREATE TABLE IF NOT EXISTS aluno_contratos (
      id SERIAL PRIMARY KEY,
      aluno_id INTEGER NOT NULL,
      plano_nome VARCHAR(120) NOT NULL,
      recorrencia VARCHAR(20) NOT NULL,
      valor NUMERIC(10,2) NOT NULL,
      qtd_aulas_semanais INTEGER DEFAULT 0,
      data_inicio DATE NOT NULL,
      data_fim DATE NOT NULL,
      dias_semana VARCHAR(120),
      status VARCHAR(20) DEFAULT 'ativo'
    )
    """))
    await db.commit()


async def ensure_contract_links(db: AsyncSession):
    await db.execute(
        text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'aulas' AND column_name = 'contrato_id'
              ) THEN
                ALTER TABLE aulas ADD COLUMN contrato_id INTEGER;
              END IF;

              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'contrato_id'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN contrato_id INTEGER;
              END IF;
            END $$;
            """
        )
    )
    await db.commit()


async def ensure_finance_columns(db: AsyncSession):
    await db.execute(
        text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'data_pagamento'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN data_pagamento DATE;
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'contas_receber' AND column_name = 'conta_bancaria_id'
              ) THEN
                ALTER TABLE contas_receber ADD COLUMN conta_bancaria_id INTEGER;
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'movimentos_bancarios' AND column_name = 'categoria'
              ) THEN
                ALTER TABLE movimentos_bancarios ADD COLUMN categoria VARCHAR(120);
              END IF;
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'movimentos_bancarios' AND column_name = 'subcategoria'
              ) THEN
                ALTER TABLE movimentos_bancarios ADD COLUMN subcategoria VARCHAR(120);
              END IF;
            END $$;
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS contas_bancarias (
              id SERIAL PRIMARY KEY,
              nome_conta VARCHAR(120) NOT NULL,
              banco VARCHAR(120) NOT NULL,
              agencia VARCHAR(40) NOT NULL,
              cc VARCHAR(40) NOT NULL,
              saldo NUMERIC(12,2) NOT NULL DEFAULT 0
            )
            """
        )
    )
    await db.commit()


async def ensure_bloqueios_table(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS agenda_bloqueios (
              id SERIAL PRIMARY KEY,
              profissional_id INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
              unidade_id INTEGER REFERENCES unidades(id) ON DELETE SET NULL,
              data DATE NOT NULL,
              hora_inicio VARCHAR(5) NOT NULL,
              hora_fim VARCHAR(5) NOT NULL,
              motivo VARCHAR(255),
              status VARCHAR(20) NOT NULL DEFAULT 'ativo',
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
            """
        )
    )
    await db.commit()


async def slot_em_conflito(db: AsyncSession, professor_id: int, inicio_dt: datetime, fim_dt: datetime, ignore_aula_id: int | None = None):
    conflito_aula_q = select(Aula).where(
        Aula.professor_id == professor_id,
        Aula.inicio < fim_dt,
        Aula.fim > inicio_dt,
        Aula.status != "cancelada",
    )
    if ignore_aula_id:
        conflito_aula_q = conflito_aula_q.where(Aula.id != ignore_aula_id)
    conflito_aula = await db.scalar(conflito_aula_q.limit(1))
    if conflito_aula:
        return "Conflito: professor ja possui aula nesse horario"

    await ensure_bloqueios_table(db)
    rows = (
        await db.execute(
            text(
                """
                SELECT hora_inicio, hora_fim
                FROM agenda_bloqueios
                WHERE data = :data
                  AND LOWER(COALESCE(status, 'ativo')) = 'ativo'
                  AND (profissional_id IS NULL OR profissional_id = :profissional_id)
                """
            ),
            {"data": inicio_dt.date(), "profissional_id": professor_id},
        )
    ).all()
    inicio_min = inicio_dt.hour * 60 + inicio_dt.minute
    fim_min = fim_dt.hour * 60 + fim_dt.minute
    for r in rows:
        try:
            hi_h, hi_m = str(r[0]).split(":")
            hf_h, hf_m = str(r[1]).split(":")
            b_ini = int(hi_h) * 60 + int(hi_m)
            b_fim = int(hf_h) * 60 + int(hf_m)
        except Exception:
            continue
        if inicio_min < b_fim and fim_min > b_ini:
            return "Conflito: horario bloqueado na agenda do professor"
    return None


def gerar_horas_cheias(inicio_h: int = 7, fim_h: int = 21) -> list[str]:
    return [f"{h:02d}:00" for h in range(inicio_h, fim_h + 1)]


async def listar_horarios_disponiveis(db: AsyncSession, professor_id: int, data_ref: date, duracao_min: int = 60) -> list[str]:
    horas = gerar_horas_cheias()
    livres: list[str] = []
    for hhmm in horas:
        hh, mm = hhmm.split(":")
        ini = datetime(data_ref.year, data_ref.month, data_ref.day, int(hh), int(mm))
        fim = ini + timedelta(minutes=max(30, duracao_min))
        conflito = await slot_em_conflito(db, professor_id, ini, fim)
        if not conflito:
            livres.append(hhmm)
    return livres


def add_months(base: date, months: int) -> date:
    month = base.month - 1 + months
    year = base.year + month // 12
    month = month % 12 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def recorrencia_to_meses(recorrencia: str) -> int:
    mapa = {"mensal": 1, "trimestral": 3, "semestral": 6, "anual": 12}
    return mapa.get((recorrencia or "").lower(), 1)


def dia_label_to_weekday(dia: str) -> int | None:
    mapa = {"seg": 0, "ter": 1, "qua": 2, "qui": 3, "sex": 4, "sab": 5, "dom": 6}
    return mapa.get((dia or "").strip().lower()[:3])


async def get_details(db: AsyncSession, aluno_id: int) -> dict:
    row = (await db.execute(text("SELECT email_contato, data_aniversario, cep, endereco, idade, unidade FROM aluno_detalhes WHERE aluno_id = :id"), {"id": aluno_id})).first()
    if not row:
        return {"email_contato": None, "data_aniversario": None, "cep": None, "endereco": None, "idade": None, "unidade": None}
    return {
        "email_contato": row[0],
        "data_aniversario": row[1],
        "cep": row[2],
        "endereco": row[3],
        "idade": row[4],
        "unidade": row[5],
    }


@router.get("")
async def list_alunos(db: AsyncSession = Depends(get_db)):
    await ensure_details_table(db)
    rows = (await db.execute(select(Aluno, Usuario).join(Usuario, Usuario.id == Aluno.usuario_id))).all()
    result = []
    for aluno, user in rows:
        d = await get_details(db, aluno.id)
        result.append(
            {
                "id": aluno.id,
                "nome": user.nome,
                "telefone": aluno.telefone,
                "status": aluno.status,
                "unidade": d.get("unidade") or "Nao definida",
            }
        )
    return result


@router.get("/{aluno_id}/ficha")
async def ficha_aluno(aluno_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_details_table(db)
    await ensure_contracts_table(db)
    await ensure_finance_columns(db)
    row = (await db.execute(select(Aluno, Usuario).join(Usuario, Usuario.id == Aluno.usuario_id).where(Aluno.id == aluno_id))).first()
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")

    aluno, user = row
    d = await get_details(db, aluno.id)
    aulas = (await db.execute(select(Aula).where(Aula.aluno_id == aluno_id).order_by(Aula.inicio.desc()).limit(20))).scalars().all()
    financeiro = (await db.execute(select(ContaReceber).where(ContaReceber.aluno_id == aluno_id).order_by(ContaReceber.vencimento.desc()).limit(20))).scalars().all()
    contratos_rows = (
        await db.execute(
            text(
                """
                SELECT id, plano_nome, data_inicio, data_fim, status, recorrencia, valor, qtd_aulas_semanais, dias_semana
                FROM aluno_contratos
                WHERE aluno_id = :id
                ORDER BY id DESC
                """
            ),
            {"id": aluno_id},
        )
    ).all()

    return {
        "id": aluno.id,
        "nome": user.nome,
        "login": user.email,
        "email": d.get("email_contato"),
        "data_aniversario": d.get("data_aniversario"),
        "endereco": d.get("endereco"),
        "idade": d.get("idade"),
        "cep": d.get("cep"),
        "status": aluno.status,
        "telefone": aluno.telefone,
        "unidade": d.get("unidade") or "Nao definida",
        "aulas": [
            {
                "id": a.id,
                "data": a.inicio.strftime("%d/%m/%Y") if a.inicio else "--",
                "hora": a.inicio.strftime("%H:%M") if a.inicio else "--",
                "unidade": d.get("unidade") or "Nao definida",
                "status": a.status,
            }
            for a in aulas
        ],
        "financeiro": [
            {
                "id": f.id,
                "valor": float(f.valor),
                "status": f.status,
                "vencimento": f.vencimento.strftime("%d/%m/%Y") if f.vencimento else "--",
                "data_pagamento": f.data_pagamento.strftime("%d/%m/%Y") if getattr(f, "data_pagamento", None) else None,
            }
            for f in financeiro
        ],
        "contratos": [
            {
                "id": c[0],
                "plano": c[1],
                "inicio": c[2].strftime("%d/%m/%Y") if c[2] else "--",
                "fim": c[3].strftime("%d/%m/%Y") if c[3] else "--",
                "status": c[4] or "ativo",
                "recorrencia": c[5] or "mensal",
                "valor": float(c[6] or 0),
                "qtd_aulas_semanais": int(c[7] or 0),
                "dias_semana": [d for d in (c[8] or "").split(",") if d],
                "inicio_iso": c[2].strftime("%Y-%m-%d") if c[2] else None,
            }
            for c in contratos_rows
        ],
        "mensagens": [{"id": 1, "texto": "Bem-vindo ao Beach SaaS", "status": "entregue", "quando": "Hoje"}],
    }


@router.put("/{aluno_id}/detalhes")
async def update_detalhes(aluno_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_details_table(db)
    exists = await db.get(Aluno, aluno_id)
    if not exists:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")

    await db.execute(
        text("""
        INSERT INTO aluno_detalhes (aluno_id, email_contato, data_aniversario, cep, endereco, idade, unidade)
        VALUES (:aluno_id, :email_contato, :data_aniversario, :cep, :endereco, :idade, :unidade)
        ON CONFLICT(aluno_id) DO UPDATE SET
          email_contato = excluded.email_contato,
          data_aniversario = excluded.data_aniversario,
          cep = excluded.cep,
          endereco = excluded.endereco,
          idade = excluded.idade,
          unidade = excluded.unidade
        """),
        {
            "aluno_id": aluno_id,
            "email_contato": payload.get("email"),
            "data_aniversario": payload.get("data_aniversario"),
            "cep": payload.get("cep"),
            "endereco": payload.get("endereco"),
            "idade": payload.get("idade"),
            "unidade": payload.get("unidade"),
        },
    )

    if payload.get("telefone") is not None:
        exists.telefone = payload.get("telefone")

    await db.commit()
    return {"ok": True}


@router.post("/{aluno_id}/gerar-contrato")
async def gerar_contrato(aluno_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(Aluno, Usuario).join(Usuario, Usuario.id == Aluno.usuario_id).where(Aluno.id == aluno_id))).first()
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    aluno, user = row

    template = payload.get("template") or "CONTRATO\nAluno: {{aluno_nome}}\nTelefone: {{aluno_telefone}}\nData: {{data_hoje}}"
    variables = {
        "aluno_nome": user.nome,
        "aluno_telefone": aluno.telefone or "",
        "data_hoje": date.today().strftime("%d/%m/%Y"),
        "plano_nome": payload.get("plano_nome", "Plano Mensal"),
        "plano_valor": payload.get("plano_valor", "R$ 0,00"),
        "plano_duracao": payload.get("plano_duracao", "Mensal"),
        "plano_qtd_aulas_semanais": payload.get("plano_qtd_aulas_semanais", "0"),
        "professor_nome": payload.get("professor_nome", "A definir"),
    }
    conteudo = render_template(template, variables)
    return {"aluno_id": aluno_id, "conteudo": conteudo, "variables": variables}


@router.post("/{aluno_id}/contratos")
async def criar_contrato(aluno_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_contracts_table(db)
    await ensure_contract_links(db)
    row = await db.get(Aluno, aluno_id)
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")

    plano_nome = payload.get("plano_nome") or "Plano Mensal"
    recorrencia = (payload.get("recorrencia") or "mensal").lower()
    valor = float(payload.get("valor") or 0)
    qtd_aulas_semanais = int(payload.get("qtd_aulas_semanais") or 0)
    dias_lista = payload.get("dias_semana") or []
    if qtd_aulas_semanais > 0 and len(dias_lista) > qtd_aulas_semanais:
        raise HTTPException(status_code=400, detail=f"Plano permite no maximo {qtd_aulas_semanais} dia(s) por semana")
    dias_semana = ",".join(dias_lista)

    data_inicio_raw = payload.get("data_inicio")
    data_inicio = datetime.strptime(data_inicio_raw, "%Y-%m-%d").date() if data_inicio_raw else date.today()
    meses = recorrencia_to_meses(recorrencia)
    data_fim = add_months(data_inicio, meses)

    contrato_row = (
        await db.execute(
            text("""
            INSERT INTO aluno_contratos (aluno_id, plano_nome, recorrencia, valor, qtd_aulas_semanais, data_inicio, data_fim, dias_semana, status)
            VALUES (:aluno_id, :plano_nome, :recorrencia, :valor, :qtd_aulas_semanais, :data_inicio, :data_fim, :dias_semana, 'ativo')
            RETURNING id
            """),
            {
                "aluno_id": aluno_id,
                "plano_nome": plano_nome,
                "recorrencia": recorrencia,
                "valor": valor,
                "qtd_aulas_semanais": qtd_aulas_semanais,
                "data_inicio": data_inicio,
                "data_fim": data_fim,
                "dias_semana": dias_semana,
            },
        )
    ).first()
    contrato_id = contrato_row[0]

    criadas = []
    for i in range(meses):
        venc = add_months(data_inicio, i)
        conta = ContaReceber(contrato_id=contrato_id, aluno_id=aluno_id, vencimento=venc, valor=valor, status="aberto")
        db.add(conta)
        criadas.append(venc.strftime("%d/%m/%Y"))

    await db.commit()
    return {
        "ok": True,
        "contrato_id": contrato_id,
        "contas_receber_criadas": len(criadas),
        "vencimentos": criadas,
        "data_inicio": data_inicio.strftime("%Y-%m-%d"),
        "data_fim": data_fim.strftime("%Y-%m-%d"),
    }


@router.put("/{aluno_id}/contratos/{contrato_id}")
async def atualizar_contrato(aluno_id: int, contrato_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_contracts_table(db)
    contrato = (
        await db.execute(
            text("SELECT id FROM aluno_contratos WHERE id = :contrato_id AND aluno_id = :aluno_id"),
            {"contrato_id": contrato_id, "aluno_id": aluno_id},
        )
    ).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato nao encontrado")

    plano_nome = payload.get("plano_nome") or "Plano Mensal"
    recorrencia = (payload.get("recorrencia") or "mensal").lower()
    valor = float(payload.get("valor") or 0)
    qtd_aulas_semanais = int(payload.get("qtd_aulas_semanais") or 0)
    dias_lista = payload.get("dias_semana") or []
    if qtd_aulas_semanais > 0 and len(dias_lista) > qtd_aulas_semanais:
        raise HTTPException(status_code=400, detail=f"Plano permite no maximo {qtd_aulas_semanais} dia(s) por semana")
    dias_semana = ",".join(dias_lista)
    data_inicio_raw = payload.get("data_inicio")
    data_inicio = datetime.strptime(data_inicio_raw, "%Y-%m-%d").date() if data_inicio_raw else date.today()
    data_fim = add_months(data_inicio, recorrencia_to_meses(recorrencia))

    await db.execute(
        text(
            """
            UPDATE aluno_contratos
            SET plano_nome = :plano_nome,
                recorrencia = :recorrencia,
                valor = :valor,
                qtd_aulas_semanais = :qtd_aulas_semanais,
                data_inicio = :data_inicio,
                data_fim = :data_fim,
                dias_semana = :dias_semana
            WHERE id = :contrato_id AND aluno_id = :aluno_id
            """
        ),
        {
            "plano_nome": plano_nome,
            "recorrencia": recorrencia,
            "valor": valor,
            "qtd_aulas_semanais": qtd_aulas_semanais,
            "data_inicio": data_inicio,
            "data_fim": data_fim,
            "dias_semana": dias_semana,
            "contrato_id": contrato_id,
            "aluno_id": aluno_id,
        },
    )
    await db.commit()
    return {"ok": True}


@router.delete("/{aluno_id}/contratos/{contrato_id}")
async def deletar_contrato(aluno_id: int, contrato_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_contracts_table(db)
    await ensure_contract_links(db)
    await db.execute(
        text(
            """
            DELETE FROM contas_receber
            WHERE contrato_id = :contrato_id
              AND aluno_id = :aluno_id
            """
        ),
        {"contrato_id": contrato_id, "aluno_id": aluno_id},
    )
    await db.execute(
        text(
            """
            DELETE FROM aulas
            WHERE contrato_id = :contrato_id
              AND aluno_id = :aluno_id
            """
        ),
        {"contrato_id": contrato_id, "aluno_id": aluno_id},
    )
    res = await db.execute(
        text("DELETE FROM aluno_contratos WHERE id = :contrato_id AND aluno_id = :aluno_id"),
        {"contrato_id": contrato_id, "aluno_id": aluno_id},
    )
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contrato nao encontrado")
    return {"ok": True}


@router.post("/{aluno_id}/contratos/{contrato_id}/reservas")
async def criar_reservas_contrato(aluno_id: int, contrato_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_contract_links(db)
    await ensure_bloqueios_table(db)
    contrato = (
        await db.execute(
            text(
                """
                SELECT id, data_inicio, data_fim, valor, dias_semana
                FROM aluno_contratos
                WHERE id = :contrato_id AND aluno_id = :aluno_id
                """
            ),
            {"contrato_id": contrato_id, "aluno_id": aluno_id},
        )
    ).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato nao encontrado")

    row_aluno = await db.get(Aluno, aluno_id)
    if not row_aluno:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")

    unidade_nome = payload.get("unidade")
    hora_inicio_txt = payload.get("hora_inicio") or "18:00"
    duracao_min = int(payload.get("duracao_minutos") or 60)
    dias = payload.get("dias_semana") or []
    if not dias:
        dias = [d for d in (contrato[4] or "").split(",") if d]
    weekdays = [dia_label_to_weekday(d) for d in dias]
    weekdays = [d for d in weekdays if d is not None]
    if not weekdays:
        raise HTTPException(status_code=400, detail="Selecione ao menos um dia da semana")

    unidade = await db.scalar(select(Unidade).where(Unidade.nome == unidade_nome)) if unidade_nome else None
    if not unidade:
        unidade = await db.scalar(select(Unidade).limit(1))
    if not unidade:
        unidade = Unidade(nome=unidade_nome or "Unidade Padrao", cep="00000000", endereco="Nao informado")
        db.add(unidade)
        await db.flush()

    professor_id = payload.get("professor_id")
    prof = None
    if professor_id:
        try:
            prof = await db.scalar(select(Profissional).where(Profissional.id == int(professor_id)))
        except Exception:
            prof = None
    if not prof:
        prof = await db.scalar(select(Profissional).limit(1))
    if not prof:
        raise HTTPException(status_code=400, detail="Cadastre ao menos um profissional para reservar agenda")

    try:
        h, m = (hora_inicio_txt or "18:00").split(":")
        hour = int(h)
        minute = int(m)
    except Exception:
        raise HTTPException(status_code=400, detail="Hora invalida, use HH:MM")

    inicio_periodo = contrato[1]
    fim_periodo = contrato[2]
    valor = float(contrato[3] or 0)
    aulas_criadas = 0
    data_cursor = inicio_periodo

    conflitos: list[str] = []
    while data_cursor <= fim_periodo:
        if data_cursor.weekday() in weekdays:
            agenda = await db.scalar(select(Agenda).where(Agenda.unidade_id == unidade.id, Agenda.data == data_cursor))
            if not agenda:
                agenda = Agenda(unidade_id=unidade.id, data=data_cursor)
                db.add(agenda)
                await db.flush()

            inicio_dt = datetime(data_cursor.year, data_cursor.month, data_cursor.day, hour, minute)
            fim_dt = inicio_dt + timedelta(minutes=duracao_min)
            existe = await db.scalar(
                select(Aula).where(
                    Aula.agenda_id == agenda.id,
                    Aula.aluno_id == aluno_id,
                    Aula.inicio == inicio_dt,
                )
            )
            if not existe:
                conflito = await slot_em_conflito(db, prof.id, inicio_dt, fim_dt)
                if conflito:
                    conflitos.append(f"{data_cursor.strftime('%d/%m/%Y')} {hora_inicio_txt} - {conflito}")
                    data_cursor += timedelta(days=1)
                    continue
                db.add(
                    Aula(
                        agenda_id=agenda.id,
                        contrato_id=contrato_id,
                        aluno_id=aluno_id,
                        professor_id=prof.id,
                        inicio=inicio_dt,
                        fim=fim_dt,
                        status="agendada",
                        valor=valor,
                    )
                )
                aulas_criadas += 1
        data_cursor += timedelta(days=1)

    await db.commit()
    return {"ok": True, "aulas_criadas": aulas_criadas, "conflitos": conflitos}


@router.get("/{aluno_id}/aulas-avulsas/disponibilidade")
async def disponibilidade_aula_avulsa(
    aluno_id: int,
    data: str,
    professor_id: int | None = None,
    duracao_minutos: int = 60,
    db: AsyncSession = Depends(get_db),
):
    aluno = await db.get(Aluno, aluno_id)
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    try:
        data_ref = datetime.strptime(data, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Data invalida. Use YYYY-MM-DD")

    prof = await db.scalar(select(Profissional).where(Profissional.id == professor_id)) if professor_id else None
    if not prof:
        prof = await db.scalar(select(Profissional).limit(1))
    if not prof:
        raise HTTPException(status_code=400, detail="Sem professor cadastrado")

    horarios = await listar_horarios_disponiveis(db, prof.id, data_ref, duracao_minutos)
    return {"professor_id": prof.id, "data": data_ref.strftime("%Y-%m-%d"), "horarios_livres": horarios}


@router.post("/{aluno_id}/aulas-avulsas")
async def criar_aula_avulsa(aluno_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_finance_columns(db)
    await ensure_bloqueios_table(db)
    aluno = await db.get(Aluno, aluno_id)
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")

    data_txt = payload.get("data")
    hora_txt = payload.get("hora")
    professor_id = payload.get("professor_id")
    valor = float(payload.get("valor") or 0)
    duracao_min = int(payload.get("duracao_minutos") or 60)

    if not (data_txt and hora_txt and professor_id):
        raise HTTPException(status_code=400, detail="Informe data, hora e professor")

    try:
        data_ref = datetime.strptime(data_txt, "%Y-%m-%d").date()
        hh, mm = hora_txt.split(":")
        ini = datetime(data_ref.year, data_ref.month, data_ref.day, int(hh), int(mm))
    except Exception:
        raise HTTPException(status_code=400, detail="Data/hora invalida")

    prof = await db.scalar(select(Profissional).where(Profissional.id == int(professor_id)))
    if not prof:
        raise HTTPException(status_code=404, detail="Professor nao encontrado")
    fim = ini + timedelta(minutes=max(30, duracao_min))
    conflito = await slot_em_conflito(db, prof.id, ini, fim)
    if conflito:
        raise HTTPException(status_code=409, detail=conflito)

    unidade_nome = payload.get("unidade")
    unidade = await db.scalar(select(Unidade).where(Unidade.nome == unidade_nome)) if unidade_nome else None
    if not unidade:
        unidade = await db.scalar(select(Unidade).limit(1))
    if not unidade:
        unidade = Unidade(nome=unidade_nome or "Unidade Padrao", cep="00000000", endereco="Nao informado")
        db.add(unidade)
        await db.flush()

    agenda = await db.scalar(select(Agenda).where(Agenda.unidade_id == unidade.id, Agenda.data == data_ref))
    if not agenda:
        agenda = Agenda(unidade_id=unidade.id, data=data_ref)
        db.add(agenda)
        await db.flush()

    aula = Aula(
        agenda_id=agenda.id,
        contrato_id=None,
        aluno_id=aluno_id,
        professor_id=prof.id,
        inicio=ini,
        fim=fim,
        status="agendada",
        valor=valor,
    )
    db.add(aula)
    if valor > 0:
        db.add(ContaReceber(contrato_id=None, aluno_id=aluno_id, vencimento=data_ref, valor=valor, status="aberto"))
    await db.commit()
    await db.refresh(aula)
    return {"ok": True, "aula_id": aula.id}


@router.put("/{aluno_id}/aulas/{aula_id}/reagendar")
async def reagendar_aula(aluno_id: int, aula_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    aula = await db.scalar(select(Aula).where(Aula.id == aula_id, Aula.aluno_id == aluno_id))
    if not aula:
        raise HTTPException(status_code=404, detail="Aula nao encontrada")
    if (aula.status or "").lower() == "realizada":
        raise HTTPException(status_code=400, detail="Aula realizada nao pode ser reagendada")

    data_txt = payload.get("data")
    hora_txt = payload.get("hora")
    if not data_txt or not hora_txt:
        raise HTTPException(status_code=400, detail="Informe data e hora")

    try:
        data_base = datetime.strptime(data_txt, "%Y-%m-%d").date()
        hh, mm = hora_txt.split(":")
        novo_inicio = datetime(data_base.year, data_base.month, data_base.day, int(hh), int(mm))
    except Exception:
        raise HTTPException(status_code=400, detail="Formato invalido. Use data YYYY-MM-DD e hora HH:MM")

    duracao = int((aula.fim - aula.inicio).total_seconds() // 60) if aula.fim and aula.inicio else 60
    novo_fim = novo_inicio + timedelta(minutes=max(duracao, 30))
    conflito = await slot_em_conflito(db, aula.professor_id, novo_inicio, novo_fim, ignore_aula_id=aula.id)
    if conflito:
        raise HTTPException(status_code=409, detail=conflito)

    agenda_atual = await db.get(Agenda, aula.agenda_id)
    if not agenda_atual:
        raise HTTPException(status_code=400, detail="Agenda da aula nao encontrada")

    agenda_destino = await db.scalar(select(Agenda).where(Agenda.unidade_id == agenda_atual.unidade_id, Agenda.data == data_base))
    if not agenda_destino:
        agenda_destino = Agenda(unidade_id=agenda_atual.unidade_id, data=data_base)
        db.add(agenda_destino)
        await db.flush()

    aula.agenda_id = agenda_destino.id
    aula.inicio = novo_inicio
    aula.fim = novo_fim
    aula.status = "agendada"
    await db.commit()
    return {"ok": True}


@router.delete("/{aluno_id}/aulas/{aula_id}")
async def deletar_aula_aluno(aluno_id: int, aula_id: int, db: AsyncSession = Depends(get_db)):
    aula = await db.scalar(select(Aula).where(Aula.id == aula_id, Aula.aluno_id == aluno_id))
    if not aula:
        raise HTTPException(status_code=404, detail="Aula nao encontrada")
    if (aula.status or "").lower() == "realizada":
        raise HTTPException(status_code=400, detail="Aula realizada nao pode ser deletada")
    await db.delete(aula)
    await db.commit()
    return {"ok": True}


@router.get("/{aluno_id}/financeiro")
async def listar_financeiro_aluno(aluno_id: int, status: str | None = None, db: AsyncSession = Depends(get_db)):
    await ensure_finance_columns(db)
    where_status = ""
    params = {"aluno_id": aluno_id}
    if status:
      where_status = " AND LOWER(COALESCE(status, 'aberto')) = :status "
      params["status"] = status.lower()
    rows = (
        await db.execute(
            text(
                f"""
                SELECT id, vencimento, valor, status, data_pagamento
                FROM contas_receber
                WHERE aluno_id = :aluno_id
                {where_status}
                ORDER BY vencimento DESC, id DESC
                """
            ),
            params,
        )
    ).all()
    return [
        {
            "id": r[0],
            "vencimento": r[1].strftime("%d/%m/%Y") if r[1] else "--",
            "valor": float(r[2] or 0),
            "status": r[3] or "aberto",
            "data_pagamento": r[4].strftime("%d/%m/%Y") if r[4] else None,
        }
        for r in rows
    ]


@router.put("/{aluno_id}/financeiro/{conta_id}/vencimento")
async def alterar_vencimento_conta(aluno_id: int, conta_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    data_txt = payload.get("vencimento")
    if not data_txt:
        raise HTTPException(status_code=400, detail="Informe vencimento")
    try:
        data_venc = datetime.strptime(data_txt, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Formato de data invalido")
    res = await db.execute(
        text("UPDATE contas_receber SET vencimento = :venc WHERE id = :id AND aluno_id = :aluno_id"),
        {"venc": data_venc, "id": conta_id, "aluno_id": aluno_id},
    )
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Lancamento nao encontrado")
    return {"ok": True}


@router.delete("/{aluno_id}/financeiro/{conta_id}")
async def excluir_lancamento_financeiro(aluno_id: int, conta_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("DELETE FROM contas_receber WHERE id = :id AND aluno_id = :aluno_id"), {"id": conta_id, "aluno_id": aluno_id})
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Lancamento nao encontrado")
    return {"ok": True}


@router.post("/{aluno_id}/financeiro/{conta_id}/pagar")
async def pagar_lancamento_financeiro(aluno_id: int, conta_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_finance_columns(db)
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
                SELECT cr.id, cr.valor, cr.contrato_id, u.nome
                FROM contas_receber cr
                JOIN alunos a ON a.id = cr.aluno_id
                JOIN usuarios u ON u.id = a.usuario_id
                WHERE cr.id = :id AND cr.aluno_id = :aluno_id
                """
            ),
            {"id": conta_id, "aluno_id": aluno_id},
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Lancamento nao encontrado")

    plano_nome = "Sem plano"
    categoria = None
    subcategoria = None
    if row[2]:
        c = (await db.execute(text("SELECT plano_nome FROM aluno_contratos WHERE id = :id"), {"id": row[2]})).first()
        if c and c[0]:
            plano_nome = c[0]
            p = (
                await db.execute(
                    text("SELECT categoria, subcategoria FROM planos WHERE nome = :nome ORDER BY id DESC LIMIT 1"),
                    {"nome": plano_nome},
                )
            ).first()
            if p:
                categoria = p[0]
                subcategoria = p[1]

    await db.execute(
        text(
            """
            UPDATE contas_receber
            SET status = 'pago', data_pagamento = :data_pagamento, conta_bancaria_id = :conta_bancaria_id
            WHERE id = :id AND aluno_id = :aluno_id
            """
        ),
        {
            "data_pagamento": data_pagamento,
            "conta_bancaria_id": conta_bancaria_id,
            "id": conta_id,
            "aluno_id": aluno_id,
        },
    )

    if conta_bancaria_id:
        await db.execute(
            text("UPDATE contas_bancarias SET saldo = COALESCE(saldo, 0) + :valor WHERE id = :id"),
            {"valor": float(row[1] or 0), "id": int(conta_bancaria_id)},
        )

    await db.execute(
        text(
            """
            INSERT INTO movimentos_bancarios (data_movimento, tipo, valor, descricao, categoria, subcategoria, created_at, updated_at)
            VALUES (:data_movimento, 'entrada', :valor, :descricao, :categoria, :subcategoria, NOW(), NOW())
            """
        ),
        {
            "data_movimento": data_pagamento,
            "valor": float(row[1] or 0),
            "descricao": f"{row[3]} + {plano_nome}",
            "categoria": categoria,
            "subcategoria": subcategoria,
        },
    )
    await db.commit()
    return {"ok": True}


@router.post("")
async def create_aluno(payload: AlunoIn, db: AsyncSession = Depends(get_db)):
    row = Aluno(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"id": row.id}


@router.post("/cadastro")
async def cadastro_aluno(
    payload: AlunoCadastroIn,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_role(Role.gestor, Role.professor)),
):
    await ensure_details_table(db)
    exists = await db.scalar(select(Usuario).where(Usuario.email == payload.login))
    if exists:
        raise HTTPException(status_code=409, detail="Login ja existe")

    usuario = Usuario(nome=payload.nome, email=payload.login, senha_hash=get_password_hash("123"), role=Role.aluno, ativo=True)
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)

    aluno = Aluno(usuario_id=usuario.id, telefone=payload.telefone, status=payload.status)
    db.add(aluno)
    await db.commit()
    await db.refresh(aluno)

    await db.execute(
        text("INSERT INTO aluno_detalhes (aluno_id, email_contato, data_aniversario, cep, endereco, idade, unidade) VALUES (:aluno_id, :email, :data, :cep, :endereco, :idade, :unidade)"),
        {
            "aluno_id": aluno.id,
            "email": payload.email,
            "data": payload.data_aniversario,
            "cep": payload.cep,
            "endereco": payload.endereco,
            "idade": payload.idade,
            "unidade": payload.unidade,
        },
    )
    await db.commit()

    return {"id": aluno.id, "usuario_id": usuario.id, "role": "aluno"}


@router.put("/{aluno_id}")
async def update_aluno(aluno_id: int, payload: AlunoIn, db: AsyncSession = Depends(get_db)):
    row = await db.get(Aluno, aluno_id)
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    return {"ok": True}


@router.delete("/{aluno_id}")
async def delete_aluno(aluno_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(Aluno, aluno_id)
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    await db.execute(text("DELETE FROM aluno_detalhes WHERE aluno_id = :id"), {"id": aluno_id})
    await db.execute(text("DELETE FROM aluno_contratos WHERE aluno_id = :id"), {"id": aluno_id})
    await db.delete(row)
    await db.commit()
    return {"ok": True}


