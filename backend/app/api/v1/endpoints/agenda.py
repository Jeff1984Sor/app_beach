from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.db.session import get_db
from app.models.entities import Agenda, Aula, Profissional, Unidade, Usuario, Aluno

router = APIRouter(prefix="/agenda", tags=["agenda"])

BR_TZ_NAME = "America/Sao_Paulo"


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


def dia_label_to_weekday(dia: str) -> int | None:
    mapa = {"seg": 0, "ter": 1, "qua": 2, "qui": 3, "sex": 4, "sab": 5, "dom": 6}
    return mapa.get((dia or "").strip().lower()[:3])


def parse_hora_min(hhmm: str) -> tuple[int, int]:
    try:
        h, m = hhmm.split(":")
        return int(h), int(m)
    except Exception:
        raise HTTPException(status_code=400, detail="Hora invalida. Use HH:MM")


def min_to_hhmm(total_min: int) -> str:
    h = total_min // 60
    m = total_min % 60
    return f"{h:02d}:{m:02d}"


@router.get("/professores")
async def listar_professores(db: AsyncSession = Depends(get_db)):
    # Usuarios e Profissionais sao a mesma pessoa: garante que gestor/professor sempre tenham linha em profissionais
    # para poderem ser selecionados em contratos/aulas.
    await db.execute(
        text(
            """
            INSERT INTO profissionais (usuario_id, valor_hora, created_at, updated_at)
            SELECT u.id, 0, NOW(), NOW()
            FROM usuarios u
            WHERE u.ativo = TRUE
              AND u.role <> 'aluno'
              AND NOT EXISTS (SELECT 1 FROM profissionais p WHERE p.usuario_id = u.id)
            """
        )
    )
    await db.commit()
    rows = (
        await db.execute(
            select(Profissional.id, Profissional.usuario_id, Usuario.nome)
            .join(Usuario, Usuario.id == Profissional.usuario_id)
            .where(Usuario.ativo == True)
            .where(Usuario.role != "aluno")
            .order_by(Usuario.nome.asc())
        )
    ).all()
    return [{"id": r[0], "usuario_id": r[1], "nome": r[2]} for r in rows]


@router.get("")
async def listar_agenda(data: date | None = None, profissional_id: int | None = None, db: AsyncSession = Depends(get_db)):
    await ensure_bloqueios_table(db)
    dia = data or date.today()
    UsuarioAluno = aliased(Usuario)

    aulas_q = (
        select(
            Aula.id,
            Aula.inicio,
            Aula.fim,
            Aula.status,
            Aula.professor_id,
            func.coalesce(Usuario.nome, "Sem professor").label("professor_nome"),
            Aula.aluno_id,
            func.coalesce(UsuarioAluno.nome, "").label("aluno_nome"),
            func.coalesce(Unidade.nome, "").label("unidade_nome"),
            func.to_char(func.timezone(BR_TZ_NAME, Aula.inicio), "DD/MM/YYYY").label("data_br"),
            func.to_char(func.timezone(BR_TZ_NAME, Aula.inicio), "HH24:MI").label("hora_br"),
        )
        .join(Agenda, Aula.agenda_id == Agenda.id, isouter=True)
        .join(Profissional, Profissional.id == Aula.professor_id, isouter=True)
        .join(Usuario, Usuario.id == Profissional.usuario_id, isouter=True)
        .join(Aluno, Aluno.id == Aula.aluno_id, isouter=True)
        .join(UsuarioAluno, UsuarioAluno.id == Aluno.usuario_id, isouter=True)
        .join(Unidade, Unidade.id == Agenda.unidade_id, isouter=True)
        # Stored as timestamptz (UTC). Filter by Brazil-local date.
        .where(func.date(func.timezone(BR_TZ_NAME, Aula.inicio)) == dia)
        .order_by(Aula.inicio.asc())
    )
    if profissional_id:
        aulas_q = aulas_q.where(Aula.professor_id == profissional_id)
    aulas_rows = (await db.execute(aulas_q)).all()

    bloqueios_rows = (
        await db.execute(
            text(
                """
                SELECT b.id, b.data, b.hora_inicio, b.hora_fim, b.motivo, b.profissional_id,
                       COALESCE(u.nome, 'Todos') AS professor_nome,
                       COALESCE(un.nome, '') AS unidade_nome
                FROM agenda_bloqueios b
                LEFT JOIN profissionais p ON p.id = b.profissional_id
                LEFT JOIN usuarios u ON u.id = p.usuario_id
                LEFT JOIN unidades un ON un.id = b.unidade_id
                WHERE b.data = :data
                  AND LOWER(COALESCE(b.status, 'ativo')) = 'ativo'
                  AND ((:profissional_id)::int IS NULL OR b.profissional_id IS NULL OR b.profissional_id = (:profissional_id)::int)
                ORDER BY b.hora_inicio ASC
                """
            ),
            {"data": dia, "profissional_id": profissional_id},
        )
    ).all()

    return {
        "data": dia.strftime("%Y-%m-%d"),
        "aulas": [
            {
                "id": r[0],
                "inicio": r[1],
                "fim": r[2],
                "status": r[3],
                "professor_id": r[4],
                "professor_nome": r[5],
                "aluno_id": r[6],
                "aluno_nome": r[7] or "",
                "unidade": r[8] or "",
                "data_br": r[9],
                "hora_br": r[10],
            }
            for r in aulas_rows
        ],
        "bloqueios": [
            {
                "id": r[0],
                "data": r[1].strftime("%Y-%m-%d") if r[1] else None,
                "hora_inicio": r[2],
                "hora_fim": r[3],
                "motivo": r[4] or "",
                "profissional_id": r[5],
                "professor_nome": r[6],
                "unidade": r[7],
            }
            for r in bloqueios_rows
        ],
    }


