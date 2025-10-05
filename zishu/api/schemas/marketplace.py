#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
市场数据模型 - Zishu-sensei
提供完整的数字商品市场API接口数据验证和序列化
包含商品管理、订单处理、支付系统、评价体系、商家管理等功能
"""

from pydantic import BaseModel, Field, field_validator, model_validator, HttpUrl, EmailStr
from typing import Optional, List, Any, Dict, Union, Literal, Annotated
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal
import uuid
import re

# 从其他模块导入基础类型
from .auth import UserRole, UserStatus
from .user import UserProfileDetail

# ======================== 枚举定义 ========================

class ProductType(str, Enum):
    """商品类型枚举"""
    ADAPTER = "adapter"           # 适配器
    PLUGIN = "plugin"             # 插件
    THEME = "theme"              # 主题
    TEMPLATE = "template"        # 模板
    SERVICE = "service"          # 服务
    SUBSCRIPTION = "subscription" # 订阅服务
    DIGITAL_ASSET = "digital_asset"  # 数字资产
    COURSE = "course"            # 课程
    EBOOK = "ebook"             # 电子书
    SOFTWARE = "software"        # 软件
    API_ACCESS = "api_access"    # API访问权限

class ProductStatus(str, Enum):
    """商品状态枚举"""
    DRAFT = "draft"              # 草稿
    PENDING_REVIEW = "pending_review"  # 待审核
    APPROVED = "approved"        # 已批准
    PUBLISHED = "published"      # 已发布
    FEATURED = "featured"        # 精选商品
    SUSPENDED = "suspended"      # 暂停销售
    REJECTED = "rejected"        # 审核拒绝
    ARCHIVED = "archived"        # 已归档
    DELETED = "deleted"          # 已删除

class PricingModel(str, Enum):
    """定价模型枚举"""
    FREE = "free"                # 免费
    ONE_TIME = "one_time"        # 一次性付费
    SUBSCRIPTION = "subscription"  # 订阅制
    FREEMIUM = "freemium"        # 免费增值
    PAY_PER_USE = "pay_per_use"  # 按使用付费
    TIERED = "tiered"            # 阶梯定价
    DONATION = "donation"        # 捐赠制
    AUCTION = "auction"          # 拍卖制

class OrderStatus(str, Enum):
    """订单状态枚举"""
    PENDING = "pending"          # 待处理
    CONFIRMED = "confirmed"      # 已确认
    PAID = "paid"               # 已支付
    PROCESSING = "processing"    # 处理中
    DELIVERED = "delivered"      # 已交付
    COMPLETED = "completed"      # 已完成
    CANCELLED = "cancelled"      # 已取消
    REFUNDED = "refunded"       # 已退款
    FAILED = "failed"           # 失败
    EXPIRED = "expired"         # 已过期

class PaymentStatus(str, Enum):
    """支付状态枚举"""
    PENDING = "pending"          # 待支付
    PROCESSING = "processing"    # 支付处理中
    SUCCESS = "success"          # 支付成功
    FAILED = "failed"           # 支付失败
    CANCELLED = "cancelled"      # 支付取消
    REFUNDED = "refunded"       # 已退款
    PARTIAL_REFUND = "partial_refund"  # 部分退款

class PaymentMethod(str, Enum):
    """支付方式枚举"""
    ALIPAY = "alipay"           # 支付宝
    WECHAT_PAY = "wechat_pay"   # 微信支付
    UNIONPAY = "unionpay"       # 银联
    PAYPAL = "paypal"           # PayPal
    STRIPE = "stripe"           # Stripe
    CRYPTO = "crypto"           # 加密货币
    BALANCE = "balance"         # 账户余额
    POINTS = "points"           # 积分支付
    VOUCHER = "voucher"         # 代金券

class ReviewRating(int, Enum):
    """评分枚举"""
    ONE_STAR = 1
    TWO_STARS = 2
    THREE_STARS = 3
    FOUR_STARS = 4
    FIVE_STARS = 5

class ReviewStatus(str, Enum):
    """评价状态枚举"""
    PENDING = "pending"          # 待审核
    PUBLISHED = "published"      # 已发布
    HIDDEN = "hidden"           # 已隐藏
    FLAGGED = "flagged"         # 已举报
    DELETED = "deleted"         # 已删除

class VendorType(str, Enum):
    """商家类型枚举"""
    INDIVIDUAL = "individual"    # 个人开发者
    COMPANY = "company"         # 公司
    ORGANIZATION = "organization"  # 组织
    OFFICIAL = "official"       # 官方
    PARTNER = "partner"         # 合作伙伴
    VERIFIED = "verified"       # 认证商家

class VendorStatus(str, Enum):
    """商家状态枚举"""
    ACTIVE = "active"           # 活跃
    PENDING = "pending"         # 待审核
    SUSPENDED = "suspended"     # 暂停
    BANNED = "banned"          # 封禁
    CLOSED = "closed"          # 关闭

class TransactionType(str, Enum):
    """交易类型枚举"""
    PURCHASE = "purchase"        # 购买
    REFUND = "refund"           # 退款
    COMMISSION = "commission"    # 佣金
    WITHDRAWAL = "withdrawal"    # 提现
    DEPOSIT = "deposit"         # 充值
    BONUS = "bonus"             # 奖金
    PENALTY = "penalty"         # 罚金

class CurrencyType(str, Enum):
    """货币类型枚举"""
    CNY = "CNY"                 # 人民币
    USD = "USD"                 # 美元
    EUR = "EUR"                 # 欧元
    GBP = "GBP"                 # 英镑
    JPY = "JPY"                 # 日元
    KRW = "KRW"                 # 韩元
    BTC = "BTC"                 # 比特币
    ETH = "ETH"                 # 以太坊

class CampaignType(str, Enum):
    """营销活动类型枚举"""
    DISCOUNT = "discount"        # 折扣
    BUNDLE = "bundle"           # 套餐
    FLASH_SALE = "flash_sale"   # 限时抢购
    COUPON = "coupon"           # 优惠券
    CASHBACK = "cashback"       # 返现
    POINTS_REWARD = "points_reward"  # 积分奖励
    REFERRAL = "referral"       # 推荐奖励

# ======================== 基础模型 ========================

class MoneyAmount(BaseModel):
    """金额模型"""
    amount: Decimal = Field(..., ge=0, decimal_places=2, description="金额")
    currency: CurrencyType = Field(default=CurrencyType.CNY, description="货币类型")
    
    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        if v < 0:
            raise ValueError("金额不能为负数")
        if v > Decimal('99999999.99'):
            raise ValueError("金额过大")
        return v

class ProductBase(BaseModel):
    """商品基础模型"""
    name: str = Field(..., min_length=1, max_length=200, description="商品名称")
    slug: str = Field(..., min_length=1, max_length=100, description="商品标识符")
    description: str = Field(..., min_length=10, max_length=5000, description="商品描述")
    short_description: Optional[str] = Field(None, max_length=500, description="商品简介")
    product_type: ProductType = Field(..., description="商品类型")
    category: str = Field(..., min_length=1, max_length=100, description="商品分类")
    subcategory: Optional[str] = Field(None, max_length=100, description="商品子分类")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    
    # 媒体资源
    logo_url: Optional[HttpUrl] = Field(None, description="商品Logo")
    cover_url: Optional[HttpUrl] = Field(None, description="封面图片")
    screenshots: List[HttpUrl] = Field(default_factory=list, description="截图列表")
    video_url: Optional[HttpUrl] = Field(None, description="介绍视频")
    demo_url: Optional[HttpUrl] = Field(None, description="演示链接")
    
    # 技术信息
    version: str = Field(..., description="版本号")
    compatibility: Dict[str, str] = Field(default_factory=dict, description="兼容性信息")
    requirements: List[str] = Field(default_factory=list, description="系统要求")
    file_size: Optional[int] = Field(None, ge=0, description="文件大小(字节)")
    
    # SEO和元数据
    keywords: List[str] = Field(default_factory=list, description="关键词")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")
    
    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v):
        if not re.match(r'^[a-z0-9\-]+$', v):
            raise ValueError("商品标识符只能包含小写字母、数字和连字符")
        return v
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 20:
            raise ValueError("标签数量不能超过20个")
        return [tag.strip().lower() for tag in v if tag.strip()]

class PricingInfo(BaseModel):
    """定价信息模型"""
    pricing_model: PricingModel = Field(..., description="定价模型")
    base_price: MoneyAmount = Field(..., description="基础价格")
    sale_price: Optional[MoneyAmount] = Field(None, description="优惠价格")
    
    # 订阅制相关
    billing_cycle: Optional[str] = Field(None, description="计费周期")
    trial_days: Optional[int] = Field(None, ge=0, le=365, description="试用天数")
    
    # 阶梯定价
    tier_prices: List[Dict[str, Any]] = Field(default_factory=list, description="阶梯价格")
    
    # 许可证相关
    license_type: Optional[str] = Field(None, description="许可证类型")
    usage_limits: Dict[str, Any] = Field(default_factory=dict, description="使用限制")
    
    @field_validator('sale_price')
    @classmethod
    def validate_sale_price(cls, v, info):
        if v and 'base_price' in info.data:
            if v.amount >= info.data['base_price'].amount:
                raise ValueError("优惠价格必须小于基础价格")
        return v

class VendorBase(BaseModel):
    """商家基础模型"""
    name: str = Field(..., min_length=2, max_length=200, description="商家名称")
    display_name: str = Field(..., min_length=2, max_length=200, description="显示名称")
    description: Optional[str] = Field(None, max_length=2000, description="商家描述")
    vendor_type: VendorType = Field(..., description="商家类型")
    
    # 联系信息
    email: EmailStr = Field(..., description="联系邮箱")
    phone: Optional[str] = Field(None, description="联系电话")
    website: Optional[HttpUrl] = Field(None, description="官网")
    
    # 地址信息
    country: str = Field(..., min_length=2, max_length=100, description="国家")
    city: Optional[str] = Field(None, max_length=100, description="城市")
    address: Optional[str] = Field(None, max_length=500, description="详细地址")
    
    # 媒体资源
    logo_url: Optional[HttpUrl] = Field(None, description="商家Logo")
    banner_url: Optional[HttpUrl] = Field(None, description="横幅图片")
    
    # 社交媒体
    social_links: Dict[str, HttpUrl] = Field(default_factory=dict, description="社交媒体链接")
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v and not re.match(r'^\+?[\d\s\-\(\)]+$', v):
            raise ValueError("电话号码格式不正确")
        return v

# ======================== 完整模型 ========================

class Product(ProductBase):
    """商品完整模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="商品ID")
    vendor_id: str = Field(..., description="商家ID")
    status: ProductStatus = Field(default=ProductStatus.DRAFT, description="商品状态")
    
    # 定价信息
    pricing: PricingInfo = Field(..., description="定价信息")
    
    # 统计信息
    download_count: int = Field(default=0, ge=0, description="下载次数")
    purchase_count: int = Field(default=0, ge=0, description="购买次数")
    view_count: int = Field(default=0, ge=0, description="浏览次数")
    favorite_count: int = Field(default=0, ge=0, description="收藏次数")
    
    # 评分信息
    average_rating: float = Field(default=0.0, ge=0.0, le=5.0, description="平均评分")
    rating_count: int = Field(default=0, ge=0, description="评分数量")
    
    # 状态标记
    is_featured: bool = Field(default=False, description="是否精选")
    is_verified: bool = Field(default=False, description="是否已验证")
    is_recommended: bool = Field(default=False, description="是否推荐")
    
    # 时间信息
    published_at: Optional[datetime] = Field(None, description="发布时间")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

