# App Beach - SaaS Escola de Beach Tennis

Projeto reconstruído do zero com arquitetura moderna, separando backend e frontend.

## Stack

- Backend: FastAPI, SQLAlchemy 2 Async, Postgres, Alembic, JWT access/refresh
- Frontend: Next.js 14 App Router, TypeScript, Tailwind, React Query, Zustand, Framer Motion, PWA

## Estrutura

- `backend/`: API e domínio
- `frontend/`: aplicação web mobile-first (PWA)

## Backend

### Setup

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

### Endpoints mínimos

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `GET /api/v1/public/branding`
- `GET /api/v1/public/cep/{cep}`
- `GET /api/v1/agenda`
- `CRUD /api/v1/alunos`
- `CRUD /api/v1/aulas`
- `CRUD /api/v1/financeiro`
- `POST /api/v1/gerar-comissao`
- `GET /api/v1/dre`

## Frontend

### Setup

```bash
cd frontend
npm install
npm run dev
```

### Fluxo inicial implementado

1. Design System base premium iOS
2. Tela de login moderna
3. Home dinâmica por perfil (gestor/professor/aluno)
4. Agenda em cards
5. Ficha do aluno com abas
6. Financeiro com FAB e DRE visual
7. Cadastro inteligente com modo simples e completo
8. PWA com manifest e ícones

## Observações

- O frontend está preparado para integração com `/auth/me` e demais endpoints.
- O login atual usa mock de perfil por e-mail para acelerar validação visual/UX.
- Próximo passo recomendado: integrar autenticação real (JWT) e persistência completa de sessão.

## Usuarios reais para login

Rodar seed de usuarios:

```bash
cd backend
python -m app.scripts.seed_users
```

Credenciais criadas:

- gestor@appbeach.com / Admin@123
- professor@appbeach.com / Prof@123
- aluno@appbeach.com / Aluno@123

No frontend em producao, configure:

```bash
NEXT_PUBLIC_API_URL=http://SEU_IP:8010/api/v1
```

