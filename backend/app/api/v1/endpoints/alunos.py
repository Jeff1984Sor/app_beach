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
    row = (await db.execute(select(Aluno, Usuario).join(Usuario, Usuario.id == Aluno.usuario_id).where(Aluno.id == aluno_id))).first()
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")

    aluno, user = row
    d = await get_details(db, aluno.id)
    aulas = (await db.execute(select(Aula).where(Aula.aluno_id == aluno_id).order_by(Aula.inicio.desc()).limit(20))).scalars().all()
    financeiro = (await db.execute(select(ContaReceber).where(ContaReceber.aluno_id == aluno_id).order_by(ContaReceber.vencimento.desc()).limit(20))).scalars().all()
    contratos_rows = (await db.execute(text("SELECT id, plano_nome, data_inicio, data_fim, status FROM aluno_contratos WHERE aluno_id = :id ORDER BY id DESC"), {"id": aluno_id})).all()

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
    row = await db.get(Aluno, aluno_id)
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")

    plano_nome = payload.get("plano_nome") or "Plano Mensal"
    recorrencia = (payload.get("recorrencia") or "mensal").lower()
    valor = float(payload.get("valor") or 0)
    qtd_aulas_semanais = int(payload.get("qtd_aulas_semanais") or 0)
    dias_semana = ",".join(payload.get("dias_semana") or [])

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
        conta = ContaReceber(aluno_id=aluno_id, vencimento=venc, valor=valor, status="aberto")
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


@router.post("/{aluno_id}/contratos/{contrato_id}/reservas")
async def criar_reservas_contrato(aluno_id: int, contrato_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
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
                db.add(
                    Aula(
                        agenda_id=agenda.id,
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
    return {"ok": True, "aulas_criadas": aulas_criadas}


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


