"""
JERICHO Backend - FastAPI Application

Production-ready backend for goal planning and execution system.
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import uvicorn

from app.core.config import settings
from app.api import auth, goals, blocks, sync
from app.core.database import engine, Base

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="JERICHO Backend API",
    description="Production backend for goal planning and execution system",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(goals.router, prefix="/api/goals", tags=["goals"])
app.include_router(blocks.router, prefix="/api/blocks", tags=["blocks"])
app.include_router(sync.router, prefix="/api/sync", tags=["synchronization"])

# Security
security = HTTPBearer()


@app.get("/")
async def root():
    return {"message": "JERICHO Backend API", "status": "healthy"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.environment
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development"
    )