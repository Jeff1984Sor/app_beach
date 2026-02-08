from pydantic import BaseModel, EmailStr
from app.models.entities import Role


class LoginInput(BaseModel):
    email: EmailStr
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
    email: EmailStr
    role: Role

