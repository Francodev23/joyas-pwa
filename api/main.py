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
from models import AppUser, Customer, Sale, SaleItem, Payment, Closing, ClosingSale
from schemas import (
    LoginRequest, TokenResponse,
    CustomerCreate, CustomerResponse,
    SaleCreate, SaleResponse, SaleUpdate, SaleDetailResponse, SaleItemCreate, SaleItemResponse,
    PaymentCreate, PaymentResponse,
    SaleStatementResponse, KPIsResponse,
    DashboardSummaryResponse,
    HistoryMonthCustomerResponse,
    ClosingCreate, ClosingPreviewResponse, ClosingResponse,
    ClosingSalePreviewResponse, ClosingSummaryResponse,
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
    """
    Endpoint de login. Maneja errores de forma segura sin exponer información sensible.
    """
    try:
        # Validar que las credenciales no estén vacías
        if not credentials.username or not credentials.password:
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
        
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
        # No loggear password, username ni token
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
    
    # Validar items antes de crear la venta (validación defensiva adicional)
    if not sale.items or len(sale.items) == 0:
        raise HTTPException(status_code=422, detail="La venta debe tener al menos un item")
    
    for idx, item in enumerate(sale.items):
        # Validación defensiva de cantidad
        if not isinstance(item.quantity, int):
            raise HTTPException(
                status_code=422, 
                detail=f"Item {idx + 1}: Cantidad debe ser un número entero"
            )
        if item.quantity <= 0:
            raise HTTPException(
                status_code=422, 
                detail=f"Item {idx + 1}: Cantidad debe ser mayor a 0"
            )
        
        # Validación defensiva de precio unitario
        if not isinstance(item.unit_price, (Decimal, int, float)):
            raise HTTPException(
                status_code=422, 
                detail=f"Item {idx + 1}: Precio unitario debe ser un número válido"
            )
        try:
            unit_price_decimal = Decimal(str(item.unit_price))
            if unit_price_decimal <= 0:
                raise HTTPException(
                    status_code=422, 
                    detail=f"Item {idx + 1}: Precio unitario debe ser mayor a 0"
                )
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status_code=422, 
                detail=f"Item {idx + 1}: Precio unitario inválido: {str(e)}"
            )
    
    sale_data = sale.model_dump(exclude={"items"})
    if not sale_data.get("purchase_date"):
        sale_data["purchase_date"] = date.today()
    
    db_sale = Sale(**sale_data)
    db.add(db_sale)
    db.flush()
    
    for item_data in sale.items:
        # Asegurar que los valores sean correctos antes de guardar
        item_dict = item_data.model_dump()
        item_dict['quantity'] = int(item_dict['quantity'])
        item_dict['unit_price'] = Decimal(str(item_dict['unit_price']))
        db_item = SaleItem(sale_id=db_sale.id, **item_dict)
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


