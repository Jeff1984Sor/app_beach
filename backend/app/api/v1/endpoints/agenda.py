from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from app.db.session import get_db
from app.models.entities import Agenda, Aula

router = APIRouter(prefix="/agenda", tags=["agenda"])


@router.get("")
async def listar_agenda(data: date | None = None, db: AsyncSession = Depends(get_db)):
    if data:
        agenda = await db.execute(select(Aula).join(Agenda, Aula.agenda_id == Agenda.id).where(Agenda.data == data))
    else:
        agenda = await db.execute(select(Aula))
    return [{"id": a.id, "inicio": a.inicio, "fim": a.fim, "status": a.status} for a in agenda.scalars().all()]

