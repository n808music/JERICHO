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
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:5183",
        "http://localhost:3000",
    ]
    
    # Environment
    environment: str = "development"

    # Calendar OAuth + encryption
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8000/api/calendar/google/callback"
    credential_encryption_key: str = "dev-encryption-key-change-in-production"

    class Config:
        env_file = ".env"


settings = Settings()