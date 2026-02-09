from sqlalchemy import String, ForeignKey, Numeric, Date, DateTime, Text, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
import enum
from app.db.base import Base, TimestampMixin


class Role(str, enum.Enum):
    gestor = "gestor"
    professor = "professor"
    aluno = "aluno"


class Usuario(Base, TimestampMixin):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), index=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class Unidade(Base, TimestampMixin):
    __tablename__ = "unidades"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    cep: Mapped[str] = mapped_column(String(9))
    endereco: Mapped[str] = mapped_column(String(255))


class Profissional(Base, TimestampMixin):
    __tablename__ = "profissionais"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), unique=True)
    valor_hora: Mapped[float] = mapped_column(Numeric(10, 2), default=0)


class Aluno(Base, TimestampMixin):
    __tablename__ = "alunos"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), unique=True)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ativo")


class Agenda(Base, TimestampMixin):
    __tablename__ = "agendas"
    id: Mapped[int] = mapped_column(primary_key=True)
    unidade_id: Mapped[int] = mapped_column(ForeignKey("unidades.id"))
    data: Mapped[date] = mapped_column(Date, index=True)


class Aula(Base, TimestampMixin):
    __tablename__ = "aulas"
    id: Mapped[int] = mapped_column(primary_key=True)
    agenda_id: Mapped[int] = mapped_column(ForeignKey("agendas.id"))
    contrato_id: Mapped[int | None] = mapped_column(nullable=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id"))
    professor_id: Mapped[int] = mapped_column(ForeignKey("profissionais.id"))
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    fim: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="agendada")
    valor: Mapped[float] = mapped_column(Numeric(10, 2), default=0)


class ContaReceber(Base, TimestampMixin):
    __tablename__ = "contas_receber"
    id: Mapped[int] = mapped_column(primary_key=True)
    contrato_id: Mapped[int | None] = mapped_column(nullable=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id"))
    vencimento: Mapped[date] = mapped_column(Date)
    valor: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(20), default="aberto")
    data_pagamento: Mapped[date | None] = mapped_column(Date, nullable=True)
    conta_bancaria_id: Mapped[int | None] = mapped_column(nullable=True)


class ContaPagar(Base, TimestampMixin):
    __tablename__ = "contas_pagar"
    id: Mapped[int] = mapped_column(primary_key=True)
    vencimento: Mapped[date] = mapped_column(Date)
    valor: Mapped[float] = mapped_column(Numeric(10, 2))
    descricao: Mapped[str] = mapped_column(String(255))
    categoria: Mapped[str | None] = mapped_column(String(120), nullable=True)
    subcategoria: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="aberto")
    data_pagamento: Mapped[date | None] = mapped_column(Date, nullable=True)
    profissional_id: Mapped[int | None] = mapped_column(ForeignKey("profissionais.id"), nullable=True)
    referencia_mes: Mapped[str | None] = mapped_column(String(7), nullable=True)  # YYYY-MM


class MovimentoBancario(Base, TimestampMixin):
    __tablename__ = "movimentos_bancarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    data_movimento: Mapped[date] = mapped_column(Date)
    tipo: Mapped[str] = mapped_column(String(20))
    valor: Mapped[float] = mapped_column(Numeric(10, 2))
    descricao: Mapped[str | None] = mapped_column(String(255), nullable=True)
    categoria: Mapped[str | None] = mapped_column(String(120), nullable=True)
    subcategoria: Mapped[str | None] = mapped_column(String(120), nullable=True)


class RegraComissao(Base, TimestampMixin):
    __tablename__ = "regras_comissao"
    id: Mapped[int] = mapped_column(primary_key=True)
    profissional_id: Mapped[int] = mapped_column(ForeignKey("profissionais.id"))
    tipo: Mapped[str] = mapped_column(String(20), default="percentual")  # percentual | valor_aula
    percentual: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    valor_por_aula: Mapped[float] = mapped_column(Numeric(10, 2), default=0)


class MediaFile(Base, TimestampMixin):
    __tablename__ = "media_files"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(120))


class EmpresaConfig(Base, TimestampMixin):
    __tablename__ = "empresa_configs"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome_fantasia: Mapped[str] = mapped_column(String(120), default="Next Level Assessoria Esportiva")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cor_primaria: Mapped[str] = mapped_column(String(7), default="#0A84FF")
    whatsapp: Mapped[str | None] = mapped_column(String(20), nullable=True)

