from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


# Auth
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Customer
class CustomerCreate(BaseModel):
    full_name: str
    phone: Optional[str] = None


class CustomerResponse(BaseModel):
    id: int
    full_name: str
    phone: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Sale Item
class SaleItemCreate(BaseModel):
    product_code: Optional[str] = None
    jewel_type: str
    quantity: int = Field(gt=0, description="Cantidad debe ser un entero mayor a 0")
    unit_price: Decimal = Field(gt=0, description="Precio unitario debe ser mayor a 0")
    photo_url: Optional[str] = None

    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        """Validar que quantity sea entero positivo"""
        if not isinstance(v, int):
            raise ValueError('Cantidad debe ser un número entero')
        if v <= 0:
            raise ValueError('Cantidad debe ser mayor a 0')
        return v

    @field_validator('unit_price')
    @classmethod
    def validate_unit_price(cls, v: Decimal) -> Decimal:
        """Validar que unit_price sea positivo"""
        if not isinstance(v, (Decimal, int, float)):
            raise ValueError('Precio unitario debe ser un número')
        if v <= 0:
            raise ValueError('Precio unitario debe ser mayor a 0')
        return Decimal(str(v))


class SaleItemResponse(BaseModel):
    id: int
    sale_id: int
    product_code: Optional[str]
    jewel_type: str
    quantity: int
    unit_price: Decimal
    photo_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Sale
class SaleCreate(BaseModel):
    customer_id: int
    purchase_date: Optional[date] = None
    payment_due_date: Optional[date] = None
    delivery_date: Optional[date] = None
    delivery_address: str
    notes: Optional[str] = None
    items: list[SaleItemCreate]


class SaleResponse(BaseModel):
    id: int
    customer_id: int
    purchase_date: date
    payment_due_date: Optional[date]
    delivery_date: Optional[date]
    delivery_address: str
    notes: Optional[str]
    created_at: datetime
    customer: Optional[CustomerResponse] = None

    class Config:
        from_attributes = True


# Payment
class PaymentCreate(BaseModel):
    sale_id: int
    amount: Decimal
    paid_at: Optional[datetime] = None


class PaymentResponse(BaseModel):
    id: int
    sale_id: int
    paid_at: datetime
    amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


# Sale Statement (from view)
class SaleStatementResponse(BaseModel):
    sale_id: int
    customer_id: int
    purchase_date: date
    payment_due_date: Optional[date]
    delivery_date: Optional[date]
    delivery_address: str
    sale_total: Decimal
    paid_total: Decimal
    remaining: Decimal
    account_status: str


# KPIs
class KPIsResponse(BaseModel):
    total_joyas_vendidas: int
    total_ya_pagado: Decimal
    dinero_faltante: Decimal
    total_vendido: Decimal
    dinero_a_entregar: Decimal
    ganancia_40: Decimal


# History Monthly
class HistoryMonthCustomerResponse(BaseModel):
    month: date
    customer_id: int
    customer_name: Optional[str]
    sales_count: int
    total_vendido: str
    ganancia_40: str


# Pagination
class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int