class Vendor(VendorBase):
    """商家完整模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="商家ID")
    user_id: str = Field(..., description="关联用户ID")
    status: VendorStatus = Field(default=VendorStatus.PENDING, description="商家状态")
    
    # 统计信息
    product_count: int = Field(default=0, ge=0, description="商品数量")
    total_sales: MoneyAmount = Field(default_factory=lambda: MoneyAmount(amount=Decimal('0')), description="总销售额")
    total_orders: int = Field(default=0, ge=0, description="总订单数")
    
    # 评分信息
    average_rating: float = Field(default=0.0, ge=0.0, le=5.0, description="平均评分")
    rating_count: int = Field(default=0, ge=0, description="评分数量")
    
    # 认证信息
    is_verified: bool = Field(default=False, description="是否已认证")
    verification_level: int = Field(default=0, ge=0, le=5, description="认证级别")
    
    # 财务信息
    balance: MoneyAmount = Field(default_factory=lambda: MoneyAmount(amount=Decimal('0')), description="账户余额")
    commission_rate: float = Field(default=0.1, ge=0.0, le=1.0, description="佣金费率")
    
    # 时间信息
    joined_at: datetime = Field(default_factory=datetime.now, description="加入时间")
    verified_at: Optional[datetime] = Field(None, description="认证时间")
    last_login_at: Optional[datetime] = Field(None, description="最后登录时间")

class Order(BaseModel):
    """订单模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="订单ID")
    order_number: str = Field(..., description="订单号")
    buyer_id: str = Field(..., description="买家ID")
    vendor_id: str = Field(..., description="商家ID")
    status: OrderStatus = Field(default=OrderStatus.PENDING, description="订单状态")
    
    # 商品信息
    items: List[Dict[str, Any]] = Field(..., description="订单项目列表")
    
    # 金额信息
    subtotal: MoneyAmount = Field(..., description="小计")
    discount_amount: MoneyAmount = Field(default_factory=lambda: MoneyAmount(amount=Decimal('0')), description="折扣金额")
    tax_amount: MoneyAmount = Field(default_factory=lambda: MoneyAmount(amount=Decimal('0')), description="税费")
    total_amount: MoneyAmount = Field(..., description="总金额")
    
    # 支付信息
    payment_method: Optional[PaymentMethod] = Field(None, description="支付方式")
    payment_status: PaymentStatus = Field(default=PaymentStatus.PENDING, description="支付状态")
    
    # 配送信息
    delivery_method: Optional[str] = Field(None, description="配送方式")
    delivery_address: Optional[Dict[str, Any]] = Field(None, description="配送地址")
    
    # 备注信息
    buyer_notes: Optional[str] = Field(None, max_length=1000, description="买家备注")
    vendor_notes: Optional[str] = Field(None, max_length=1000, description="商家备注")
    internal_notes: Optional[str] = Field(None, max_length=1000, description="内部备注")
    
    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    paid_at: Optional[datetime] = Field(None, description="支付时间")
    delivered_at: Optional[datetime] = Field(None, description="交付时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")

