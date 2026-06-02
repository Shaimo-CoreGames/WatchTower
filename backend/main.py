from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings
from app.core.database import async_engine 
from app.core.database import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup Logic ---
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield  # The app runs while paused here
    
    # --- Shutdown Logic ---
    # Cleaned up old global redis background tasks to let websocket endpoints 
    # handle their own independent lifecycles dynamically.


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-Performance Distributed Website Uptime & Performance Monitor Backend Engine.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clean, unified router registration
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root_health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)