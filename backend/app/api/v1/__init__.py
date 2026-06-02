from fastapi import APIRouter

from app.api.v1 import auth, monitors, analytics, test
from app.api.v1.endpoints import websocket, incidents, integrations, settings

api_router = APIRouter()

# 🟢 FIX: Remove the redundant sub-prefixes since they are already declared inside the individual endpoint files!
api_router.include_router(auth.router)
api_router.include_router(monitors.router) 
api_router.include_router(analytics.router)
api_router.include_router(test.router)
api_router.include_router(websocket.router)
api_router.include_router(incidents.router)
api_router.include_router(integrations.router)
api_router.include_router(settings.router)