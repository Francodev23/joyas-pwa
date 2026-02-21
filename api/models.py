from sqlalchemy import Column, BigInteger, String, Text, Integer, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class AppUser(Base):
    __tablename__ = "app_user"
    __table_args__ = {"schema": "joyas"}

    id = Column(BigInteger, primary_key=True)
    username = Column(String(60), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Customer(Base):
    __tablename__ = "customer"
    __table_args__ = {"schema": "joyas"}

    id = Column(BigInteger, primary_key=True)
    full_name = Column(String(120), nullable=False)
    phone = Column(String(30))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Sale(Base):
    __tablename__ = "sale"
    __table_args__ = {"schema": "joyas"}

    id = Column(BigInteger, primary_key=True)
    customer_id = Column(BigInteger, ForeignKey("joyas.customer.id"), nullable=False)
    purchase_date = Column(Date, server_default=func.current_date(), nullable=False)
    payment_due_date = Column(Date)
    delivery_date = Column(Date)
    delivery_address = Column(Text, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    customer = relationship("Customer")


class SaleItem(Base):
    __tablename__ = "sale_item"
    __table_args__ = {"schema": "joyas"}

    id = Column(BigInteger, primary_key=True)
    sale_id = Column(BigInteger, ForeignKey("joyas.sale.id", ondelete="CASCADE"), nullable=False)
    product_code = Column(String(50))
    jewel_type = Column(String(80), nullable=False)
    quantity = Column(Integer, server_default="1", nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    photo_url = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sale = relationship("Sale")


class Payment(Base):
    __tablename__ = "payment"
    __table_args__ = {"schema": "joyas"}

    id = Column(BigInteger, primary_key=True)
    sale_id = Column(BigInteger, ForeignKey("joyas.sale.id", ondelete="CASCADE"), nullable=False)
    paid_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sale = relationship("Sale")