@app.get("/sales/{sale_id}/detail", response_model=SaleDetailResponse)
async def get_sale_detail(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    statement_result = db.execute(text("""
        SELECT sale_id, customer_id, purchase_date, payment_due_date,
               delivery_date, delivery_address, sale_total, paid_total, remaining, account_status
        FROM joyas.v_sale_statement
        WHERE sale_id = :sale_id
    """), {"sale_id": sale_id}).first()
    if not statement_result:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    items = db.query(SaleItem).filter(SaleItem.sale_id == sale_id).all()
    payments = (
        db.query(Payment)
        .filter(Payment.sale_id == sale_id)
        .order_by(Payment.paid_at.desc())
        .all()
    )

    statement = SaleStatementResponse(
        sale_id=statement_result.sale_id,
        customer_id=statement_result.customer_id,
        purchase_date=statement_result.purchase_date,
        payment_due_date=statement_result.payment_due_date,
        delivery_date=statement_result.delivery_date,
        delivery_address=statement_result.delivery_address,
        sale_total=statement_result.sale_total,
        paid_total=statement_result.paid_total,
        remaining=statement_result.remaining,
        account_status=statement_result.account_status
    )

    return SaleDetailResponse(
        sale=SaleResponse.model_validate(sale),
        statement=statement,
        items=[SaleItemResponse.model_validate(item) for item in items],
        payments=[PaymentResponse.model_validate(payment) for payment in payments]
    )


@app.put("/sales/{sale_id}", response_model=SaleResponse)
async def update_sale(
    sale_id: int,
    sale_update: SaleUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """Actualizar una venta existente"""
    # Verificar que la venta existe
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    # Iniciar transacción
    try:
        # Actualizar datos generales de la venta
        update_data = sale_update.model_dump(exclude={"items"}, exclude_none=True)
        for field, value in update_data.items():
            setattr(sale, field, value)
        
        # Si se proporcionan items, actualizar items
        if sale_update.items is not None:
            # Validar items antes de actualizar
            if len(sale_update.items) == 0:
                raise HTTPException(status_code=422, detail="La venta debe tener al menos un item")
            
            for idx, item in enumerate(sale_update.items):
                # Validación defensiva de cantidad
                if not isinstance(item.quantity, int):
                    raise HTTPException(
                        status_code=422,
                        detail=f"Item {idx + 1}: Cantidad debe ser un número entero"
                    )
                if item.quantity <= 0:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Item {idx + 1}: Cantidad debe ser mayor a 0"
                    )
                
                # Validación defensiva de precio unitario
                if not isinstance(item.unit_price, (Decimal, int, float)):
                    raise HTTPException(
                        status_code=422,
                        detail=f"Item {idx + 1}: Precio unitario debe ser un número válido"
                    )
                try:
                    unit_price_decimal = Decimal(str(item.unit_price))
                    if unit_price_decimal <= 0:
                        raise HTTPException(
                            status_code=422,
                            detail=f"Item {idx + 1}: Precio unitario debe ser mayor a 0"
                        )
                except (ValueError, TypeError) as e:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Item {idx + 1}: Precio unitario inválido: {str(e)}"
                    )
            
            # Eliminar items existentes
            db.query(SaleItem).filter(SaleItem.sale_id == sale_id).delete()
            
            # Crear nuevos items
            for item_data in sale_update.items:
                item_dict = item_data.model_dump()
                item_dict['quantity'] = int(item_dict['quantity'])
                item_dict['unit_price'] = Decimal(str(item_dict['unit_price']))
                db_item = SaleItem(sale_id=sale_id, **item_dict)
                db.add(db_item)
        
        db.commit()
        db.refresh(sale)
        return sale
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al actualizar venta {sale_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al actualizar la venta")


@app.delete("/sales/{sale_id}")
async def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """Eliminar una venta de forma permanente"""
    # Verificar que la venta existe
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    # Iniciar transacción para eliminar en cascada
    try:
        # Eliminar pagos relacionados (si existen)
        from models import Payment
        db.query(Payment).filter(Payment.sale_id == sale_id).delete()
        
        # Eliminar items relacionados (si existen)
        db.query(SaleItem).filter(SaleItem.sale_id == sale_id).delete()
        
        # Eliminar la venta
        db.delete(sale)
        
        db.commit()
        return {"message": "Venta eliminada correctamente"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error al eliminar venta {sale_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al eliminar la venta")


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
    stmt = text("""
        WITH open_sales AS (
            SELECT ss.sale_id, ss.sale_total, ss.paid_total, ss.remaining
            FROM joyas.v_sale_statement ss
            LEFT JOIN joyas.closing_sale cs ON cs.sale_id = ss.sale_id
            WHERE cs.sale_id IS NULL
        ),
        open_items AS (
            SELECT si.quantity, si.unit_price
            FROM joyas.sale_item si
            JOIN open_sales os ON os.sale_id = si.sale_id
        )
        SELECT
            COALESCE((SELECT SUM(quantity) FROM open_items), 0)::integer AS total_joyas_vendidas,
            COALESCE((SELECT SUM(paid_total) FROM open_sales), 0)::numeric(12,2) AS total_ya_pagado,
            COALESCE((SELECT SUM(remaining) FROM open_sales), 0)::numeric(12,2) AS dinero_faltante,
            COALESCE((SELECT SUM(quantity::numeric * unit_price) FROM open_items), 0)::numeric(12,2) AS total_vendido
    """)
    result = db.execute(stmt).first()

    if not result:
        return KPIsResponse(
            total_joyas_vendidas=0,
            total_ya_pagado=Decimal("0"),
            dinero_faltante=Decimal("0"),
            total_vendido=Decimal("0"),
            dinero_a_entregar=Decimal("0"),
            ganancia_40=Decimal("0")
        )
    total_vendido = result.total_vendido or Decimal("0")

    return KPIsResponse(
        total_joyas_vendidas=result.total_joyas_vendidas or 0,
        total_ya_pagado=result.total_ya_pagado or Decimal("0"),
        dinero_faltante=result.dinero_faltante or Decimal("0"),
        total_vendido=total_vendido,
        dinero_a_entregar=(total_vendido * Decimal("0.60")).quantize(Decimal("0.01")),
        ganancia_40=(total_vendido * Decimal("0.40")).quantize(Decimal("0.01"))
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


def _get_sales_statements_page(
    db: Session,
    page: int,
    page_size: int,
    status_filter: Optional[str] = None,
    search: Optional[str] = None
):
    """Ventas abiertas para dashboard, excluyendo las ya procesadas en cierres."""
    base_query = """
        FROM joyas.v_sales_active s
        LEFT JOIN joyas.customer c ON c.id = s.customer_id
        LEFT JOIN joyas.closing_sale cs ON cs.sale_id = s.sale_id
        LEFT JOIN (
            SELECT sale_id, SUM(quantity)::integer AS total_items
            FROM joyas.sale_item
            GROUP BY sale_id
        ) items ON items.sale_id = s.sale_id
        WHERE cs.sale_id IS NULL
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

    count_sql = f"SELECT COUNT(*) {base_query}{where_clause}"
    total = db.execute(text(count_sql), params).scalar() or 0

    query_sql = f"""
        SELECT s.sale_id, s.customer_id, s.purchase_date, s.payment_due_date,
               s.delivery_date, s.delivery_address, s.sale_total, s.paid_total, s.remaining, s.account_status,
               c.full_name as customer_name,
               COALESCE(items.total_items, 0)::integer AS total_items
        {base_query}{where_clause}
        ORDER BY s.purchase_date DESC, s.sale_id DESC
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
            "account_status": row.account_status,
            "total_items": row.total_items
        })

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@app.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    return DashboardSummaryResponse(
        kpis=await _get_kpis_internal(db),
        sales=_get_sales_statements_page(db, page, page_size, status_filter, search)
    )


@app.get("/dashboard/sales-statements", response_model=PaginatedResponse)
async def get_sales_statements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    return _get_sales_statements_page(db, page, page_size, status_filter, search)


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


def _closing_sales_query(db: Session, period_start: date, period_end: date):
    return text("""
        SELECT
            ss.sale_id,
            ss.customer_id,
            c.full_name AS customer_name,
            ss.purchase_date,
            ss.sale_total,
            ss.paid_total,
            ss.remaining,
            ss.account_status,
            COALESCE(items.total_items, 0)::integer AS total_items
        FROM joyas.v_sale_statement ss
        JOIN joyas.customer c ON c.id = ss.customer_id
        LEFT JOIN (
            SELECT sale_id, SUM(quantity)::integer AS total_items
            FROM joyas.sale_item
            GROUP BY sale_id
        ) items ON items.sale_id = ss.sale_id
        LEFT JOIN joyas.closing_sale cs ON cs.sale_id = ss.sale_id
        WHERE ss.purchase_date BETWEEN :period_start AND :period_end
          AND ss.remaining <= 0
          AND cs.sale_id IS NULL
        ORDER BY ss.purchase_date ASC, ss.sale_id ASC
    """)


def _build_closing_preview(db: Session, period_start: date, period_end: date):
    if period_end < period_start:
        raise HTTPException(status_code=422, detail="La fecha final no puede ser anterior a la inicial")

    rows = db.execute(
        _closing_sales_query(db, period_start, period_end),
        {"period_start": period_start, "period_end": period_end}
    ).fetchall()

    sales = [
        ClosingSalePreviewResponse(
            sale_id=row.sale_id,
            customer_id=row.customer_id,
            customer_name=row.customer_name,
            purchase_date=row.purchase_date,
            sale_total=row.sale_total,
            paid_total=row.paid_total,
            remaining=row.remaining,
            total_items=row.total_items,
            account_status=row.account_status
        )
        for row in rows
    ]

    total_sales = sum((sale.sale_total for sale in sales), Decimal("0"))
    total_paid = sum((sale.paid_total for sale in sales), Decimal("0"))
    total_remaining = sum((sale.remaining for sale in sales), Decimal("0"))
    total_items = sum((sale.total_items for sale in sales), 0)

    summary = ClosingSummaryResponse(
        period_start=period_start,
        period_end=period_end,
        sales_count=len(sales),
        total_sales=total_sales,
        total_paid=total_paid,
        total_remaining=total_remaining,
        total_items=total_items,
        money_to_deliver=(total_sales * Decimal("0.60")).quantize(Decimal("0.01")),
        profit_40=(total_sales * Decimal("0.40")).quantize(Decimal("0.01"))
    )
    return ClosingPreviewResponse(summary=summary, sales=sales)


@app.get("/closings/preview", response_model=ClosingPreviewResponse)
async def preview_closing(
    period_start: date = Query(...),
    period_end: date = Query(...),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    return _build_closing_preview(db, period_start, period_end)


@app.post("/closings", response_model=ClosingResponse)
async def create_closing(
    closing_data: ClosingCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    preview = _build_closing_preview(db, closing_data.period_start, closing_data.period_end)
    if preview.summary.sales_count == 0:
        raise HTTPException(status_code=422, detail="No hay ventas pagadas sin cerrar en este rango")

    try:
        closing = Closing(
            period_start=closing_data.period_start,
            period_end=closing_data.period_end,
            notes=closing_data.notes,
            total_sales=preview.summary.total_sales,
            total_paid=preview.summary.total_paid,
            total_remaining=preview.summary.total_remaining,
            total_items=preview.summary.total_items,
            money_to_deliver=preview.summary.money_to_deliver,
            profit_40=preview.summary.profit_40
        )
        db.add(closing)
        db.flush()

        for sale in preview.sales:
            db.add(ClosingSale(closing_id=closing.id, sale_id=sale.sale_id))

        db.commit()
        db.refresh(closing)
        return ClosingResponse(
            id=closing.id,
            period_start=closing.period_start,
            period_end=closing.period_end,
            closed_at=closing.closed_at,
            notes=closing.notes,
            sales_count=preview.summary.sales_count,
            total_sales=closing.total_sales,
            total_paid=closing.total_paid,
            total_remaining=closing.total_remaining,
            total_items=closing.total_items,
            money_to_deliver=closing.money_to_deliver,
            profit_40=closing.profit_40
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al crear cierre - Tipo: {type(e).__name__}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al crear el cierre")


@app.get("/closings", response_model=PaginatedResponse)
async def list_closings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    total = db.query(Closing).count()
    closings = (
        db.query(Closing)
        .order_by(Closing.closed_at.desc(), Closing.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    sale_counts = dict(
        db.query(ClosingSale.closing_id, func.count(ClosingSale.sale_id))
        .filter(ClosingSale.closing_id.in_([closing.id for closing in closings] or [0]))
        .group_by(ClosingSale.closing_id)
        .all()
    )

    items = [
        ClosingResponse(
            id=closing.id,
            period_start=closing.period_start,
            period_end=closing.period_end,
            closed_at=closing.closed_at,
            notes=closing.notes,
            sales_count=sale_counts.get(closing.id, 0),
            total_sales=closing.total_sales,
            total_paid=closing.total_paid,
            total_remaining=closing.total_remaining,
            total_items=closing.total_items,
            money_to_deliver=closing.money_to_deliver,
            profit_40=closing.profit_40
        )
        for closing in closings
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@app.get("/closings/{closing_id}", response_model=ClosingPreviewResponse)
async def get_closing_detail(
    closing_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    closing = db.query(Closing).filter(Closing.id == closing_id).first()
    if not closing:
        raise HTTPException(status_code=404, detail="Cierre no encontrado")

    rows = db.execute(text("""
        SELECT
            ss.sale_id,
            ss.customer_id,
            c.full_name AS customer_name,
            ss.purchase_date,
            ss.sale_total,
            ss.paid_total,
            ss.remaining,
            ss.account_status,
            COALESCE(items.total_items, 0)::integer AS total_items
        FROM joyas.closing_sale cs
        JOIN joyas.v_sale_statement ss ON ss.sale_id = cs.sale_id
        JOIN joyas.customer c ON c.id = ss.customer_id
        LEFT JOIN (
            SELECT sale_id, SUM(quantity)::integer AS total_items
            FROM joyas.sale_item
            GROUP BY sale_id
        ) items ON items.sale_id = ss.sale_id
        WHERE cs.closing_id = :closing_id
        ORDER BY ss.purchase_date ASC, ss.sale_id ASC
    """), {"closing_id": closing_id}).fetchall()

    sales = [
        ClosingSalePreviewResponse(
            sale_id=row.sale_id,
            customer_id=row.customer_id,
            customer_name=row.customer_name,
            purchase_date=row.purchase_date,
            sale_total=row.sale_total,
            paid_total=row.paid_total,
            remaining=row.remaining,
            total_items=row.total_items,
            account_status=row.account_status
        )
        for row in rows
    ]
    summary = ClosingSummaryResponse(
        period_start=closing.period_start,
        period_end=closing.period_end,
        sales_count=len(sales),
        total_sales=closing.total_sales,
        total_paid=closing.total_paid,
        total_remaining=closing.total_remaining,
        total_items=closing.total_items,
        money_to_deliver=closing.money_to_deliver,
        profit_40=closing.profit_40
    )
    return ClosingPreviewResponse(summary=summary, sales=sales)


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

