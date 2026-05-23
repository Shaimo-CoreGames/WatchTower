import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-Performance Distributed Website Uptime & Performance Monitor Backend Engine.",
    version="1.0.0"
)

# Configure CORS cross-origin rules for our Next.js frontend later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js standard dev port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root_health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "message": "API Gateway Core Engine Operational"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)