@router.get("/periodo")
async def listar_agenda_periodo(
    data_inicio: date,
    data_fim: date,
    profissional_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    await ensure_bloqueios_table(db)
    if data_fim < data_inicio:
        data_fim = data_inicio
    UsuarioAluno = aliased(Usuario)

    aulas_q = (
        select(
            Aula.id,
            Aula.inicio,
            Aula.fim,
            Aula.status,
            Aula.professor_id,
            func.coalesce(Usuario.nome, "Sem professor").label("professor_nome"),
            Aula.aluno_id,
            func.coalesce(UsuarioAluno.nome, "").label("aluno_nome"),
            func.coalesce(Unidade.nome, "").label("unidade_nome"),
            func.date(Aula.inicio).label("data"),
            func.to_char(func.timezone(BR_TZ_NAME, Aula.inicio), "DD/MM/YYYY").label("data_br"),
            func.to_char(func.timezone(BR_TZ_NAME, Aula.inicio), "HH24:MI").label("hora_br"),
        )
        .join(Agenda, Aula.agenda_id == Agenda.id, isouter=True)
        .join(Profissional, Profissional.id == Aula.professor_id, isouter=True)
        .join(Usuario, Usuario.id == Profissional.usuario_id, isouter=True)
        .join(Aluno, Aluno.id == Aula.aluno_id, isouter=True)
        .join(UsuarioAluno, UsuarioAluno.id == Aluno.usuario_id, isouter=True)
        .join(Unidade, Unidade.id == Agenda.unidade_id, isouter=True)
        .where(func.date(func.timezone(BR_TZ_NAME, Aula.inicio)).between(data_inicio, data_fim))
        .order_by(Aula.inicio.asc())
    )
    if profissional_id:
        aulas_q = aulas_q.where(Aula.professor_id == profissional_id)
    aulas_rows = (await db.execute(aulas_q)).all()

    bloqueios = (
        await db.execute(
            text(
                """
                SELECT b.id, b.data, b.hora_inicio, b.hora_fim, b.motivo, b.profissional_id,
                       COALESCE(u.nome, 'Todos') AS professor_nome,
                       COALESCE(un.nome, '') AS unidade_nome
                FROM agenda_bloqueios b
                LEFT JOIN profissionais p ON p.id = b.profissional_id
                LEFT JOIN usuarios u ON u.id = p.usuario_id
                LEFT JOIN unidades un ON un.id = b.unidade_id
                WHERE b.data BETWEEN :data_inicio AND :data_fim
                  AND LOWER(COALESCE(b.status, 'ativo')) = 'ativo'
                  AND ((:profissional_id)::int IS NULL OR b.profissional_id IS NULL OR b.profissional_id = (:profissional_id)::int)
                ORDER BY b.data ASC, b.hora_inicio ASC
                """
            ),
            {"data_inicio": data_inicio, "data_fim": data_fim, "profissional_id": profissional_id},
        )
    ).all()

    return {
        "data_inicio": data_inicio.strftime("%Y-%m-%d"),
        "data_fim": data_fim.strftime("%Y-%m-%d"),
        "aulas": [
            {
                "id": r[0],
                "inicio": r[1],
                "fim": r[2],
                "status": r[3],
                "professor_id": r[4],
                "professor_nome": r[5],
                "aluno_id": r[6],
                "aluno_nome": r[7] or "",
                "unidade": r[8] or "",
                "data": r[9].strftime("%Y-%m-%d") if r[9] else None,
                "data_br": r[10],
                "hora_br": r[11],
            }
            for r in aulas_rows
        ],
        "bloqueios": [
            {
                "id": r[0],
                "data": r[1].strftime("%Y-%m-%d") if r[1] else None,
                "hora_inicio": r[2],
                "hora_fim": r[3],
                "motivo": r[4] or "",
                "profissional_id": r[5],
                "professor_nome": r[6],
                "unidade": r[7],
            }
            for r in bloqueios
        ],
    }


@router.post("/bloqueios")
async def criar_bloqueio(payload: dict, db: AsyncSession = Depends(get_db)):
    await ensure_bloqueios_table(db)
    data_inicio_txt = payload.get("data_inicio")
    data_fim_txt = payload.get("data_fim") or data_inicio_txt
    hora_inicio = (payload.get("hora_inicio") or "").strip()
    hora_fim = (payload.get("hora_fim") or "").strip()
    motivo = (payload.get("motivo") or "").strip() or None
    profissional_id = payload.get("profissional_id")
    unidade_id = payload.get("unidade_id")
    dias_semana = payload.get("dias_semana") or []

    if not data_inicio_txt or not hora_inicio or not hora_fim:
        raise HTTPException(status_code=400, detail="Informe data inicio, hora inicio e hora fim")

    try:
        data_inicio = datetime.strptime(data_inicio_txt, "%Y-%m-%d").date()
        data_fim = datetime.strptime(data_fim_txt, "%Y-%m-%d").date()
        h1, m1 = parse_hora_min(hora_inicio)
        h2, m2 = parse_hora_min(hora_fim)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data invalida. Use YYYY-MM-DD")

    if data_fim < data_inicio:
        data_fim = data_inicio
    ini_min = h1 * 60 + m1
    fim_min = h2 * 60 + m2
    if fim_min <= ini_min:
        raise HTTPException(status_code=400, detail="Hora fim deve ser maior que hora inicio")

    # When user blocks multiple full hours (e.g. 10:00-13:00), store it as 1 record per hour.
    # This makes availability checks and UI clearer (and matches expected behavior).
    split_hourly = (m1 == 0) and (m2 == 0) and ((fim_min - ini_min) >= 120) and ((fim_min - ini_min) % 60 == 0)

    dias_validos = [dia_label_to_weekday(d) for d in dias_semana]
    dias_validos = [d for d in dias_validos if d is not None]

    total = 0
    cursor = data_inicio
    while cursor <= data_fim:
        if not dias_validos or cursor.weekday() in dias_validos:
            if split_hourly:
                t = ini_min
                while t < fim_min:
                    await db.execute(
                        text(
                            """
                            INSERT INTO agenda_bloqueios (profissional_id, unidade_id, data, hora_inicio, hora_fim, motivo, status, created_at, updated_at)
                            VALUES (:profissional_id, :unidade_id, :data, :hora_inicio, :hora_fim, :motivo, 'ativo', NOW(), NOW())
                            """
                        ),
                        {
                            "profissional_id": profissional_id,
                            "unidade_id": unidade_id,
                            "data": cursor,
                            "hora_inicio": min_to_hhmm(t),
                            "hora_fim": min_to_hhmm(t + 60),
                            "motivo": motivo,
                        },
                    )
                    total += 1
                    t += 60
            else:
                await db.execute(
                    text(
                        """
                        INSERT INTO agenda_bloqueios (profissional_id, unidade_id, data, hora_inicio, hora_fim, motivo, status, created_at, updated_at)
                        VALUES (:profissional_id, :unidade_id, :data, :hora_inicio, :hora_fim, :motivo, 'ativo', NOW(), NOW())
                        """
                    ),
                    {
                        "profissional_id": profissional_id,
                        "unidade_id": unidade_id,
                        "data": cursor,
                        "hora_inicio": hora_inicio,
                        "hora_fim": hora_fim,
                        "motivo": motivo,
                    },
                )
                total += 1
        cursor += timedelta(days=1)

    await db.commit()
    return {"ok": True, "bloqueios_criados": total}


@router.delete("/bloqueios/{bloqueio_id}")
async def excluir_bloqueio(bloqueio_id: int, db: AsyncSession = Depends(get_db)):
    await ensure_bloqueios_table(db)
    res = await db.execute(text("DELETE FROM agenda_bloqueios WHERE id = :id"), {"id": bloqueio_id})
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Bloqueio nao encontrado")
    return {"ok": True}


@router.get("/bloqueios")
async def listar_bloqueios_periodo(
    data_inicio: date,
    data_fim: date | None = None,
    profissional_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    await ensure_bloqueios_table(db)
    fim = data_fim or data_inicio
    if fim < data_inicio:
        fim = data_inicio

    rows = (
        await db.execute(
            text(
                """
                SELECT b.id, b.data, b.hora_inicio, b.hora_fim, b.motivo, b.profissional_id,
                       COALESCE(u.nome, 'Todos') AS professor_nome,
                       COALESCE(un.nome, '') AS unidade_nome
                FROM agenda_bloqueios b
                LEFT JOIN profissionais p ON p.id = b.profissional_id
                LEFT JOIN usuarios u ON u.id = p.usuario_id
                LEFT JOIN unidades un ON un.id = b.unidade_id
                WHERE b.data BETWEEN :data_inicio AND :data_fim
                  AND LOWER(COALESCE(b.status, 'ativo')) = 'ativo'
                  AND ((:profissional_id)::int IS NULL OR b.profissional_id IS NULL OR b.profissional_id = (:profissional_id)::int)
                ORDER BY b.data ASC, b.hora_inicio ASC
                """
            ),
            {"data_inicio": data_inicio, "data_fim": fim, "profissional_id": profissional_id},
        )
    ).all()

    return [
        {
            "id": r[0],
            "data": r[1].strftime("%Y-%m-%d") if r[1] else None,
            "hora_inicio": r[2],
            "hora_fim": r[3],
            "motivo": r[4] or "",
            "profissional_id": r[5],
            "professor_nome": r[6],
            "unidade": r[7],
        }
        for r in rows
    ]
