from fastapi import APIRouter
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.public import router as public_router
from app.api.v1.endpoints.agenda import router as agenda_router
from app.api.v1.endpoints.alunos import router as alunos_router
from app.api.v1.endpoints.core import router as core_router
from app.api.v1.endpoints.bancario import router as bancario_router
from app.api.v1.endpoints.planos import router as planos_router
from app.api.v1.endpoints.unidades import router as unidades_router
from app.api.v1.endpoints.usuarios import router as usuarios_router
from app.api.v1.endpoints.categorias import router as categorias_router
from app.api.v1.endpoints.contas_receber import router as contas_receber_router
from app.api.v1.endpoints.contas_pagar import router as contas_pagar_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(public_router)
router.include_router(agenda_router)
router.include_router(alunos_router)
router.include_router(core_router)
router.include_router(bancario_router)
router.include_router(planos_router)
router.include_router(unidades_router)
router.include_router(usuarios_router)
router.include_router(categorias_router)
router.include_router(contas_receber_router)
router.include_router(contas_pagar_router)
