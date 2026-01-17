from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database - SQLite for development, PostgreSQL for production
    database_url: str = "sqlite:///./jericho_dev.db"
    
    # Security
    jwt_secret: str = "your-super-secret-jwt-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration: int = 86400  # 24 hours
    
    # CORS
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # Environment
    environment: str = "development"
    
    class Config:
        env_file = ".env"


settings = Settings()