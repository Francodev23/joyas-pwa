from fastapi import FastAPI, Depends, HTTPException, Query, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, text
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
import os
import uuid
import logging
from pathlib import Path

from database import get_db
from auth import authenticate_user, create_access_token, get_current_user, get_password_hash
from models import AppUser, Customer, Sale, SaleItem, Payment
from schemas import (
    LoginRequest, TokenResponse,
    CustomerCreate, CustomerResponse,
    SaleCreate, SaleResponse, SaleItemCreate, SaleItemResponse,
    PaymentCreate, PaymentResponse,
    SaleStatementResponse, KPIsResponse,
    HistoryMonthCustomerResponse,
    PaginatedResponse
)
from config import settings

app = FastAPI(title="Joyas API", version="1.0.0")

# Configurar logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Configurar directorio de uploads
UPLOAD_DIR = Path(__file__).parent / "uploads" / "images"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Montar StaticFiles para servir imágenes
app.mount("/uploads/images", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads-images")

# Configurar CORS desde variables de entorno
cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
]
if settings.cors_origins:
    # Agregar origins desde variable de entorno (separados por comas)
    # Filtrar strings vacíos y hacer trim
    env_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    cors_origins.extend(env_origins)

# Eliminar duplicados manteniendo el orden
cors_origins = list(dict.fromkeys(cors_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== AUTH ==========
@app.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = authenticate_user(db, credentials.username, credentials.password)
        if not user:
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
        access_token = create_access_token(data={"sub": user.username})
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        # Re-lanzar HTTPException (401, etc.) sin logging
        raise
    except Exception as e:
        # Loggear error interno sin exponer datos sensibles
        error_type = type(e).__name__
        error_message = str(e)
        # No loggear password ni token
        logger.error(
            f"Error en /auth/login - Tipo: {error_type}, Mensaje: {error_message[:200]}",
            exc_info=True
        )
        # Responder 500 genérico sin exponer detalles
        raise HTTPException(
            status_code=500,
            detail="Error interno del servidor. Por favor, intenta nuevamente."
        )


@app.post("/auth/register")
async def register(credentials: LoginRequest, db: Session = Depends(get_db)):
    existing = db.query(AppUser).filter(AppUser.username == credentials.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    hashed = get_password_hash(credentials.password)
    user = AppUser(username=credentials.username, password_hash=hashed)
    db.add(user)
    db.commit()
    return {"message": "Usuario creado exitosamente"}


# ========== CUSTOMERS ==========
@app.post("/customers", response_model=CustomerResponse)
async def create_customer(
    customer: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    db_customer = Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


@app.get("/customers", response_model=PaginatedResponse)
async def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    query = db.query(Customer)
    if search:
        query = query.filter(Customer.full_name.ilike(f"%{search}%"))
    
    total = query.count()
    items = query.order_by(Customer.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return PaginatedResponse(
        items=[CustomerResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@app.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return customer


# ========== SALES ==========
@app.post("/sales", response_model=SaleResponse)
async def create_sale(
    sale: SaleCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    # Verificar que el cliente existe
    customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    sale_data = sale.model_dump(exclude={"items"})
    if not sale_data.get("purchase_date"):
        sale_data["purchase_date"] = date.today()
    
    db_sale = Sale(**sale_data)
    db.add(db_sale)
    db.flush()
    
    for item_data in sale.items:
        db_item = SaleItem(sale_id=db_sale.id, **item_data.model_dump())
        db.add(db_item)
    
    db.commit()
    db.refresh(db_sale)
    return db_sale


@app.get("/sales", response_model=PaginatedResponse)
async def list_sales(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, description="PAGADO|PARCIAL|PENDIENTE"),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    # Query base de ventas
    query = db.query(Sale)
    
    if customer_id:
        query = query.filter(Sale.customer_id == customer_id)
    
    total = query.count()
    sales = query.order_by(Sale.purchase_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    # Si hay filtro de estado, necesitamos usar la vista
    if status_filter:
        # Obtener IDs de ventas con el estado deseado
        stmt = text("""
            SELECT sale_id FROM joyas.v_sale_statement
            WHERE account_status = :status_filter
        """)
        result = db.execute(stmt, {"status_filter": status_filter})
        sale_ids = [row[0] for row in result]
        
        if sale_ids:
            query = db.query(Sale).filter(Sale.id.in_(sale_ids))
            if customer_id:
                query = query.filter(Sale.customer_id == customer_id)
            total = query.count()
            sales = query.order_by(Sale.purchase_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
        else:
            sales = []
            total = 0
    
    items = [SaleResponse.model_validate(sale) for sale in sales]
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@app.get("/sales/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale


@app.get("/sales/{sale_id}/statement", response_model=SaleStatementResponse)
async def get_sale_statement(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    stmt = text("""
        SELECT sale_id, customer_id, purchase_date, payment_due_date,
               delivery_date, delivery_address, sale_total, paid_total, remaining, account_status
        FROM joyas.v_sale_statement
        WHERE sale_id = :sale_id
    """)
    result = db.execute(stmt, {"sale_id": sale_id}).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    return SaleStatementResponse(
        sale_id=result.sale_id,
        customer_id=result.customer_id,
        purchase_date=result.purchase_date,
        payment_due_date=result.payment_due_date,
        delivery_date=result.delivery_date,
        delivery_address=result.delivery_address,
        sale_total=result.sale_total,
        paid_total=result.paid_total,
        remaining=result.remaining,
        account_status=result.account_status
    )


@app.get("/sales/{sale_id}/items", response_model=list[SaleItemResponse])
async def get_sale_items(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    items = db.query(SaleItem).filter(SaleItem.sale_id == sale_id).all()
    return items


# ========== PAYMENTS ==========
@app.post("/payments", response_model=PaymentResponse)
async def create_payment(
    payment: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    # Verificar que la venta existe
    sale = db.query(Sale).filter(Sale.id == payment.sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    payment_data = payment.model_dump()
    if not payment_data.get("paid_at"):
        payment_data["paid_at"] = datetime.utcnow()
    
    db_payment = Payment(**payment_data)
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


@app.get("/payments", response_model=PaginatedResponse)
async def list_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sale_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    query = db.query(Payment)
    if sale_id:
        query = query.filter(Payment.sale_id == sale_id)
    
    total = query.count()
    items = query.order_by(Payment.paid_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return PaginatedResponse(
        items=[PaymentResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


# ========== DASHBOARD / KPIs ==========
async def _get_kpis_internal(db: Session):
    """Función interna para obtener KPIs"""
    # Leer de v_kpis
    stmt_kpis = text("""
        SELECT 
            total_joyas_vendidas,
            total_ya_pagado,
            dinero_faltante
        FROM joyas.v_kpis
    """)
    result_kpis = db.execute(stmt_kpis).first()
    
    # Leer de v_profit_kpis
    stmt_profit = text("""
        SELECT 
            total_vendido,
            dinero_a_entregar,
            ganancia_40
        FROM joyas.v_profit_kpis
    """)
    result_profit = db.execute(stmt_profit).first()
    
    if not result_kpis:
        return KPIsResponse(
            total_joyas_vendidas=0,
            total_ya_pagado=Decimal("0"),
            dinero_faltante=Decimal("0"),
            total_vendido=Decimal("0"),
            dinero_a_entregar=Decimal("0"),
            ganancia_40=Decimal("0")
        )
    
    return KPIsResponse(
        total_joyas_vendidas=result_kpis.total_joyas_vendidas or 0,
        total_ya_pagado=result_kpis.total_ya_pagado or Decimal("0"),
        dinero_faltante=result_kpis.dinero_faltante or Decimal("0"),
        total_vendido=result_profit.total_vendido or Decimal("0") if result_profit else Decimal("0"),
        dinero_a_entregar=result_profit.dinero_a_entregar or Decimal("0") if result_profit else Decimal("0"),
        ganancia_40=result_profit.ganancia_40 or Decimal("0") if result_profit else Decimal("0")
    )


@app.get("/kpis", response_model=KPIsResponse)
async def get_kpis_simple(
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """Endpoint simplificado para KPIs (alias de /dashboard/kpis)"""
    return await _get_kpis_internal(db)


@app.get("/dashboard/kpis", response_model=KPIsResponse)
async def get_kpis(
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """Endpoint completo para KPIs"""
    return await _get_kpis_internal(db)


@app.get("/dashboard/sales-statements", response_model=PaginatedResponse)
async def get_sales_statements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    base_query = """
        FROM joyas.v_sales_active s
        LEFT JOIN joyas.customer c ON c.id = s.customer_id
        WHERE 1=1
    """
    params = {}
    conditions = []
    
    if status_filter:
        conditions.append("s.account_status = :status_filter")
        params["status_filter"] = status_filter
    
    if search:
        conditions.append("c.full_name ILIKE :search")
        params["search"] = f"%{search}%"
    
    where_clause = " AND " + " AND ".join(conditions) if conditions else ""
    
    # Contar total
    count_sql = f"SELECT COUNT(*) {base_query}{where_clause}"
    total = db.execute(text(count_sql), params).scalar() or 0
    
    # Obtener datos paginados
    query_sql = f"""
        SELECT s.sale_id, s.customer_id, s.purchase_date, s.payment_due_date,
               s.delivery_date, s.delivery_address, s.sale_total, s.paid_total, s.remaining, s.account_status,
               c.full_name as customer_name
        {base_query}{where_clause}
        ORDER BY s.purchase_date DESC
        LIMIT :limit OFFSET :offset
    """
    params["limit"] = page_size
    params["offset"] = (page - 1) * page_size
    
    results = db.execute(text(query_sql), params).fetchall()
    
    items = []
    for row in results:
        items.append({
            "sale_id": row.sale_id,
            "customer_id": row.customer_id,
            "customer_name": row.customer_name,
            "purchase_date": row.purchase_date,
            "payment_due_date": row.payment_due_date,
            "delivery_date": row.delivery_date,
            "delivery_address": row.delivery_address,
            "sale_total": float(row.sale_total),
            "paid_total": float(row.paid_total),
            "remaining": float(row.remaining),
            "account_status": row.account_status
        })
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@app.post("/upload/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Sube una imagen y devuelve la URL.
    Valida: jpg/png/webp, máximo 5MB.
    """
    # Validar content-type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Solo: {', '.join(allowed_types)}"
        )
    
    # Leer contenido para validar tamaño
    contents = await file.read()
    file_size_mb = len(contents) / (1024 * 1024)
    
    if file_size_mb > 5:
        raise HTTPException(
            status_code=400,
            detail="El archivo excede el límite de 5MB"
        )
    
    # Generar nombre único con UUID
    file_ext = ""
    if file.content_type == "image/jpeg":
        file_ext = ".jpg"
    elif file.content_type == "image/png":
        file_ext = ".png"
    elif file.content_type == "image/webp":
        file_ext = ".webp"
    
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    # Guardar archivo
    try:
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al guardar el archivo: {str(e)}"
        )
    
    # Devolver URL relativa
    return {"url": f"/uploads/images/{filename}"}


@app.get("/history/monthly", response_model=list[HistoryMonthCustomerResponse])
async def get_history_monthly(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Obtiene historial mensual por cliente.
    Si no se especifican year y month, devuelve los últimos 12 meses.
    """
    params = {}
    conditions = []
    
    if year and month:
        # Filtrar por año y mes específicos
        conditions.append("EXTRACT(YEAR FROM month) = :year")
        conditions.append("EXTRACT(MONTH FROM month) = :month")
        params["year"] = year
        params["month"] = month
    elif year:
        # Filtrar solo por año
        conditions.append("EXTRACT(YEAR FROM month) = :year")
        params["year"] = year
    else:
        # Últimos 12 meses
        conditions.append("month >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '12 months'")
    
    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
    
    query_sql = f"""
        SELECT month, customer_id, customer_name, sales_count, total_vendido, ganancia_40
        FROM joyas.v_history_month_customer
        {where_clause}
        ORDER BY month DESC, total_vendido DESC
    """
    
    results = db.execute(text(query_sql), params).fetchall()
    
    items = []
    for row in results:
        items.append(HistoryMonthCustomerResponse(
            month=row.month,
            customer_id=row.customer_id,
            customer_name=row.customer_name,
            sales_count=row.sales_count,
            total_vendido=f"{row.total_vendido:.2f}",
            ganancia_40=f"{row.ganancia_40:.2f}"
        ))
    
    return items


@app.get("/favicon.ico")
async def favicon():
    """Endpoint para evitar 404 en logs del navegador"""
    return Response(status_code=204)


@app.get("/health")
async def health():
    """Healthcheck endpoint para monitoreo"""
    return {"status": "ok"}


@app.get("/health/db")
async def health_db():
    """Healthcheck de base de datos (sin exponer credenciales)"""
    try:
        from database import engine
        # Intentar conectar a la base de datos
        with engine.connect() as conn:
            # Ejecutar una query simple para verificar conexión
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        # Loggear error sin exponer credenciales
        logger.error(f"Error de conexión a DB - Tipo: {type(e).__name__}", exc_info=False)
        return {"status": "error"}


@app.get("/health/cors")
async def health_cors():
    """Endpoint de diagnóstico para CORS"""
    import os
    return {
        "status": "ok",
        "cors_origins_loaded": cors_origins,
        "cors_origins_count": len(cors_origins),
        "frontend_origin_expected": "https://joyas-pwa.marcosbenitez7200.workers.dev",
        "frontend_in_cors_list": "https://joyas-pwa.marcosbenitez7200.workers.dev" in cors_origins,
        "cors_origins_from_env": settings.cors_origins if settings.cors_origins else None,
        "cors_origins_from_os_env": os.getenv("CORS_ORIGINS", None),
        "settings_source": "pydantic-settings (prioridad: OS env > .env file)"
    }


@app.get("/")
async def root():
    return {"message": "Joyas API", "version": "1.0.0"}