class Payment(BaseModel):
    """支付记录模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="支付ID")
    order_id: str = Field(..., description="订单ID")
    transaction_id: str = Field(..., description="交易号")
    
    # 支付信息
    amount: MoneyAmount = Field(..., description="支付金额")
    method: PaymentMethod = Field(..., description="支付方式")
    status: PaymentStatus = Field(default=PaymentStatus.PENDING, description="支付状态")
    
    # 第三方支付信息
    gateway: Optional[str] = Field(None, description="支付网关")
    gateway_transaction_id: Optional[str] = Field(None, description="网关交易ID")
    gateway_response: Dict[str, Any] = Field(default_factory=dict, description="网关响应")
    
    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    paid_at: Optional[datetime] = Field(None, description="支付完成时间")
    failed_at: Optional[datetime] = Field(None, description="支付失败时间")

class Review(BaseModel):
    """商品评价模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="评价ID")
    product_id: str = Field(..., description="商品ID")
    user_id: str = Field(..., description="用户ID")
    order_id: Optional[str] = Field(None, description="关联订单ID")
    
    # 评价内容
    rating: ReviewRating = Field(..., description="评分")
    title: Optional[str] = Field(None, max_length=200, description="评价标题")
    content: str = Field(..., min_length=10, max_length=5000, description="评价内容")
    
    # 详细评分
    quality_rating: Optional[int] = Field(None, ge=1, le=5, description="质量评分")
    service_rating: Optional[int] = Field(None, ge=1, le=5, description="服务评分")
    value_rating: Optional[int] = Field(None, ge=1, le=5, description="性价比评分")
    
    # 媒体附件
    images: List[HttpUrl] = Field(default_factory=list, description="评价图片")
    videos: List[HttpUrl] = Field(default_factory=list, description="评价视频")
    
    # 状态信息
    status: ReviewStatus = Field(default=ReviewStatus.PENDING, description="评价状态")
    is_verified_purchase: bool = Field(default=False, description="是否已验证购买")
    is_anonymous: bool = Field(default=False, description="是否匿名评价")
    
    # 互动统计
    helpful_count: int = Field(default=0, ge=0, description="有用数")
    reply_count: int = Field(default=0, ge=0, description="回复数")
    
    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

