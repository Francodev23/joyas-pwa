from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from config import settings
from database import get_db
from models import AppUser

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica una contraseña contra un hash bcrypt.
    Maneja excepciones de passlib/bcrypt de forma segura.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError, AttributeError) as e:
        # Hash corrupto, formato inválido, o error de passlib/bcrypt
        # No loggear el hash ni la contraseña por seguridad
        return False
    except Exception as e:
        # Cualquier otro error inesperado (ej: bcrypt no disponible)
        # Retornar False en lugar de lanzar excepción
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.jwt_expiration_hours)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def authenticate_user(db: Session, username: str, password: str):
    """
    Autentica un usuario verificando username y password.
    Maneja errores de DB y verificación de forma segura.
    """
    try:
        user = db.query(AppUser).filter(AppUser.username == username).first()
        if not user:
            return False
        # Validar que el hash existe y no está vacío
        if not user.password_hash or not user.password_hash.strip():
            return False
        if not verify_password(password, user.password_hash):
            return False
        return user
    except Exception as e:
        # Error de DB o cualquier otro error inesperado
        # Retornar False en lugar de lanzar excepción
        return False


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(AppUser).filter(AppUser.username == username).first()
    if user is None:
        raise credentials_exception
    return user

