from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

# Convertir URL a usar driver psycopg (v3) en lugar de psycopg2
# DATABASE_URL debe ser una URL completa: postgresql://user:password@host:port/dbname?sslmode=require
# Soporta: postgresql://, postgres://, y postgresql+psycopg://
database_url = settings.database_url.strip()

# Solo convertir si no tiene ya el driver psycopg especificado
# Esto preserva parámetros de query como ?sslmode=require
if database_url.startswith("postgresql+psycopg://"):
    # Ya tiene el driver correcto, usar directamente
    pass
elif database_url.startswith("postgresql://"):
    # Convertir postgresql:// a postgresql+psycopg:// (preserva query params)
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgres://"):
    # Convertir postgres:// a postgresql+psycopg:// (preserva query params)
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
else:
    # URL no reconocida, usar tal cual (puede fallar pero no la modificamos)
    pass

engine = create_engine(database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