class Transaction(BaseModel):
    """交易记录模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="交易ID")
    user_id: str = Field(..., description="用户ID")
    related_id: Optional[str] = Field(None, description="关联对象ID")
    transaction_type: TransactionType = Field(..., description="交易类型")
    
    # 金额信息
    amount: MoneyAmount = Field(..., description="交易金额")
    balance_before: MoneyAmount = Field(..., description="交易前余额")
    balance_after: MoneyAmount = Field(..., description="交易后余额")
    
    # 描述信息
    title: str = Field(..., max_length=200, description="交易标题")
    description: Optional[str] = Field(None, max_length=1000, description="交易描述")
    
    # 元数据
    metadata: Dict[str, Any] = Field(default_factory=dict, description="交易元数据")
    
    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")

class Campaign(BaseModel):
    """营销活动模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="活动ID")
    name: str = Field(..., min_length=2, max_length=200, description="活动名称")
    description: str = Field(..., min_length=10, max_length=2000, description="活动描述")
    campaign_type: CampaignType = Field(..., description="活动类型")
    
    # 活动规则
    rules: Dict[str, Any] = Field(default_factory=dict, description="活动规则")
    conditions: Dict[str, Any] = Field(default_factory=dict, description="参与条件")
    
    # 适用范围
    applicable_products: List[str] = Field(default_factory=list, description="适用商品")
    applicable_vendors: List[str] = Field(default_factory=list, description="适用商家")
    applicable_categories: List[str] = Field(default_factory=list, description="适用分类")
    
    # 折扣信息
    discount_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="折扣百分比")
    discount_amount: Optional[MoneyAmount] = Field(None, description="折扣金额")
    
    # 使用限制
    usage_limit: Optional[int] = Field(None, ge=1, description="使用次数限制")
    usage_count: int = Field(default=0, ge=0, description="已使用次数")
    
    # 时间限制
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime = Field(..., description="结束时间")
    
    # 状态信息
    is_active: bool = Field(default=True, description="是否激活")
    is_featured: bool = Field(default=False, description="是否精选")
    
    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    
    @model_validator(mode='after')
    def validate_time_range(self):
        if self.start_time >= self.end_time:
            raise ValueError("开始时间必须早于结束时间")
        return self

