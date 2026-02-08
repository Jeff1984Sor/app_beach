from pydantic import BaseModel
from app.models.entities import Role


class LoginInput(BaseModel):
    login: str
    senha: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshInput(BaseModel):
    refresh_token: str


class UsuarioMe(BaseModel):
    id: int
    nome: str
    login: str
    role: Role
