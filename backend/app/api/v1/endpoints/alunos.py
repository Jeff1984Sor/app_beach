from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.db.session import get_db
from app.api.deps import require_role
from app.models.entities import Aluno, Usuario, Role, Aula, ContaReceber
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
    row = (await db.execute(select(Aluno, Usuario).join(Usuario, Usuario.id == Aluno.usuario_id).where(Aluno.id == aluno_id))).first()
    if not row:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")

    aluno, user = row
    d = await get_details(db, aluno.id)
    aulas = (await db.execute(select(Aula).where(Aula.aluno_id == aluno_id).order_by(Aula.inicio.desc()).limit(20))).scalars().all()
    financeiro = (await db.execute(select(ContaReceber).where(ContaReceber.aluno_id == aluno_id).order_by(ContaReceber.vencimento.desc()).limit(20))).scalars().all()

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
        "contratos": [{"id": 1, "plano": "Plano Mensal", "inicio": date.today().strftime("%d/%m/%Y"), "fim": date.today().strftime("%d/%m/%Y"), "status": "Ativo"}],
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
    await db.delete(row)
    await db.commit()
    return {"ok": True}
