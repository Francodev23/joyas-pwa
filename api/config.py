from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    cors_origins: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Prioridad en pydantic-settings v2:
        # 1. Variables de entorno del sistema (OS env vars)
        # 2. Archivo .env (si existe)
        # En producción (Render), las variables de entorno tienen prioridad automáticamente
        env_ignore_empty=True,
    )


settings = Settings()

