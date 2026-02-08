import asyncio
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.entities import Usuario, Role
from app.core.security import get_password_hash


USERS = [
    {"nome": "Gestor Master", "email": "gestor@appbeach.com", "senha": "Admin@123", "role": Role.gestor},
    {"nome": "Professor Demo", "email": "professor@appbeach.com", "senha": "Prof@123", "role": Role.professor},
    {"nome": "Aluno Demo", "email": "aluno@appbeach.com", "senha": "Aluno@123", "role": Role.aluno},
]


async def main():
    async with SessionLocal() as db:
        for item in USERS:
            exists = await db.scalar(select(Usuario).where(Usuario.email == item["email"]))
            if exists:
                continue
            db.add(
                Usuario(
                    nome=item["nome"],
                    email=item["email"],
                    senha_hash=get_password_hash(item["senha"]),
                    role=item["role"],
                    ativo=True,
                )
            )
        await db.commit()
    print("Seed concluido")


if __name__ == "__main__":
    asyncio.run(main())
