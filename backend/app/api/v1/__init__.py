from fastapi import APIRouter
from app.api.v1 import auth

api_router = APIRouter()

# Register the authentication router endpoints globally under the v1 architecture prefix
api_router.include_router(auth.router)