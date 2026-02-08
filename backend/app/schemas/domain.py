from datetime import datetime, date
from pydantic import BaseModel


class AlunoIn(BaseModel):
    usuario_id: int
    telefone: str | None = None
    status: str = "ativo"


class AlunoOut(AlunoIn):
    id: int


class AulaIn(BaseModel):
    agenda_id: int
    aluno_id: int
    professor_id: int
    inicio: datetime
    fim: datetime
    status: str = "agendada"
    valor: float = 0


class AulaOut(AulaIn):
    id: int


class FinanceiroIn(BaseModel):
    tipo: str
    data: date
    valor: float
    descricao: str | None = None

