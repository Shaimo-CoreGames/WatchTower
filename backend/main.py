from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings

from app.core.database import async_engine 
from app.core.database import Base
from app.api.v1.endpoints import websocket
import asyncio
from app.api.v1.endpoints.websocket import redis_listener



@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup Logic ---
    # This automatically builds your tables in the 'watchtower' database if they don't exist
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all) # that's why __init__.py imports Base and all models
    
    yield  # The application runs while paused here
    
    # --- Shutdown Logic (Optional) ---
    # Clear connections or pools here if needed
    pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-Performance Distributed Website Uptime & Performance Monitor Backend Engine.",
    version="1.0.0",
    lifespan=lifespan  # Register the lifespan context manager
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount our modular API Version 1 Router endpoints securely
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(websocket.router, tags=["websockets"])

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(redis_listener())

@app.get("/")
async def root_health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "message": "API Gateway Core Engine Operational"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)