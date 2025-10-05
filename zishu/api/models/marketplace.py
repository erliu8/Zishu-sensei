#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
市场数据模型 - SQLAlchemy ORM模型
提供完整的市场数据库层模型，与Pydantic schemas配合使用
包含商品管理、订单处理、支付系统、评价体系、商家管理等功能
"""

import uuid
import re
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union
from decimal import Decimal
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Integer, Float, 
    ForeignKey, Index, UniqueConstraint, CheckConstraint,
    JSON, Enum as SQLEnum, Table, Numeric
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, backref, validates, Session
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql import func
import hashlib

# 从schemas导入枚举和模型
from ..schemas.marketplace import (
    ProductType, ProductStatus, PricingModel, OrderStatus, PaymentStatus,
    PaymentMethod, ReviewRating, ReviewStatus, VendorType, VendorStatus,
    TransactionType, CurrencyType, CampaignType,
    # 导入Pydantic模型用于转换
    Product as ProductSchema,
    Vendor as VendorSchema,
    Order as OrderSchema,
    Payment as PaymentSchema,
    Review as ReviewSchema,
    Transaction as TransactionSchema,
    Campaign as CampaignSchema
)

# 创建基础类
Base = declarative_base()

# ======================== 关联表定义 ========================

# 商品标签关联表
product_tags_association = Table(
    'product_tags',
    Base.metadata,
    Column('product_id', UUID(as_uuid=True), ForeignKey('products.id'), primary_key=True),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), default=func.now()),
    schema='zishu'
)

# 活动适用商品关联表
campaign_products_association = Table(
    'campaign_products',
    Base.metadata,
    Column('campaign_id', UUID(as_uuid=True), ForeignKey('campaigns.id'), primary_key=True),
    Column('product_id', UUID(as_uuid=True), ForeignKey('products.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), default=func.now()),
    schema='zishu'
)

# 活动适用商家关联表
campaign_vendors_association = Table(
    'campaign_vendors',
    Base.metadata,
    Column('campaign_id', UUID(as_uuid=True), ForeignKey('campaigns.id'), primary_key=True),
    Column('vendor_id', UUID(as_uuid=True), ForeignKey('vendors.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), default=func.now()),
    schema='zishu'
)

# ======================== 主要模型类 ========================

class Product(Base):
    """商品主表"""
    __tablename__ = 'products'
    __table_args__ = (
        Index('idx_products_slug', 'slug'),
        Index('idx_products_vendor_id', 'vendor_id'),
        Index('idx_products_status', 'status'),
        Index('idx_products_type', 'product_type'),
        Index('idx_products_category', 'category'),
        Index('idx_products_created_at', 'created_at'),
        Index('idx_products_published_at', 'published_at'),
        Index('idx_products_featured', 'is_featured'),
        Index('idx_products_verified', 'is_verified'),
        Index('idx_products_rating', 'average_rating'),
        Index('idx_products_downloads', 'download_count'),
        UniqueConstraint('slug', name='uq_products_slug'),
        CheckConstraint('char_length(name) >= 1', name='ck_product_name_length'),
        CheckConstraint('char_length(slug) >= 1', name='ck_product_slug_length'),
        CheckConstraint('download_count >= 0', name='ck_product_download_count'),
        CheckConstraint('purchase_count >= 0', name='ck_product_purchase_count'),
        CheckConstraint('view_count >= 0', name='ck_product_view_count'),
        CheckConstraint('favorite_count >= 0', name='ck_product_favorite_count'),
        CheckConstraint('average_rating >= 0 AND average_rating <= 5', name='ck_product_rating'),
        CheckConstraint('rating_count >= 0', name='ck_product_rating_count'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=False)
    short_description = Column(String(500), nullable=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey('vendors.id'), nullable=False)
    
    # 商品属性
    product_type = Column(SQLEnum(ProductType), nullable=False)
    category = Column(String(100), nullable=False)
    subcategory = Column(String(100), nullable=True)
    status = Column(SQLEnum(ProductStatus), nullable=False, default=ProductStatus.DRAFT)
    
    # 媒体资源
    logo_url = Column(String(500), nullable=True)
    cover_url = Column(String(500), nullable=True)
    screenshots = Column(JSONB, nullable=False, default=list)
    video_url = Column(String(500), nullable=True)
    demo_url = Column(String(500), nullable=True)
    
    # 技术信息
    version = Column(String(50), nullable=False)
    compatibility = Column(JSONB, nullable=False, default=dict)
    requirements = Column(JSONB, nullable=False, default=list)
    file_size = Column(Integer, nullable=True, default=0)
    
    # 定价信息 - 存储为JSONB以支持复杂定价结构
    pricing_info = Column(JSONB, nullable=False)
    
    # 统计信息
    download_count = Column(Integer, nullable=False, default=0)
    purchase_count = Column(Integer, nullable=False, default=0)
    view_count = Column(Integer, nullable=False, default=0)
    favorite_count = Column(Integer, nullable=False, default=0)
    
    # 评分信息
    average_rating = Column(Float, nullable=False, default=0.0)
    rating_count = Column(Integer, nullable=False, default=0)
    
    # 状态标记
    is_featured = Column(Boolean, nullable=False, default=False)
    is_verified = Column(Boolean, nullable=False, default=False)
    is_recommended = Column(Boolean, nullable=False, default=False)
    
    # SEO和元数据
    keywords = Column(JSONB, nullable=False, default=list)
    metadata = Column(JSONB, nullable=False, default=dict)
    
    # 时间信息
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    
    # 软删除
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    vendor = relationship("Vendor", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")
    reviews = relationship("Review", back_populates="product", cascade="all, delete-orphan")
    # tags = relationship("Tag", secondary=product_tags_association, back_populates="products")
    campaign_products = relationship("Campaign", secondary=campaign_products_association, back_populates="applicable_products")

    # 验证器
    @validates('name')
    def validate_name(self, key, name):
        """验证商品名称"""
        if not name or len(name.strip()) == 0:
            raise ValueError("商品名称不能为空")
        if len(name) > 200:
            raise ValueError("商品名称不能超过200个字符")
        return name.strip()

    @validates('slug')
    def validate_slug(self, key, slug):
        """验证商品标识符"""
        if not slug or len(slug.strip()) == 0:
            raise ValueError("商品标识符不能为空")
        if not re.match(r'^[a-z0-9\-]+$', slug):
            raise ValueError("商品标识符只能包含小写字母、数字和连字符")
        return slug.strip().lower()

    # 业务方法
    def increment_view(self):
        """增加浏览次数"""
        self.view_count += 1

    def increment_download(self):
        """增加下载次数"""
        self.download_count += 1

    def increment_purchase(self):
        """增加购买次数"""
        self.purchase_count += 1

    def update_rating(self):
        """更新平均评分"""
        if self.reviews:
            published_reviews = [r for r in self.reviews if r.status == ReviewStatus.PUBLISHED]
            if published_reviews:
                total_rating = sum(r.rating.value for r in published_reviews)
                self.average_rating = round(total_rating / len(published_reviews), 2)
                self.rating_count = len(published_reviews)
            else:
                self.average_rating = 0.0
                self.rating_count = 0
        else:
            self.average_rating = 0.0
            self.rating_count = 0

    def publish(self):
        """发布商品"""
        self.status = ProductStatus.PUBLISHED
        self.published_at = func.now()

    def soft_delete(self):
        """软删除商品"""
        self.is_deleted = True
        self.deleted_at = func.now()
        self.status = ProductStatus.DELETED

    def to_schema(self) -> ProductSchema:
        """转换为Pydantic Schema"""
        from ..schemas.marketplace import PricingInfo, MoneyAmount
        
        # 解析定价信息
        pricing_data = self.pricing_info
        pricing = PricingInfo(**pricing_data)
        
        return ProductSchema(
            id=str(self.id),
            name=self.name,
            slug=self.slug,
            description=self.description,
            short_description=self.short_description,
            product_type=self.product_type,
            category=self.category,
            subcategory=self.subcategory,
            # tags=[tag.name for tag in self.tags],
            logo_url=self.logo_url,
            cover_url=self.cover_url,
            screenshots=self.screenshots,
            video_url=self.video_url,
            demo_url=self.demo_url,
            version=self.version,
            compatibility=self.compatibility,
            requirements=self.requirements,
            file_size=self.file_size,
            keywords=self.keywords,
            metadata=self.metadata,
            vendor_id=str(self.vendor_id),
            status=self.status,
            pricing=pricing,
            download_count=self.download_count,
            purchase_count=self.purchase_count,
            view_count=self.view_count,
            favorite_count=self.favorite_count,
            average_rating=self.average_rating,
            rating_count=self.rating_count,
            is_featured=self.is_featured,
            is_verified=self.is_verified,
            is_recommended=self.is_recommended,
            published_at=self.published_at,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    def __repr__(self):
        return f"<Product(id={self.id}, slug='{self.slug}', name='{self.name}')>"


class Vendor(Base):
    """商家主表"""
    __tablename__ = 'vendors'
    __table_args__ = (
        Index('idx_vendors_user_id', 'user_id'),
        Index('idx_vendors_status', 'status'),
        Index('idx_vendors_type', 'vendor_type'),
        Index('idx_vendors_country', 'country'),
        Index('idx_vendors_verified', 'is_verified'),
        Index('idx_vendors_created_at', 'created_at'),
        UniqueConstraint('user_id', name='uq_vendors_user_id'),
        CheckConstraint('char_length(name) >= 2', name='ck_vendor_name_length'),
        CheckConstraint('product_count >= 0', name='ck_vendor_product_count'),
        CheckConstraint('total_orders >= 0', name='ck_vendor_total_orders'),
        CheckConstraint('average_rating >= 0 AND average_rating <= 5', name='ck_vendor_rating'),
        CheckConstraint('rating_count >= 0', name='ck_vendor_rating_count'),
        CheckConstraint('verification_level >= 0 AND verification_level <= 5', name='ck_vendor_verification_level'),
        CheckConstraint('commission_rate >= 0 AND commission_rate <= 1', name='ck_vendor_commission_rate'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, unique=True)
    name = Column(String(200), nullable=False)
    display_name = Column(String(200), nullable=False)
    description = Column(String(2000), nullable=True)
    vendor_type = Column(SQLEnum(VendorType), nullable=False)
    status = Column(SQLEnum(VendorStatus), nullable=False, default=VendorStatus.PENDING)
    
    # 联系信息
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    website = Column(String(500), nullable=True)
    
    # 地址信息
    country = Column(String(100), nullable=False)
    city = Column(String(100), nullable=True)
    address = Column(String(500), nullable=True)
    
    # 媒体资源
    logo_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)
    
    # 社交媒体链接
    social_links = Column(JSONB, nullable=False, default=dict)
    
    # 统计信息
    product_count = Column(Integer, nullable=False, default=0)
    total_sales_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_sales_currency = Column(String(3), nullable=False, default='CNY')
    total_orders = Column(Integer, nullable=False, default=0)
    
    # 评分信息
    average_rating = Column(Float, nullable=False, default=0.0)
    rating_count = Column(Integer, nullable=False, default=0)
    
    # 认证信息
    is_verified = Column(Boolean, nullable=False, default=False)
    verification_level = Column(Integer, nullable=False, default=0)
    
    # 财务信息
    balance_amount = Column(Numeric(12, 2), nullable=False, default=0)
    balance_currency = Column(String(3), nullable=False, default='CNY')
    commission_rate = Column(Float, nullable=False, default=0.1)
    
    # 时间信息
    joined_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    verified_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # 关系
    # user = relationship("User", back_populates="vendor")
    products = relationship("Product", back_populates="vendor", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="vendor")
    campaigns = relationship("Campaign", secondary=campaign_vendors_association, back_populates="applicable_vendors")

    # 验证器
    @validates('email')
    def validate_email(self, key, email):
        """验证邮箱格式"""
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            raise ValueError("邮箱格式不正确")
        return email.lower()

    @validates('phone')
    def validate_phone(self, key, phone):
        """验证电话号码"""
        if phone and not re.match(r'^\+?[\d\s\-\(\)]+$', phone):
            raise ValueError("电话号码格式不正确")
        return phone

    # 业务方法
    def verify(self, level: int = 1):
        """认证商家"""
        self.is_verified = True
        self.verification_level = level
        self.verified_at = func.now()

    def update_product_count(self):
        """更新商品数量"""
        self.product_count = len([p for p in self.products if not p.is_deleted])

    def update_rating(self):
        """更新商家评分"""
        # 这里可以基于商品评分或订单评价来更新商家评分
        if self.products:
            ratings = [p.average_rating for p in self.products if p.average_rating > 0]
            if ratings:
                self.average_rating = round(sum(ratings) / len(ratings), 2)
                self.rating_count = len(ratings)

    def add_balance(self, amount: Decimal, currency: str = 'CNY'):
        """增加余额"""
        if currency == self.balance_currency:
            self.balance_amount += amount
        # 这里可以添加货币转换逻辑

    def deduct_balance(self, amount: Decimal, currency: str = 'CNY') -> bool:
        """扣除余额"""
        if currency == self.balance_currency and self.balance_amount >= amount:
            self.balance_amount -= amount
            return True
        return False

    def to_schema(self) -> VendorSchema:
        """转换为Pydantic Schema"""
        from ..schemas.marketplace import MoneyAmount
        
        return VendorSchema(
            id=str(self.id),
            user_id=str(self.user_id),
            name=self.name,
            display_name=self.display_name,
            description=self.description,
            vendor_type=self.vendor_type,
            status=self.status,
            email=self.email,
            phone=self.phone,
            website=self.website,
            country=self.country,
            city=self.city,
            address=self.address,
            logo_url=self.logo_url,
            banner_url=self.banner_url,
            social_links=self.social_links,
            product_count=self.product_count,
            total_sales=MoneyAmount(amount=self.total_sales_amount, currency=self.total_sales_currency),
            total_orders=self.total_orders,
            average_rating=self.average_rating,
            rating_count=self.rating_count,
            is_verified=self.is_verified,
            verification_level=self.verification_level,
            balance=MoneyAmount(amount=self.balance_amount, currency=self.balance_currency),
            commission_rate=self.commission_rate,
            joined_at=self.joined_at,
            verified_at=self.verified_at,
            last_login_at=self.last_login_at
        )

    def __repr__(self):
        return f"<Vendor(id={self.id}, name='{self.name}', type={self.vendor_type})>"


class Order(Base):
    """订单主表"""
    __tablename__ = 'orders'
    __table_args__ = (
        Index('idx_orders_order_number', 'order_number'),
        Index('idx_orders_buyer_id', 'buyer_id'),
        Index('idx_orders_vendor_id', 'vendor_id'),
        Index('idx_orders_status', 'status'),
        Index('idx_orders_payment_status', 'payment_status'),
        Index('idx_orders_created_at', 'created_at'),
        UniqueConstraint('order_number', name='uq_orders_order_number'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    order_number = Column(String(50), nullable=False, unique=True)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey('vendors.id'), nullable=False)
    status = Column(SQLEnum(OrderStatus), nullable=False, default=OrderStatus.PENDING)
    
    # 金额信息
    subtotal_amount = Column(Numeric(12, 2), nullable=False)
    subtotal_currency = Column(String(3), nullable=False, default='CNY')
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0)
    discount_currency = Column(String(3), nullable=False, default='CNY')
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0)
    tax_currency = Column(String(3), nullable=False, default='CNY')
    total_amount = Column(Numeric(12, 2), nullable=False)
    total_currency = Column(String(3), nullable=False, default='CNY')
    
    # 支付信息
    payment_method = Column(SQLEnum(PaymentMethod), nullable=True)
    payment_status = Column(SQLEnum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    
    # 配送信息
    delivery_method = Column(String(100), nullable=True)
    delivery_address = Column(JSONB, nullable=True)
    
    # 备注信息
    buyer_notes = Column(String(1000), nullable=True)
    vendor_notes = Column(String(1000), nullable=True)
    internal_notes = Column(String(1000), nullable=True)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    # buyer = relationship("User", foreign_keys=[buyer_id])
    vendor = relationship("Vendor", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="order")

    # 业务方法
    def calculate_totals(self):
        """计算订单总额"""
        if self.items:
            self.subtotal_amount = sum(item.price_amount * item.quantity for item in self.items)
            self.total_amount = self.subtotal_amount + self.tax_amount - self.discount_amount

    def mark_paid(self):
        """标记为已支付"""
        self.payment_status = PaymentStatus.SUCCESS
        self.paid_at = func.now()
        if self.status == OrderStatus.PENDING:
            self.status = OrderStatus.PAID

    def mark_delivered(self):
        """标记为已交付"""
        self.status = OrderStatus.DELIVERED
        self.delivered_at = func.now()

    def mark_completed(self):
        """标记为已完成"""
        self.status = OrderStatus.COMPLETED
        self.completed_at = func.now()

    def can_cancel(self) -> bool:
        """检查是否可以取消"""
        return self.status in [OrderStatus.PENDING, OrderStatus.CONFIRMED]

    def can_refund(self) -> bool:
        """检查是否可以退款"""
        return self.payment_status == PaymentStatus.SUCCESS and \
               self.status in [OrderStatus.PAID, OrderStatus.DELIVERED]

    def to_schema(self) -> OrderSchema:
        """转换为Pydantic Schema"""
        from ..schemas.marketplace import MoneyAmount
        
        return OrderSchema(
            id=str(self.id),
            order_number=self.order_number,
            buyer_id=str(self.buyer_id),
            vendor_id=str(self.vendor_id),
            status=self.status,
            items=[item.to_dict() for item in self.items],
            subtotal=MoneyAmount(amount=self.subtotal_amount, currency=self.subtotal_currency),
            discount_amount=MoneyAmount(amount=self.discount_amount, currency=self.discount_currency),
            tax_amount=MoneyAmount(amount=self.tax_amount, currency=self.tax_currency),
            total_amount=MoneyAmount(amount=self.total_amount, currency=self.total_currency),
            payment_method=self.payment_method,
            payment_status=self.payment_status,
            delivery_method=self.delivery_method,
            delivery_address=self.delivery_address,
            buyer_notes=self.buyer_notes,
            vendor_notes=self.vendor_notes,
            internal_notes=self.internal_notes,
            created_at=self.created_at,
            updated_at=self.updated_at,
            paid_at=self.paid_at,
            delivered_at=self.delivered_at,
            completed_at=self.completed_at
        )

    def __repr__(self):
        return f"<Order(id={self.id}, order_number='{self.order_number}', status={self.status})>"


class OrderItem(Base):
    """订单项目表"""
    __tablename__ = 'order_items'
    __table_args__ = (
        Index('idx_order_items_order_id', 'order_id'),
        Index('idx_order_items_product_id', 'product_id'),
        CheckConstraint('quantity > 0', name='ck_order_item_quantity'),
        CheckConstraint('price_amount >= 0', name='ck_order_item_price'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey('orders.id'), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey('products.id'), nullable=False)
    
    # 商品信息快照
    product_name = Column(String(200), nullable=False)
    product_version = Column(String(50), nullable=False)
    product_type = Column(SQLEnum(ProductType), nullable=False)
    
    # 订单项目信息
    quantity = Column(Integer, nullable=False, default=1)
    price_amount = Column(Numeric(12, 2), nullable=False)
    price_currency = Column(String(3), nullable=False, default='CNY')
    
    # 附加信息
    license_info = Column(JSONB, nullable=True)
    metadata = Column(JSONB, nullable=False, default=dict)

    # 关系
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

    def to_dict(self):
        """转换为字典"""
        return {
            "id": str(self.id),
            "product_id": str(self.product_id),
            "product_name": self.product_name,
            "product_version": self.product_version,
            "product_type": self.product_type.value,
            "quantity": self.quantity,
            "price": {
                "amount": float(self.price_amount),
                "currency": self.price_currency
            },
            "license_info": self.license_info,
            "metadata": self.metadata
        }

    def __repr__(self):
        return f"<OrderItem(order_id={self.order_id}, product_id={self.product_id}, quantity={self.quantity})>"


class Payment(Base):
    """支付记录表"""
    __tablename__ = 'payments'
    __table_args__ = (
        Index('idx_payments_order_id', 'order_id'),
        Index('idx_payments_transaction_id', 'transaction_id'),
        Index('idx_payments_status', 'status'),
        Index('idx_payments_method', 'method'),
        Index('idx_payments_created_at', 'created_at'),
        UniqueConstraint('transaction_id', name='uq_payments_transaction_id'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey('orders.id'), nullable=False)
    transaction_id = Column(String(100), nullable=False, unique=True)
    
    # 支付信息
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default='CNY')
    method = Column(SQLEnum(PaymentMethod), nullable=False)
    status = Column(SQLEnum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    
    # 第三方支付信息
    gateway = Column(String(50), nullable=True)
    gateway_transaction_id = Column(String(100), nullable=True)
    gateway_response = Column(JSONB, nullable=False, default=dict)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    order = relationship("Order", back_populates="payments")

    def mark_success(self):
        """标记支付成功"""
        self.status = PaymentStatus.SUCCESS
        self.paid_at = func.now()

    def mark_failed(self):
        """标记支付失败"""
        self.status = PaymentStatus.FAILED
        self.failed_at = func.now()

    def to_schema(self) -> PaymentSchema:
        """转换为Pydantic Schema"""
        from ..schemas.marketplace import MoneyAmount
        
        return PaymentSchema(
            id=str(self.id),
            order_id=str(self.order_id),
            transaction_id=self.transaction_id,
            amount=MoneyAmount(amount=self.amount, currency=self.currency),
            method=self.method,
            status=self.status,
            gateway=self.gateway,
            gateway_transaction_id=self.gateway_transaction_id,
            gateway_response=self.gateway_response,
            created_at=self.created_at,
            paid_at=self.paid_at,
            failed_at=self.failed_at
        )

    def __repr__(self):
        return f"<Payment(id={self.id}, transaction_id='{self.transaction_id}', status={self.status})>"


class Review(Base):
    """商品评价表"""
    __tablename__ = 'reviews'
    __table_args__ = (
        Index('idx_reviews_product_id', 'product_id'),
        Index('idx_reviews_user_id', 'user_id'),
        Index('idx_reviews_order_id', 'order_id'),
        Index('idx_reviews_rating', 'rating'),
        Index('idx_reviews_status', 'status'),
        Index('idx_reviews_created_at', 'created_at'),
        UniqueConstraint('product_id', 'user_id', name='uq_reviews_product_user'),
        CheckConstraint('helpful_count >= 0', name='ck_review_helpful_count'),
        CheckConstraint('reply_count >= 0', name='ck_review_reply_count'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey('products.id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    order_id = Column(UUID(as_uuid=True), ForeignKey('orders.id'), nullable=True)
    
    # 评价内容
    rating = Column(SQLEnum(ReviewRating), nullable=False)
    title = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    
    # 详细评分
    quality_rating = Column(Integer, nullable=True)
    service_rating = Column(Integer, nullable=True)
    value_rating = Column(Integer, nullable=True)
    
    # 媒体附件
    images = Column(JSONB, nullable=False, default=list)
    videos = Column(JSONB, nullable=False, default=list)
    
    # 状态信息
    status = Column(SQLEnum(ReviewStatus), nullable=False, default=ReviewStatus.PENDING)
    is_verified_purchase = Column(Boolean, nullable=False, default=False)
    is_anonymous = Column(Boolean, nullable=False, default=False)
    
    # 互动统计
    helpful_count = Column(Integer, nullable=False, default=0)
    reply_count = Column(Integer, nullable=False, default=0)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # 关系
    product = relationship("Product", back_populates="reviews")
    # user = relationship("User")
    # order = relationship("Order")

    def publish(self):
        """发布评价"""
        self.status = ReviewStatus.PUBLISHED

    def hide(self):
        """隐藏评价"""
        self.status = ReviewStatus.HIDDEN

    def to_schema(self) -> ReviewSchema:
        """转换为Pydantic Schema"""
        return ReviewSchema(
            id=str(self.id),
            product_id=str(self.product_id),
            user_id=str(self.user_id),
            order_id=str(self.order_id) if self.order_id else None,
            rating=self.rating,
            title=self.title,
            content=self.content,
            quality_rating=self.quality_rating,
            service_rating=self.service_rating,
            value_rating=self.value_rating,
            images=self.images,
            videos=self.videos,
            status=self.status,
            is_verified_purchase=self.is_verified_purchase,
            is_anonymous=self.is_anonymous,
            helpful_count=self.helpful_count,
            reply_count=self.reply_count,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    def __repr__(self):
        return f"<Review(id={self.id}, product_id={self.product_id}, rating={self.rating})>"


class Transaction(Base):
    """交易记录表"""
    __tablename__ = 'transactions'
    __table_args__ = (
        Index('idx_transactions_user_id', 'user_id'),
        Index('idx_transactions_order_id', 'order_id'),
        Index('idx_transactions_type', 'transaction_type'),
        Index('idx_transactions_created_at', 'created_at'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    order_id = Column(UUID(as_uuid=True), ForeignKey('orders.id'), nullable=True)
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)
    
    # 金额信息
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default='CNY')
    balance_before = Column(Numeric(12, 2), nullable=False)
    balance_after = Column(Numeric(12, 2), nullable=False)
    
    # 描述信息
    title = Column(String(200), nullable=False)
    description = Column(String(1000), nullable=True)
    
    # 元数据
    metadata = Column(JSONB, nullable=False, default=dict)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    # 关系
    # user = relationship("User")
    order = relationship("Order", back_populates="transactions")

    def to_schema(self) -> TransactionSchema:
        """转换为Pydantic Schema"""
        from ..schemas.marketplace import MoneyAmount
        
        return TransactionSchema(
            id=str(self.id),
            user_id=str(self.user_id),
            related_id=str(self.order_id) if self.order_id else None,
            transaction_type=self.transaction_type,
            amount=MoneyAmount(amount=self.amount, currency=self.currency),
            balance_before=MoneyAmount(amount=self.balance_before, currency=self.currency),
            balance_after=MoneyAmount(amount=self.balance_after, currency=self.currency),
            title=self.title,
            description=self.description,
            metadata=self.metadata,
            created_at=self.created_at
        )

    def __repr__(self):
        return f"<Transaction(id={self.id}, type={self.transaction_type}, amount={self.amount})>"


class Campaign(Base):
    """营销活动表"""
    __tablename__ = 'campaigns'
    __table_args__ = (
        Index('idx_campaigns_type', 'campaign_type'),
        Index('idx_campaigns_active', 'is_active'),
        Index('idx_campaigns_start_time', 'start_time'),
        Index('idx_campaigns_end_time', 'end_time'),
        Index('idx_campaigns_created_at', 'created_at'),
        CheckConstraint('discount_percentage >= 0 AND discount_percentage <= 100', name='ck_campaign_discount_percentage'),
        CheckConstraint('usage_count >= 0', name='ck_campaign_usage_count'),
        CheckConstraint('usage_limit >= 1', name='ck_campaign_usage_limit'),
        CheckConstraint('start_time < end_time', name='ck_campaign_time_range'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(200), nullable=False)
    description = Column(String(2000), nullable=False)
    campaign_type = Column(SQLEnum(CampaignType), nullable=False)
    
    # 活动规则
    rules = Column(JSONB, nullable=False, default=dict)
    conditions = Column(JSONB, nullable=False, default=dict)
    
    # 适用范围
    applicable_categories = Column(JSONB, nullable=False, default=list)
    
    # 折扣信息
    discount_percentage = Column(Float, nullable=True)
    discount_amount = Column(Numeric(12, 2), nullable=True)
    discount_currency = Column(String(3), nullable=False, default='CNY')
    
    # 使用限制
    usage_limit = Column(Integer, nullable=True)
    usage_count = Column(Integer, nullable=False, default=0)
    
    # 时间限制
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    
    # 状态信息
    is_active = Column(Boolean, nullable=False, default=True)
    is_featured = Column(Boolean, nullable=False, default=False)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # 关系
    applicable_products = relationship("Product", secondary=campaign_products_association, back_populates="campaign_products")
    applicable_vendors = relationship("Vendor", secondary=campaign_vendors_association, back_populates="campaigns")

    # 混合属性
    @hybrid_property
    def is_valid(self):
        """活动是否有效"""
        now = func.now()
        return (self.is_active and 
                self.start_time <= now and 
                now <= self.end_time and
                (self.usage_limit is None or self.usage_count < self.usage_limit))

    def increment_usage(self):
        """增加使用次数"""
        self.usage_count += 1

    def can_use(self) -> bool:
        """检查是否可以使用"""
        now = datetime.now()
        return (self.is_active and 
                self.start_time <= now <= self.end_time and
                (self.usage_limit is None or self.usage_count < self.usage_limit))

    def to_schema(self) -> CampaignSchema:
        """转换为Pydantic Schema"""
        from ..schemas.marketplace import MoneyAmount
        
        discount_amount = None
        if self.discount_amount:
            discount_amount = MoneyAmount(amount=self.discount_amount, currency=self.discount_currency)
        
        return CampaignSchema(
            id=str(self.id),
            name=self.name,
            description=self.description,
            campaign_type=self.campaign_type,
            rules=self.rules,
            conditions=self.conditions,
            applicable_products=[str(p.id) for p in self.applicable_products],
            applicable_vendors=[str(v.id) for v in self.applicable_vendors],
            applicable_categories=self.applicable_categories,
            discount_percentage=self.discount_percentage,
            discount_amount=discount_amount,
            usage_limit=self.usage_limit,
            usage_count=self.usage_count,
            start_time=self.start_time,
            end_time=self.end_time,
            is_active=self.is_active,
            is_featured=self.is_featured,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    def __repr__(self):
        return f"<Campaign(id={self.id}, name='{self.name}', type={self.campaign_type})>"


# ======================== 工具函数 ========================

def generate_order_number() -> str:
    """生成订单号"""
    import time
    timestamp = int(time.time())
    random_suffix = str(uuid.uuid4()).replace('-', '')[:8].upper()
    return f"ORD{timestamp}{random_suffix}"


def create_vendor_for_user(session: Session, user_id: uuid.UUID, **kwargs) -> Vendor:
    """为用户创建商家账户"""
    vendor = Vendor(
        user_id=user_id,
        **kwargs
    )
    session.add(vendor)
    return vendor


# ======================== 导出列表 ========================

__all__ = [
    # 主要模型
    "Product", "Vendor", "Order", "OrderItem", "Payment", "Review", 
    "Transaction", "Campaign",
    
    # 关联表
    "product_tags_association", "campaign_products_association", 
    "campaign_vendors_association",
    
    # 工具函数
    "generate_order_number", "create_vendor_for_user"
]
