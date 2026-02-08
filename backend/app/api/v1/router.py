from fastapi import APIRouter
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.public import router as public_router
from app.api.v1.endpoints.agenda import router as agenda_router
from app.api.v1.endpoints.alunos import router as alunos_router
from app.api.v1.endpoints.core import router as core_router
from app.api.v1.endpoints.planos import router as planos_router
from app.api.v1.endpoints.usuarios import router as usuarios_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(public_router)
router.include_router(agenda_router)
router.include_router(alunos_router)
router.include_router(core_router)
router.include_router(planos_router)
router.include_router(usuarios_router)