# ======================== 请求模型 ========================

class ProductCreateRequest(ProductBase):
    """创建商品请求"""
    vendor_id: str = Field(..., description="商家ID")
    pricing: PricingInfo = Field(..., description="定价信息")

class ProductUpdateRequest(BaseModel):
    """更新商品请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="商品名称")
    description: Optional[str] = Field(None, min_length=10, max_length=5000, description="商品描述")
    short_description: Optional[str] = Field(None, max_length=500, description="商品简介")
    category: Optional[str] = Field(None, min_length=1, max_length=100, description="商品分类")
    subcategory: Optional[str] = Field(None, max_length=100, description="商品子分类")
    tags: Optional[List[str]] = Field(None, description="标签列表")
    logo_url: Optional[HttpUrl] = Field(None, description="商品Logo")
    cover_url: Optional[HttpUrl] = Field(None, description="封面图片")
    screenshots: Optional[List[HttpUrl]] = Field(None, description="截图列表")
    version: Optional[str] = Field(None, description="版本号")
    pricing: Optional[PricingInfo] = Field(None, description="定价信息")

class VendorCreateRequest(VendorBase):
    """创建商家请求"""
    user_id: str = Field(..., description="关联用户ID")

class VendorUpdateRequest(BaseModel):
    """更新商家请求"""
    name: Optional[str] = Field(None, min_length=2, max_length=200, description="商家名称")
    display_name: Optional[str] = Field(None, min_length=2, max_length=200, description="显示名称")
    description: Optional[str] = Field(None, max_length=2000, description="商家描述")
    email: Optional[EmailStr] = Field(None, description="联系邮箱")
    phone: Optional[str] = Field(None, description="联系电话")
    website: Optional[HttpUrl] = Field(None, description="官网")
    logo_url: Optional[HttpUrl] = Field(None, description="商家Logo")
    banner_url: Optional[HttpUrl] = Field(None, description="横幅图片")

class OrderCreateRequest(BaseModel):
    """创建订单请求"""
    items: List[Dict[str, Any]] = Field(..., min_length=1, description="订单项目列表")
    delivery_method: Optional[str] = Field(None, description="配送方式")
    delivery_address: Optional[Dict[str, Any]] = Field(None, description="配送地址")
    buyer_notes: Optional[str] = Field(None, max_length=1000, description="买家备注")
    payment_method: Optional[PaymentMethod] = Field(None, description="支付方式")

class PaymentCreateRequest(BaseModel):
    """创建支付请求"""
    order_id: str = Field(..., description="订单ID")
    method: PaymentMethod = Field(..., description="支付方式")
    return_url: Optional[HttpUrl] = Field(None, description="支付成功返回URL")
    cancel_url: Optional[HttpUrl] = Field(None, description="支付取消返回URL")

class ReviewCreateRequest(BaseModel):
    """创建评价请求"""
    product_id: str = Field(..., description="商品ID")
    order_id: Optional[str] = Field(None, description="关联订单ID")
    rating: ReviewRating = Field(..., description="评分")
    title: Optional[str] = Field(None, max_length=200, description="评价标题")
    content: str = Field(..., min_length=10, max_length=5000, description="评价内容")
    quality_rating: Optional[int] = Field(None, ge=1, le=5, description="质量评分")
    service_rating: Optional[int] = Field(None, ge=1, le=5, description="服务评分")
    value_rating: Optional[int] = Field(None, ge=1, le=5, description="性价比评分")
    images: List[HttpUrl] = Field(default_factory=list, description="评价图片")
    is_anonymous: bool = Field(default=False, description="是否匿名评价")

class CampaignCreateRequest(BaseModel):
    """创建活动请求"""
    name: str = Field(..., min_length=2, max_length=200, description="活动名称")
    description: str = Field(..., min_length=10, max_length=2000, description="活动描述")
    campaign_type: CampaignType = Field(..., description="活动类型")
    rules: Dict[str, Any] = Field(default_factory=dict, description="活动规则")
    conditions: Dict[str, Any] = Field(default_factory=dict, description="参与条件")
    applicable_products: List[str] = Field(default_factory=list, description="适用商品")
    discount_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="折扣百分比")
    discount_amount: Optional[MoneyAmount] = Field(None, description="折扣金额")
    usage_limit: Optional[int] = Field(None, ge=1, description="使用次数限制")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime = Field(..., description="结束时间")

# ======================== 响应模型 ========================

class ProductListItem(BaseModel):
    """商品列表项"""
    id: str = Field(..., description="商品ID")
    name: str = Field(..., description="商品名称")
    slug: str = Field(..., description="商品标识符")
    short_description: Optional[str] = Field(None, description="商品简介")
    product_type: ProductType = Field(..., description="商品类型")
    category: str = Field(..., description="商品分类")
    logo_url: Optional[HttpUrl] = Field(None, description="商品Logo")
    cover_url: Optional[HttpUrl] = Field(None, description="封面图片")
    pricing: PricingInfo = Field(..., description="定价信息")
    average_rating: float = Field(..., description="平均评分")
    rating_count: int = Field(..., description="评分数量")
    download_count: int = Field(..., description="下载次数")
    is_featured: bool = Field(..., description="是否精选")
    is_verified: bool = Field(..., description="是否已验证")
    vendor_name: str = Field(..., description="商家名称")
    created_at: datetime = Field(..., description="创建时间")

class ProductDetailResponse(Product):
    """商品详情响应"""
    vendor: "VendorListItem" = Field(..., description="商家信息")
    recent_reviews: List["ReviewListItem"] = Field(default_factory=list, description="最近评价")
    related_products: List["ProductListItem"] = Field(default_factory=list, description="相关商品")
    is_favorited: bool = Field(default=False, description="是否已收藏")
    can_purchase: bool = Field(default=True, description="是否可购买")

class VendorListItem(BaseModel):
    """商家列表项"""
    id: str = Field(..., description="商家ID")
    name: str = Field(..., description="商家名称")
    display_name: str = Field(..., description="显示名称")
    vendor_type: VendorType = Field(..., description="商家类型")
    logo_url: Optional[HttpUrl] = Field(None, description="商家Logo")
    product_count: int = Field(..., description="商品数量")
    average_rating: float = Field(..., description="平均评分")
    rating_count: int = Field(..., description="评分数量")
    is_verified: bool = Field(..., description="是否已认证")
    verification_level: int = Field(..., description="认证级别")
    joined_at: datetime = Field(..., description="加入时间")

class VendorDetailResponse(Vendor):
    """商家详情响应"""
    products: List["ProductListItem"] = Field(default_factory=list, description="商品列表")
    recent_reviews: List["ReviewListItem"] = Field(default_factory=list, description="最近评价")
    is_following: bool = Field(default=False, description="是否已关注")

class OrderListItem(BaseModel):
    """订单列表项"""
    id: str = Field(..., description="订单ID")
    order_number: str = Field(..., description="订单号")
    status: OrderStatus = Field(..., description="订单状态")
    total_amount: MoneyAmount = Field(..., description="总金额")
    payment_status: PaymentStatus = Field(..., description="支付状态")
    item_count: int = Field(..., description="商品数量")
    vendor_name: str = Field(..., description="商家名称")
    created_at: datetime = Field(..., description="创建时间")

class OrderDetailResponse(Order):
    """订单详情响应"""
    buyer: UserProfileDetail = Field(..., description="买家信息")
    vendor: VendorListItem = Field(..., description="商家信息")
    product_details: List[Dict[str, Any]] = Field(default_factory=list, description="商品详情")
    payment_history: List["PaymentListItem"] = Field(default_factory=list, description="支付记录")
    can_cancel: bool = Field(default=False, description="是否可取消")
    can_refund: bool = Field(default=False, description="是否可退款")

class PaymentListItem(BaseModel):
    """支付记录列表项"""
    id: str = Field(..., description="支付ID")
    transaction_id: str = Field(..., description="交易号")
    amount: MoneyAmount = Field(..., description="支付金额")
    method: PaymentMethod = Field(..., description="支付方式")
    status: PaymentStatus = Field(..., description="支付状态")
    created_at: datetime = Field(..., description="创建时间")
    paid_at: Optional[datetime] = Field(None, description="支付完成时间")

class ReviewListItem(BaseModel):
    """评价列表项"""
    id: str = Field(..., description="评价ID")
    rating: ReviewRating = Field(..., description="评分")
    title: Optional[str] = Field(None, description="评价标题")
    content: str = Field(..., description="评价内容")
    user_name: str = Field(..., description="用户名称")
    user_avatar: Optional[HttpUrl] = Field(None, description="用户头像")
    is_verified_purchase: bool = Field(..., description="是否已验证购买")
    helpful_count: int = Field(..., description="有用数")
    created_at: datetime = Field(..., description="创建时间")

class ReviewDetailResponse(Review):
    """评价详情响应"""
    user: UserProfileDetail = Field(..., description="用户信息")
    product: ProductListItem = Field(..., description="商品信息")
    replies: List[Dict[str, Any]] = Field(default_factory=list, description="回复列表")
    is_helpful: bool = Field(default=False, description="当前用户是否认为有用")

class TransactionListItem(BaseModel):
    """交易记录列表项"""
    id: str = Field(..., description="交易ID")
    transaction_type: TransactionType = Field(..., description="交易类型")
    title: str = Field(..., description="交易标题")
    amount: MoneyAmount = Field(..., description="交易金额")
    balance_after: MoneyAmount = Field(..., description="交易后余额")
    created_at: datetime = Field(..., description="创建时间")

class CampaignListItem(BaseModel):
    """活动列表项"""
    id: str = Field(..., description="活动ID")
    name: str = Field(..., description="活动名称")
    campaign_type: CampaignType = Field(..., description="活动类型")
    discount_percentage: Optional[float] = Field(None, description="折扣百分比")
    discount_amount: Optional[MoneyAmount] = Field(None, description="折扣金额")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime = Field(..., description="结束时间")
    is_active: bool = Field(..., description="是否激活")
    usage_count: int = Field(..., description="已使用次数")
    usage_limit: Optional[int] = Field(None, description="使用次数限制")

class PaginatedResponse(BaseModel):
    """分页响应基类"""
    items: List[Any] = Field(..., description="数据列表")
    total: int = Field(..., ge=0, description="总数量")
    page: int = Field(..., ge=1, description="当前页码")
    size: int = Field(..., ge=1, le=100, description="页面大小")
    has_next: bool = Field(..., description="是否有下一页")
    has_prev: bool = Field(..., description="是否有上一页")
    total_pages: int = Field(..., ge=1, description="总页数")

class SearchFilters(BaseModel):
    """搜索过滤器"""
    query: Optional[str] = Field(None, description="搜索关键词")
    product_type: Optional[ProductType] = Field(None, description="商品类型")
    category: Optional[str] = Field(None, description="分类")
    subcategory: Optional[str] = Field(None, description="子分类")
    vendor_type: Optional[VendorType] = Field(None, description="商家类型")
    price_min: Optional[Decimal] = Field(None, ge=0, description="最低价格")
    price_max: Optional[Decimal] = Field(None, ge=0, description="最高价格")
    rating_min: Optional[float] = Field(None, ge=0.0, le=5.0, description="最低评分")
    is_free: Optional[bool] = Field(None, description="是否免费")
    is_featured: Optional[bool] = Field(None, description="是否精选")
    tags: Optional[List[str]] = Field(None, description="标签过滤")
    date_from: Optional[datetime] = Field(None, description="开始时间")
    date_to: Optional[datetime] = Field(None, description="结束时间")
    sort_by: str = Field(default="created_at", description="排序字段")
    sort_order: Literal["asc", "desc"] = Field(default="desc", description="排序方向")

# ======================== 统计模型 ========================

class MarketplaceStats(BaseModel):
    """市场统计信息"""
    total_products: int = Field(..., ge=0, description="总商品数")
    total_vendors: int = Field(..., ge=0, description="总商家数")
    total_orders: int = Field(..., ge=0, description="总订单数")
    total_revenue: MoneyAmount = Field(..., description="总收入")
    
    # 时间段统计
    products_today: int = Field(..., ge=0, description="今日新增商品")
    products_this_week: int = Field(..., ge=0, description="本周新增商品")
    products_this_month: int = Field(..., ge=0, description="本月新增商品")
    
    orders_today: int = Field(..., ge=0, description="今日订单数")
    orders_this_week: int = Field(..., ge=0, description="本周订单数")
    orders_this_month: int = Field(..., ge=0, description="本月订单数")
    
    revenue_today: MoneyAmount = Field(..., description="今日收入")
    revenue_this_week: MoneyAmount = Field(..., description="本周收入")
    revenue_this_month: MoneyAmount = Field(..., description="本月收入")
    
    # 分类统计
    category_stats: Dict[str, int] = Field(default_factory=dict, description="分类统计")
    vendor_type_stats: Dict[str, int] = Field(default_factory=dict, description="商家类型统计")
    
    # 热门数据
    top_products: List[Dict[str, Any]] = Field(default_factory=list, description="热门商品")
    top_vendors: List[Dict[str, Any]] = Field(default_factory=list, description="热门商家")
    top_categories: List[Dict[str, Any]] = Field(default_factory=list, description="热门分类")

class VendorStats(BaseModel):
    """商家统计信息"""
    total_products: int = Field(..., ge=0, description="总商品数")
    published_products: int = Field(..., ge=0, description="已发布商品数")
    draft_products: int = Field(..., ge=0, description="草稿商品数")
    
    total_orders: int = Field(..., ge=0, description="总订单数")
    completed_orders: int = Field(..., ge=0, description="已完成订单数")
    pending_orders: int = Field(..., ge=0, description="待处理订单数")
    
    total_revenue: MoneyAmount = Field(..., description="总收入")
    this_month_revenue: MoneyAmount = Field(..., description="本月收入")
    
    average_rating: float = Field(..., ge=0.0, le=5.0, description="平均评分")
    total_reviews: int = Field(..., ge=0, description="总评价数")
    
    top_products: List[Dict[str, Any]] = Field(default_factory=list, description="热销商品")
    revenue_trend: List[Dict[str, Any]] = Field(default_factory=list, description="收入趋势")

# ======================== 辅助函数 ========================

def generate_order_number() -> str:
    """生成订单号"""
    import time
    timestamp = int(time.time())
    random_suffix = str(uuid.uuid4()).replace('-', '')[:8].upper()
    return f"ORD{timestamp}{random_suffix}"

def calculate_discount_amount(base_price: MoneyAmount, discount_percentage: float) -> MoneyAmount:
    """计算折扣金额"""
    discount_amount = base_price.amount * Decimal(str(discount_percentage / 100))
    return MoneyAmount(amount=discount_amount, currency=base_price.currency)

def validate_product_pricing(pricing: PricingInfo) -> bool:
    """验证商品定价"""
    if pricing.pricing_model == PricingModel.FREE:
        return pricing.base_price.amount == Decimal('0')
    elif pricing.pricing_model == PricingModel.SUBSCRIPTION:
        return pricing.billing_cycle is not None
    return pricing.base_price.amount > Decimal('0')

def calculate_commission(amount: MoneyAmount, rate: float) -> MoneyAmount:
    """计算佣金"""
    commission_amount = amount.amount * Decimal(str(rate))
    return MoneyAmount(amount=commission_amount, currency=amount.currency)

def is_campaign_active(campaign: Campaign) -> bool:
    """检查活动是否活跃"""
    now = datetime.now()
    return (campaign.is_active and 
            campaign.start_time <= now <= campaign.end_time and
            (campaign.usage_limit is None or campaign.usage_count < campaign.usage_limit))

def get_product_final_price(product: Product, campaigns: List[Campaign] = None) -> MoneyAmount:
    """获取商品最终价格（考虑活动折扣）"""
    base_price = product.pricing.sale_price or product.pricing.base_price
    
    if not campaigns:
        return base_price
    
    # 找到最优折扣
    best_discount = Decimal('0')
    for campaign in campaigns:
        if not is_campaign_active(campaign):
            continue
            
        if (product.id in campaign.applicable_products or 
            product.category in campaign.applicable_categories or
            product.vendor_id in campaign.applicable_vendors):
            
            if campaign.discount_percentage:
                discount = base_price.amount * Decimal(str(campaign.discount_percentage / 100))
                best_discount = max(best_discount, discount)
            elif campaign.discount_amount:
                best_discount = max(best_discount, campaign.discount_amount.amount)
    
    final_amount = max(Decimal('0'), base_price.amount - best_discount)
    return MoneyAmount(amount=final_amount, currency=base_price.currency)

def validate_order_items(items: List[Dict[str, Any]]) -> bool:
    """验证订单项目"""
    if not items:
        return False
    
    for item in items:
        required_fields = ['product_id', 'quantity', 'price']
        if not all(field in item for field in required_fields):
            return False
        
        if item['quantity'] <= 0:
            return False
            
        if item['price'] <= 0:
            return False
    
    return True

def create_product_slug(name: str) -> str:
    """创建商品标识符"""
    import re
    slug = re.sub(r'[^\w\s-]', '', name.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.strip('-')

# 为递归模型添加前向引用
ProductDetailResponse.model_rebuild()
VendorDetailResponse.model_rebuild()

# ======================== 导出列表 ========================

__all__ = [
    # 枚举
    "ProductType", "ProductStatus", "PricingModel", "OrderStatus", "PaymentStatus",
    "PaymentMethod", "ReviewRating", "ReviewStatus", "VendorType", "VendorStatus",
    "TransactionType", "CurrencyType", "CampaignType",
    
    # 基础模型
    "MoneyAmount", "ProductBase", "PricingInfo", "VendorBase",
    
    # 完整模型
    "Product", "Vendor", "Order", "Payment", "Review", "Transaction", "Campaign",
    
    # 请求模型
    "ProductCreateRequest", "ProductUpdateRequest", "VendorCreateRequest", "VendorUpdateRequest",
    "OrderCreateRequest", "PaymentCreateRequest", "ReviewCreateRequest", "CampaignCreateRequest",
    
    # 响应模型
    "ProductListItem", "ProductDetailResponse", "VendorListItem", "VendorDetailResponse",
    "OrderListItem", "OrderDetailResponse", "PaymentListItem", "ReviewListItem",
    "ReviewDetailResponse", "TransactionListItem", "CampaignListItem",
    "PaginatedResponse", "SearchFilters",
    
    # 统计模型
    "MarketplaceStats", "VendorStats",
    
    # 辅助函数
    "generate_order_number", "calculate_discount_amount", "validate_product_pricing",
    "calculate_commission", "is_campaign_active", "get_product_final_price",
    "validate_order_items", "create_product_slug"
]
