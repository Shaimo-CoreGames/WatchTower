from fastapi import APIRouter
from app.api.v1 import auth, monitors,analytics,test

api_router = APIRouter()

# Register the authentication router endpoints globally under the v1 architecture prefix
api_router.include_router(auth.router)
api_router.include_router(monitors.router) # mounted ( means all endpoints in monitors.py are now prefixed with /api/v1/monitors)
api_router.include_router(analytics.router)
api_router.include_router(test.router)
