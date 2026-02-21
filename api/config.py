from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    cors_origins: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

