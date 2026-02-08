from pydantic import BaseModel
from app.models.entities import Role


class UsuarioCreate(BaseModel):
    nome: str
    login: str
    senha: str
    role: Role


class UsuarioOut(BaseModel):
    id: int
    nome: str
    login: str
    role: Role
    ativo: bool


class UsuarioUpdate(BaseModel):
    nome: str
    role: Role
    ativo: bool = True
