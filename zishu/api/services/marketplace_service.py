#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
市场管理服务 - 提供全面的数字商品市场业务逻辑
这是整个市场系统的核心服务层，负责处理所有市场相关的业务逻辑
包含商品管理、订单处理、支付系统、评价体系、商家管理、营销活动等功能
"""

import asyncio
import json
import logging
import uuid
import hashlib
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple, Any, Union, Set
from enum import Enum
from dataclasses import dataclass, asdict
from decimal import Decimal

# 第三方库导入
try:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select, update, delete, func, and_, or_, desc, asc, text
    from sqlalchemy.orm import selectinload, joinedload

    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False

    # 提供占位符类型
    class AsyncSession:
        pass

    def select(*args, **kwargs):
        pass

    def update(*args, **kwargs):
        pass

    def delete(*args, **kwargs):
        pass

    def func(*args, **kwargs):
        pass

    def and_(*args, **kwargs):
        pass

    def or_(*args, **kwargs):
        pass

    def desc(*args, **kwargs):
        pass

    def asc(*args, **kwargs):
        pass

    def selectinload(*args, **kwargs):
        pass

    def joinedload(*args, **kwargs):
        pass

    def text(*args, **kwargs):
        pass

    logging.warning("SQLAlchemy 未安装，数据库功能将被禁用")

try:
    import aioredis

    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    logging.warning("aioredis 未安装，缓存功能将被禁用")

# 项目内部导入
from ..schemas.marketplace import (
    # 枚举类型
    ProductType,
    ProductStatus,
    PricingModel,
    OrderStatus,
    PaymentStatus,
    PaymentMethod,
    ReviewRating,
    ReviewStatus,
    VendorType,
    VendorStatus,
    TransactionType,
    CurrencyType,
    CampaignType,
    # 数据模型
    MoneyAmount,
    ProductBase,
    PricingInfo,
    VendorBase,
    Product,
    Vendor,
    Order,
    Payment,
    Review,
    Transaction,
    Campaign,
    # 请求模型
    ProductCreateRequest,
    ProductUpdateRequest,
    VendorCreateRequest,
    VendorUpdateRequest,
    OrderCreateRequest,
    PaymentCreateRequest,
    ReviewCreateRequest,
    CampaignCreateRequest,
    # 响应模型
    ProductListItem,
    ProductDetailResponse,
    VendorListItem,
    VendorDetailResponse,
    OrderListItem,
    OrderDetailResponse,
    PaymentListItem,
    ReviewListItem,
    ReviewDetailResponse,
    TransactionListItem,
    CampaignListItem,
    PaginatedResponse,
    SearchFilters,
    # 统计模型
    MarketplaceStats,
    VendorStats,
    # 工具函数
    generate_order_number,
    calculate_discount_amount,
    validate_product_pricing,
    calculate_commission,
    is_campaign_active,
    get_product_final_price,
    validate_order_items,
    create_product_slug,
)

# 数据库模型导入
try:
    from ..models.marketplace import (
        Product as ProductModel,
        Vendor as VendorModel,
        Order as OrderModel,
        OrderItem as OrderItemModel,
        Payment as PaymentModel,
        Review as ReviewModel,
        Transaction as TransactionModel,
        Campaign as CampaignModel,
    )

    HAS_DATABASE = True
except ImportError:
    # 提供占位符类
    class ProductModel:
        pass

    class VendorModel:
        pass

    class OrderModel:
        pass

    class OrderItemModel:
        pass

    class PaymentModel:
        pass

    class ReviewModel:
        pass

    class TransactionModel:
        pass

    class CampaignModel:
        pass

    HAS_DATABASE = False
    logging.warning("数据库模型未找到，数据库功能将被禁用")


# 异常类定义
class MarketplaceError(Exception):
    """市场通用异常"""

    pass


class ProductNotFoundError(MarketplaceError):
    """商品未找到异常"""

    pass


class VendorNotFoundError(MarketplaceError):
    """商家未找到异常"""

    pass


class OrderNotFoundError(MarketplaceError):
    """订单未找到异常"""

    pass


class PaymentError(MarketplaceError):
    """支付异常"""

    pass


class InsufficientPermissionError(MarketplaceError):
    """权限不足异常"""

    pass


class InvalidPricingError(MarketplaceError):
    """定价无效异常"""

    pass


class CampaignNotFoundError(MarketplaceError):
    """活动未找到异常"""

    pass


class InsufficientBalanceError(MarketplaceError):
    """余额不足异常"""

    pass


# 配置类
@dataclass
class MarketplaceConfig:
    """市场服务配置"""

    # 缓存配置
    enable_cache: bool = True
    cache_ttl: int = 3600  # 1小时
    cache_prefix: str = "marketplace"

    # 分页配置
    default_page_size: int = 20
    max_page_size: int = 100

    # 业务配置
    default_commission_rate: float = 0.1  # 10%
    min_order_amount: Decimal = Decimal("0.01")
    max_order_amount: Decimal = Decimal("99999.99")

    # 支付配置
    payment_timeout: int = 1800  # 30分钟
    refund_days: int = 7  # 7天内可退款

    # 评价配置
    review_auto_publish: bool = False
    min_review_length: int = 10

    # 搜索配置
    search_result_limit: int = 1000

    # 文件配置
    max_screenshot_count: int = 10
    max_file_size: int = 100 * 1024 * 1024  # 100MB


class MarketplaceService:
    """
    市场管理服务

    提供完整的数字商品市场管理功能，包括：
    1. 商品管理 - 商品CRUD、分类管理、搜索过滤
    2. 商家管理 - 商家注册、认证、统计分析
    3. 订单系统 - 订单创建、状态管理、订单查询
    4. 支付系统 - 多种支付方式、支付状态管理、退款处理
    5. 评价系统 - 商品评价、评分统计、评价审核
    6. 营销活动 - 折扣活动、优惠券、促销管理
    7. 统计分析 - 销售统计、商家分析、热门商品
    8. 财务管理 - 交易记录、佣金计算、余额管理
    """

    def __init__(self, config: MarketplaceConfig = None):
        """初始化市场服务"""
        self.config = config or MarketplaceConfig()
        self.logger = logging.getLogger(__name__)

        # 缓存相关
        self._redis_client: Optional[aioredis.Redis] = None
        self._cache_enabled = HAS_REDIS and self.config.enable_cache

        # 统计缓存
        self._stats_cache = {}
        self._stats_cache_time = {}

        # 支付网关配置（示例）
        self._payment_gateways = {
            PaymentMethod.ALIPAY: {"name": "支付宝", "enabled": True, "config": {}},
            PaymentMethod.WECHAT_PAY: {"name": "微信支付", "enabled": True, "config": {}},
            PaymentMethod.PAYPAL: {"name": "PayPal", "enabled": False, "config": {}},
        }

    async def initialize(self, redis_client: Optional[aioredis.Redis] = None):
        """初始化服务"""
        if redis_client and HAS_REDIS:
            self._redis_client = redis_client
            self._cache_enabled = True
            self.logger.info("市场服务缓存已启用")

        self.logger.info("市场服务已初始化")

    # ======================== 缓存辅助方法 ========================

    def _get_cache_key(self, key_type: str, *args) -> str:
        """生成缓存键"""
        parts = [self.config.cache_prefix, key_type] + [str(arg) for arg in args]
        return ":".join(parts)

    async def _get_from_cache(self, key: str) -> Optional[Any]:
        """从缓存获取数据"""
        if not self._cache_enabled or not self._redis_client:
            return None

        try:
            data = await self._redis_client.get(key)
            if data:
                return json.loads(data.decode("utf-8"))
        except Exception as e:
            self.logger.warning(f"缓存读取失败: {e}")

        return None

    async def _set_to_cache(self, key: str, data: Any, ttl: int = None) -> bool:
        """设置缓存数据"""
        if not self._cache_enabled or not self._redis_client:
            return False

        try:
            ttl = ttl or self.config.cache_ttl
            await self._redis_client.setex(
                key, ttl, json.dumps(data, default=str, ensure_ascii=False)
            )
            return True
        except Exception as e:
            self.logger.warning(f"缓存写入失败: {e}")
            return False

    async def _delete_cache_pattern(self, pattern: str) -> int:
        """删除匹配模式的缓存"""
        if not self._cache_enabled or not self._redis_client:
            return 0

        try:
            keys = await self._redis_client.keys(pattern)
            if keys:
                return await self._redis_client.delete(*keys)
        except Exception as e:
            self.logger.warning(f"缓存删除失败: {e}")

        return 0

    # ======================== 商品管理 ========================

    async def create_product(
        self, session: AsyncSession, request: ProductCreateRequest, user_id: uuid.UUID
    ) -> ProductDetailResponse:
        """创建商品"""
        try:
            # 验证商家权限
            vendor = await self._get_vendor_by_user_id(session, user_id)
            if not vendor:
                raise InsufficientPermissionError("用户不是商家，无法创建商品")

            if vendor.status != VendorStatus.ACTIVE:
                raise InsufficientPermissionError("商家状态异常，无法创建商品")

            # 验证定价信息
            if not validate_product_pricing(request.pricing):
                raise InvalidPricingError("商品定价信息无效")

            # 生成商品slug
            if not hasattr(request, "slug") or not request.slug:
                slug = create_product_slug(request.name)
                # 确保slug唯一
                existing = await session.execute(
                    select(ProductModel).where(ProductModel.slug == slug)
                )
                if existing.scalar_one_or_none():
                    slug = f"{slug}-{int(time.time())}"
            else:
                slug = request.slug

            # 创建商品模型
            product_data = request.dict()
            product_data["vendor_id"] = str(vendor.id)
            product_data["slug"] = slug
            product_data["pricing_info"] = request.pricing.dict()

            product = ProductModel(**product_data)
            session.add(product)
            await session.flush()

            # 更新商家商品数量
            vendor.update_product_count()

            await session.commit()

            # 清除相关缓存
            await self._clear_product_caches(str(product.id))

            # 返回详细响应
            return await self.get_product_detail(session, str(product.id), user_id)

        except Exception as e:
            await session.rollback()
            self.logger.error(f"创建商品失败: {e}")
            raise

    async def update_product(
        self,
        session: AsyncSession,
        product_id: str,
        request: ProductUpdateRequest,
        user_id: uuid.UUID,
    ) -> ProductDetailResponse:
        """更新商品"""
        try:
            # 获取商品
            product = await self._get_product_by_id(session, product_id)
            if not product:
                raise ProductNotFoundError(f"商品不存在: {product_id}")

            # 验证权限
            if not await self._can_user_manage_product(session, user_id, product):
                raise InsufficientPermissionError("无权修改此商品")

            # 更新字段
            update_data = request.dict(exclude_none=True)
            if "pricing" in update_data:
                if not validate_product_pricing(update_data["pricing"]):
                    raise InvalidPricingError("商品定价信息无效")
                update_data["pricing_info"] = update_data.pop("pricing").dict()

            for field, value in update_data.items():
                if hasattr(product, field):
                    setattr(product, field, value)

            product.updated_at = func.now()
            await session.commit()

            # 清除缓存
            await self._clear_product_caches(product_id)

            return await self.get_product_detail(session, product_id, user_id)

        except Exception as e:
            await session.rollback()
            self.logger.error(f"更新商品失败: {e}")
            raise

    async def get_product_detail(
        self,
        session: AsyncSession,
        product_id: str,
        user_id: Optional[uuid.UUID] = None,
    ) -> ProductDetailResponse:
        """获取商品详情"""
        # 尝试从缓存获取
        cache_key = self._get_cache_key(
            "product", product_id, str(user_id) if user_id else "anonymous"
        )
        cached = await self._get_from_cache(cache_key)
        if cached:
            return ProductDetailResponse(**cached)

        # 从数据库获取
        product = await self._get_product_by_id(
            session, product_id, include_vendor=True
        )
        if not product:
            raise ProductNotFoundError(f"商品不存在: {product_id}")

        # 增加浏览次数
        product.increment_view()
        await session.commit()

        # 构建详细响应
        product_schema = product.to_schema()
        vendor_info = VendorListItem(
            id=str(product.vendor.id),
            name=product.vendor.name,
            display_name=product.vendor.display_name,
            vendor_type=product.vendor.vendor_type,
            logo_url=product.vendor.logo_url,
            product_count=product.vendor.product_count,
            average_rating=product.vendor.average_rating,
            rating_count=product.vendor.rating_count,
            is_verified=product.vendor.is_verified,
            verification_level=product.vendor.verification_level,
            joined_at=product.vendor.joined_at,
        )

        # 获取最近评价
        recent_reviews = await self._get_recent_reviews(session, product_id, limit=5)

        # 获取相关商品
        related_products = await self._get_related_products(session, product, limit=6)

        # 检查用户特定状态
        is_favorited = False
        can_purchase = True

        if user_id:
            # 这里可以检查用户是否收藏了商品、是否可以购买等
            pass

        response = ProductDetailResponse(
            **product_schema.dict(),
            vendor=vendor_info,
            recent_reviews=recent_reviews,
            related_products=related_products,
            is_favorited=is_favorited,
            can_purchase=can_purchase,
        )

        # 缓存结果
        await self._set_to_cache(cache_key, response.dict(), ttl=1800)  # 30分钟

        return response

    async def list_products(
        self,
        session: AsyncSession,
        filters: SearchFilters,
        page: int = 1,
        size: int = None,
    ) -> PaginatedResponse:
        """商品列表查询"""
        size = min(size or self.config.default_page_size, self.config.max_page_size)
        offset = (page - 1) * size

        # 构建查询
        query = select(ProductModel).where(
            ProductModel.is_deleted == False,
            ProductModel.status.in_([ProductStatus.PUBLISHED, ProductStatus.FEATURED]),
        )

        # 应用过滤器
        if filters.query:
            search_term = f"%{filters.query}%"
            query = query.where(
                or_(
                    ProductModel.name.ilike(search_term),
                    ProductModel.description.ilike(search_term),
                    ProductModel.short_description.ilike(search_term),
                )
            )

        if filters.product_type:
            query = query.where(ProductModel.product_type == filters.product_type)

        if filters.category:
            query = query.where(ProductModel.category == filters.category)

        if filters.subcategory:
            query = query.where(ProductModel.subcategory == filters.subcategory)

        if filters.is_featured is not None:
            query = query.where(ProductModel.is_featured == filters.is_featured)

        if filters.rating_min is not None:
            query = query.where(ProductModel.average_rating >= filters.rating_min)

        if filters.date_from:
            query = query.where(ProductModel.created_at >= filters.date_from)

        if filters.date_to:
            query = query.where(ProductModel.created_at <= filters.date_to)

        # 价格过滤（需要解析pricing_info）
        if filters.is_free is not None:
            if filters.is_free:
                query = query.where(text("pricing_info->>'pricing_model' = 'free'"))
            else:
                query = query.where(text("pricing_info->>'pricing_model' != 'free'"))

        # 排序
        if filters.sort_by == "created_at":
            order_expr = ProductModel.created_at
        elif filters.sort_by == "updated_at":
            order_expr = ProductModel.updated_at
        elif filters.sort_by == "name":
            order_expr = ProductModel.name
        elif filters.sort_by == "rating":
            order_expr = ProductModel.average_rating
        elif filters.sort_by == "downloads":
            order_expr = ProductModel.download_count
        elif filters.sort_by == "purchases":
            order_expr = ProductModel.purchase_count
        else:
            order_expr = ProductModel.created_at

        if filters.sort_order == "desc":
            order_expr = desc(order_expr)
        else:
            order_expr = asc(order_expr)

        query = query.order_by(order_expr)

        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar()

        # 获取数据
        query = query.offset(offset).limit(size)
        result = await session.execute(query.options(selectinload(ProductModel.vendor)))
        products = result.scalars().all()

        # 转换为列表项
        items = []
        for product in products:
            item = ProductListItem(
                id=str(product.id),
                name=product.name,
                slug=product.slug,
                short_description=product.short_description,
                product_type=product.product_type,
                category=product.category,
                logo_url=product.logo_url,
                cover_url=product.cover_url,
                pricing=PricingInfo(**product.pricing_info),
                average_rating=product.average_rating,
                rating_count=product.rating_count,
                download_count=product.download_count,
                is_featured=product.is_featured,
                is_verified=product.is_verified,
                vendor_name=product.vendor.display_name,
                created_at=product.created_at,
            )
            items.append(item)

        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            has_next=offset + size < total,
            has_prev=page > 1,
            total_pages=(total + size - 1) // size,
        )

    async def delete_product(
        self, session: AsyncSession, product_id: str, user_id: uuid.UUID
    ) -> bool:
        """删除商品（软删除）"""
        try:
            product = await self._get_product_by_id(session, product_id)
            if not product:
                raise ProductNotFoundError(f"商品不存在: {product_id}")

            # 验证权限
            if not await self._can_user_manage_product(session, user_id, product):
                raise InsufficientPermissionError("无权删除此商品")

            # 软删除
            product.soft_delete()

            # 更新商家商品数量
            vendor = await self._get_vendor_by_id(session, str(product.vendor_id))
            if vendor:
                vendor.update_product_count()

            await session.commit()

            # 清除缓存
            await self._clear_product_caches(product_id)

            return True

        except Exception as e:
            await session.rollback()
            self.logger.error(f"删除商品失败: {e}")
            raise

    # ======================== 商家管理 ========================

    async def create_vendor(
        self, session: AsyncSession, request: VendorCreateRequest, user_id: uuid.UUID
    ) -> VendorDetailResponse:
        """创建商家账户"""
        try:
            # 检查用户是否已经是商家
            existing = await self._get_vendor_by_user_id(session, user_id)
            if existing:
                raise MarketplaceError("用户已经是商家")

            # 创建商家
            vendor_data = request.dict()
            vendor_data["user_id"] = str(user_id)

            vendor = VendorModel(**vendor_data)
            session.add(vendor)
            await session.flush()

            await session.commit()

            # 清除缓存
            await self._clear_vendor_caches(str(vendor.id))

            return await self.get_vendor_detail(session, str(vendor.id))

        except Exception as e:
            await session.rollback()
            self.logger.error(f"创建商家失败: {e}")
            raise

    async def update_vendor(
        self,
        session: AsyncSession,
        vendor_id: str,
        request: VendorUpdateRequest,
        user_id: uuid.UUID,
    ) -> VendorDetailResponse:
        """更新商家信息"""
        try:
            vendor = await self._get_vendor_by_id(session, vendor_id)
            if not vendor:
                raise VendorNotFoundError(f"商家不存在: {vendor_id}")

            # 验证权限
            if vendor.user_id != user_id:
                raise InsufficientPermissionError("无权修改此商家信息")

            # 更新字段
            update_data = request.dict(exclude_none=True)
            for field, value in update_data.items():
                if hasattr(vendor, field):
                    setattr(vendor, field, value)

            vendor.updated_at = func.now()
            await session.commit()

            # 清除缓存
            await self._clear_vendor_caches(vendor_id)

            return await self.get_vendor_detail(session, vendor_id)

        except Exception as e:
            await session.rollback()
            self.logger.error(f"更新商家失败: {e}")
            raise

    async def get_vendor_detail(
        self, session: AsyncSession, vendor_id: str, user_id: Optional[uuid.UUID] = None
    ) -> VendorDetailResponse:
        """获取商家详情"""
        # 尝试从缓存获取
        cache_key = self._get_cache_key(
            "vendor", vendor_id, str(user_id) if user_id else "anonymous"
        )
        cached = await self._get_from_cache(cache_key)
        if cached:
            return VendorDetailResponse(**cached)

        # 从数据库获取
        vendor = await self._get_vendor_by_id(session, vendor_id, include_products=True)
        if not vendor:
            raise VendorNotFoundError(f"商家不存在: {vendor_id}")

        # 构建响应
        vendor_schema = vendor.to_schema()

        # 获取商品列表
        products = []
        for product in vendor.products:
            if not product.is_deleted and product.status == ProductStatus.PUBLISHED:
                item = ProductListItem(
                    id=str(product.id),
                    name=product.name,
                    slug=product.slug,
                    short_description=product.short_description,
                    product_type=product.product_type,
                    category=product.category,
                    logo_url=product.logo_url,
                    cover_url=product.cover_url,
                    pricing=PricingInfo(**product.pricing_info),
                    average_rating=product.average_rating,
                    rating_count=product.rating_count,
                    download_count=product.download_count,
                    is_featured=product.is_featured,
                    is_verified=product.is_verified,
                    vendor_name=vendor.display_name,
                    created_at=product.created_at,
                )
                products.append(item)

        # 获取最近评价（基于商品评价）
        recent_reviews = await self._get_vendor_recent_reviews(
            session, vendor_id, limit=5
        )

        # 检查是否关注
        is_following = False
        if user_id:
            # 这里可以检查用户是否关注了商家
            pass

        response = VendorDetailResponse(
            **vendor_schema.dict(),
            products=products,
            recent_reviews=recent_reviews,
            is_following=is_following,
        )

        # 缓存结果
        await self._set_to_cache(cache_key, response.dict(), ttl=1800)

        return response

    async def verify_vendor(
        self,
        session: AsyncSession,
        vendor_id: str,
        level: int = 1,
        admin_user_id: uuid.UUID = None,
    ) -> bool:
        """认证商家"""
        try:
            vendor = await self._get_vendor_by_id(session, vendor_id)
            if not vendor:
                raise VendorNotFoundError(f"商家不存在: {vendor_id}")

            # 这里可以添加管理员权限检查
            # if not await self._is_admin(admin_user_id):
            #     raise InsufficientPermissionError("需要管理员权限")

            vendor.verify(level)
            await session.commit()

            # 清除缓存
            await self._clear_vendor_caches(vendor_id)

            return True

        except Exception as e:
            await session.rollback()
            self.logger.error(f"商家认证失败: {e}")
            raise

    # ======================== 订单管理 ========================

    async def create_order(
        self, session: AsyncSession, request: OrderCreateRequest, user_id: uuid.UUID
    ) -> OrderDetailResponse:
        """创建订单"""
        try:
            # 验证订单项目
            if not validate_order_items(request.items):
                raise MarketplaceError("订单项目无效")

            # 获取商品信息并验证
            products_info = {}
            vendor_ids = set()

            for item in request.items:
                product = await self._get_product_by_id(session, item["product_id"])
                if not product:
                    raise ProductNotFoundError(f"商品不存在: {item['product_id']}")

                if product.status != ProductStatus.PUBLISHED:
                    raise MarketplaceError(f"商品不可购买: {product.name}")

                products_info[item["product_id"]] = product
                vendor_ids.add(str(product.vendor_id))

            # 目前简化为单商家订单，如果是多商家需要分拆订单
            if len(vendor_ids) > 1:
                raise MarketplaceError("暂不支持多商家订单，请分别下单")

            vendor_id = list(vendor_ids)[0]

            # 生成订单号
            order_number = generate_order_number()

            # 创建订单
            order = OrderModel(
                order_number=order_number,
                buyer_id=user_id,
                vendor_id=uuid.UUID(vendor_id),
                delivery_method=request.delivery_method,
                delivery_address=request.delivery_address,
                buyer_notes=request.buyer_notes,
                payment_method=request.payment_method,
            )
            session.add(order)
            await session.flush()

            # 创建订单项目
            subtotal = Decimal("0")
            for item in request.items:
                product = products_info[item["product_id"]]

                # 获取实际价格（考虑活动折扣）
                final_price = get_product_final_price(product)

                order_item = OrderItemModel(
                    order_id=order.id,
                    product_id=uuid.UUID(item["product_id"]),
                    product_name=product.name,
                    product_version=product.version,
                    product_type=product.product_type,
                    quantity=item.get("quantity", 1),
                    price_amount=final_price.amount,
                    price_currency=final_price.currency.value,
                    license_info=item.get("license_info"),
                    metadata=item.get("metadata", {}),
                )
                session.add(order_item)
                subtotal += final_price.amount * item.get("quantity", 1)

            # 计算订单总额
            order.subtotal_amount = subtotal
            order.total_amount = subtotal  # 暂时不考虑税费
            order.calculate_totals()

            await session.commit()

            # 清除相关缓存
            await self._clear_order_caches(str(order.id))

            return await self.get_order_detail(session, str(order.id), user_id)

        except Exception as e:
            await session.rollback()
            self.logger.error(f"创建订单失败: {e}")
            raise

    async def get_order_detail(
        self, session: AsyncSession, order_id: str, user_id: uuid.UUID
    ) -> OrderDetailResponse:
        """获取订单详情"""
        order = await self._get_order_by_id(session, order_id, include_all=True)
        if not order:
            raise OrderNotFoundError(f"订单不存在: {order_id}")

        # 验证权限
        if order.buyer_id != user_id and order.vendor.user_id != user_id:
            raise InsufficientPermissionError("无权查看此订单")

        # 构建响应
        order_schema = order.to_schema()

        # 获取买家信息（需要用户服务支持）
        # buyer = await self._get_user_profile(order.buyer_id)

        # 获取商家信息
        vendor_info = VendorListItem(
            id=str(order.vendor.id),
            name=order.vendor.name,
            display_name=order.vendor.display_name,
            vendor_type=order.vendor.vendor_type,
            logo_url=order.vendor.logo_url,
            product_count=order.vendor.product_count,
            average_rating=order.vendor.average_rating,
            rating_count=order.vendor.rating_count,
            is_verified=order.vendor.is_verified,
            verification_level=order.vendor.verification_level,
            joined_at=order.vendor.joined_at,
        )

        # 获取支付记录
        payment_history = []
        for payment in order.payments:
            payment_item = PaymentListItem(
                id=str(payment.id),
                transaction_id=payment.transaction_id,
                amount=MoneyAmount(amount=payment.amount, currency=payment.currency),
                method=payment.method,
                status=payment.status,
                created_at=payment.created_at,
                paid_at=payment.paid_at,
            )
            payment_history.append(payment_item)

        # 检查操作权限
        can_cancel = order.can_cancel() and order.buyer_id == user_id
        can_refund = order.can_refund() and order.buyer_id == user_id

        response = OrderDetailResponse(
            **order_schema.dict(),
            # buyer=buyer,
            vendor=vendor_info,
            product_details=[item.to_dict() for item in order.items],
            payment_history=payment_history,
            can_cancel=can_cancel,
            can_refund=can_refund,
        )

        return response

    async def cancel_order(
        self,
        session: AsyncSession,
        order_id: str,
        user_id: uuid.UUID,
        reason: str = None,
    ) -> bool:
        """取消订单"""
        try:
            order = await self._get_order_by_id(session, order_id)
            if not order:
                raise OrderNotFoundError(f"订单不存在: {order_id}")

            # 验证权限
            if order.buyer_id != user_id:
                raise InsufficientPermissionError("无权取消此订单")

            # 检查是否可以取消
            if not order.can_cancel():
                raise MarketplaceError("订单状态不允许取消")

            # 取消订单
            order.status = OrderStatus.CANCELLED
            order.updated_at = func.now()

            # 如果已支付，需要处理退款
            if order.payment_status == PaymentStatus.SUCCESS:
                await self._process_refund(session, order, reason)

            await session.commit()

            # 清除缓存
            await self._clear_order_caches(order_id)

            return True

        except Exception as e:
            await session.rollback()
            self.logger.error(f"取消订单失败: {e}")
            raise

    # ======================== 支付管理 ========================

    async def create_payment(
        self, session: AsyncSession, request: PaymentCreateRequest, user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """创建支付"""
        try:
            order = await self._get_order_by_id(session, request.order_id)
            if not order:
                raise OrderNotFoundError(f"订单不存在: {request.order_id}")

            # 验证权限
            if order.buyer_id != user_id:
                raise InsufficientPermissionError("无权支付此订单")

            # 验证订单状态
            if order.status not in [OrderStatus.PENDING, OrderStatus.CONFIRMED]:
                raise PaymentError("订单状态不允许支付")

            if order.payment_status == PaymentStatus.SUCCESS:
                raise PaymentError("订单已支付")

            # 生成交易号
            transaction_id = f"PAY{int(time.time())}{uuid.uuid4().hex[:8].upper()}"

            # 创建支付记录
            payment = PaymentModel(
                order_id=uuid.UUID(request.order_id),
                transaction_id=transaction_id,
                amount=order.total_amount,
                currency=order.total_currency,
                method=request.method,
                gateway=self._get_payment_gateway_name(request.method),
            )
            session.add(payment)
            await session.flush()

            # 调用支付网关
            gateway_response = await self._call_payment_gateway(
                payment, request.return_url, request.cancel_url
            )

            payment.gateway_response = gateway_response
            await session.commit()

            # 清除缓存
            await self._clear_order_caches(request.order_id)

            return {
                "payment_id": str(payment.id),
                "transaction_id": transaction_id,
                "gateway_response": gateway_response,
            }

        except Exception as e:
            await session.rollback()
            self.logger.error(f"创建支付失败: {e}")
            raise

    async def process_payment_callback(
        self, session: AsyncSession, transaction_id: str, gateway_data: Dict[str, Any]
    ) -> bool:
        """处理支付回调"""
        try:
            # 获取支付记录
            result = await session.execute(
                select(PaymentModel).where(
                    PaymentModel.transaction_id == transaction_id
                )
            )
            payment = result.scalar_one_or_none()

            if not payment:
                self.logger.warning(f"支付记录不存在: {transaction_id}")
                return False

            # 验证支付结果
            if await self._verify_payment_callback(payment, gateway_data):
                # 支付成功
                payment.mark_success()
                payment.gateway_response.update(gateway_data)

                # 更新订单状态
                order = await self._get_order_by_id(session, str(payment.order_id))
                if order:
                    order.mark_paid()

                    # 增加商品购买次数
                    for item in order.items:
                        product = await self._get_product_by_id(
                            session, str(item.product_id)
                        )
                        if product:
                            product.increment_purchase()

                    # 创建交易记录
                    await self._create_transaction_record(
                        session,
                        order.buyer_id,
                        order,
                        TransactionType.PURCHASE,
                        order.total_amount,
                        order.total_currency,
                    )

                await session.commit()

                # 清除缓存
                await self._clear_order_caches(str(payment.order_id))

                return True
            else:
                # 支付失败
                payment.mark_failed()
                payment.gateway_response.update(gateway_data)
                await session.commit()

                return False

        except Exception as e:
            await session.rollback()
            self.logger.error(f"处理支付回调失败: {e}")
            raise

    # ======================== 评价管理 ========================

    async def create_review(
        self, session: AsyncSession, request: ReviewCreateRequest, user_id: uuid.UUID
    ) -> ReviewDetailResponse:
        """创建商品评价"""
        try:
            # 检查商品是否存在
            product = await self._get_product_by_id(session, request.product_id)
            if not product:
                raise ProductNotFoundError(f"商品不存在: {request.product_id}")

            # 检查是否已经评价过
            existing = await session.execute(
                select(ReviewModel).where(
                    ReviewModel.product_id == uuid.UUID(request.product_id),
                    ReviewModel.user_id == user_id,
                )
            )
            if existing.scalar_one_or_none():
                raise MarketplaceError("您已经评价过此商品")

            # 验证是否为已验证购买
            is_verified_purchase = False
            if request.order_id:
                order = await self._get_order_by_id(session, request.order_id)
                if (
                    order
                    and order.buyer_id == user_id
                    and order.status == OrderStatus.COMPLETED
                ):
                    # 检查订单中是否包含此商品
                    for item in order.items:
                        if str(item.product_id) == request.product_id:
                            is_verified_purchase = True
                            break

            # 创建评价
            review_data = request.dict()
            review_data["user_id"] = str(user_id)
            review_data["is_verified_purchase"] = is_verified_purchase
            review_data["status"] = (
                ReviewStatus.PUBLISHED
                if self.config.review_auto_publish
                else ReviewStatus.PENDING
            )

            review = ReviewModel(**review_data)
            session.add(review)
            await session.flush()

            # 更新商品评分
            product.update_rating()

            await session.commit()

            # 清除相关缓存
            await self._clear_product_caches(request.product_id)
            await self._clear_review_caches(str(review.id))

            return await self.get_review_detail(session, str(review.id))

        except Exception as e:
            await session.rollback()
            self.logger.error(f"创建评价失败: {e}")
            raise

    async def get_review_detail(
        self, session: AsyncSession, review_id: str
    ) -> ReviewDetailResponse:
        """获取评价详情"""
        review = await self._get_review_by_id(session, review_id, include_all=True)
        if not review:
            raise MarketplaceError(f"评价不存在: {review_id}")

        # 构建响应
        review_schema = review.to_schema()

        # 获取用户信息（需要用户服务支持）
        # user = await self._get_user_profile(review.user_id)

        # 获取商品信息
        product_info = ProductListItem(
            id=str(review.product.id),
            name=review.product.name,
            slug=review.product.slug,
            short_description=review.product.short_description,
            product_type=review.product.product_type,
            category=review.product.category,
            logo_url=review.product.logo_url,
            cover_url=review.product.cover_url,
            pricing=PricingInfo(**review.product.pricing_info),
            average_rating=review.product.average_rating,
            rating_count=review.product.rating_count,
            download_count=review.product.download_count,
            is_featured=review.product.is_featured,
            is_verified=review.product.is_verified,
            vendor_name=review.product.vendor.display_name,
            created_at=review.product.created_at,
        )

        # 获取回复列表（如果有）
        replies = []  # 可以扩展评价回复功能

        response = ReviewDetailResponse(
            **review_schema.dict(),
            # user=user,
            product=product_info,
            replies=replies,
            is_helpful=False,  # 需要检查当前用户是否认为有用
        )

        return response

    # ======================== 营销活动管理 ========================

    async def create_campaign(
        self, session: AsyncSession, request: CampaignCreateRequest, user_id: uuid.UUID
    ) -> Campaign:
        """创建营销活动"""
        try:
            # 这里可以添加权限检查，比如只有管理员或商家可以创建活动

            # 验证时间范围
            if request.start_time >= request.end_time:
                raise MarketplaceError("开始时间必须早于结束时间")

            # 创建活动
            campaign_data = request.dict()
            if "discount_amount" in campaign_data and campaign_data["discount_amount"]:
                campaign_data["discount_amount"] = campaign_data[
                    "discount_amount"
                ].amount
                campaign_data["discount_currency"] = campaign_data[
                    "discount_amount"
                ].currency

            campaign = CampaignModel(**campaign_data)
            session.add(campaign)
            await session.flush()

            # 关联适用商品
            if request.applicable_products:
                for product_id in request.applicable_products:
                    product = await self._get_product_by_id(session, product_id)
                    if product:
                        campaign.applicable_products.append(product)

            await session.commit()

            # 清除相关缓存
            await self._clear_campaign_caches()

            return campaign.to_schema()

        except Exception as e:
            await session.rollback()
            self.logger.error(f"创建活动失败: {e}")
            raise

    async def get_active_campaigns(
        self, session: AsyncSession, product_id: str = None
    ) -> List[Campaign]:
        """获取活跃的营销活动"""
        now = datetime.now()

        query = select(CampaignModel).where(
            CampaignModel.is_active == True,
            CampaignModel.start_time <= now,
            CampaignModel.end_time >= now,
        )

        if product_id:
            # 可以添加商品相关的活动过滤
            pass

        result = await session.execute(query)
        campaigns = result.scalars().all()

        return [campaign.to_schema() for campaign in campaigns if campaign.can_use()]

    # ======================== 统计分析 ========================

    async def get_marketplace_stats(
        self, session: AsyncSession, admin_user_id: uuid.UUID = None
    ) -> MarketplaceStats:
        """获取市场统计信息"""
        # 检查缓存
        cache_key = self._get_cache_key("marketplace_stats")
        cached_stats = await self._get_from_cache(cache_key)
        if cached_stats:
            return MarketplaceStats(**cached_stats)

        # 计算统计数据
        now = datetime.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        # 总体统计
        total_products_result = await session.execute(
            select(func.count(ProductModel.id)).where(
                ProductModel.is_deleted == False,
                ProductModel.status == ProductStatus.PUBLISHED,
            )
        )
        total_products = total_products_result.scalar()

        total_vendors_result = await session.execute(
            select(func.count(VendorModel.id)).where(
                VendorModel.status == VendorStatus.ACTIVE
            )
        )
        total_vendors = total_vendors_result.scalar()

        total_orders_result = await session.execute(select(func.count(OrderModel.id)))
        total_orders = total_orders_result.scalar()

        total_revenue_result = await session.execute(
            select(func.sum(OrderModel.total_amount)).where(
                OrderModel.payment_status == PaymentStatus.SUCCESS
            )
        )
        total_revenue = total_revenue_result.scalar() or Decimal("0")

        # 时间段统计
        products_today_result = await session.execute(
            select(func.count(ProductModel.id)).where(
                ProductModel.created_at >= today, ProductModel.is_deleted == False
            )
        )
        products_today = products_today_result.scalar()

        # 构建统计响应
        stats = MarketplaceStats(
            total_products=total_products,
            total_vendors=total_vendors,
            total_orders=total_orders,
            total_revenue=MoneyAmount(amount=total_revenue, currency=CurrencyType.CNY),
            products_today=products_today,
            products_this_week=0,  # 可以添加更多统计
            products_this_month=0,
            orders_today=0,
            orders_this_week=0,
            orders_this_month=0,
            revenue_today=MoneyAmount(amount=Decimal("0"), currency=CurrencyType.CNY),
            revenue_this_week=MoneyAmount(
                amount=Decimal("0"), currency=CurrencyType.CNY
            ),
            revenue_this_month=MoneyAmount(
                amount=Decimal("0"), currency=CurrencyType.CNY
            ),
            category_stats={},
            vendor_type_stats={},
            top_products=[],
            top_vendors=[],
            top_categories=[],
        )

        # 缓存结果
        await self._set_to_cache(cache_key, stats.dict(), ttl=300)  # 5分钟

        return stats

    async def get_vendor_stats(
        self, session: AsyncSession, vendor_id: str, user_id: uuid.UUID
    ) -> VendorStats:
        """获取商家统计信息"""
        vendor = await self._get_vendor_by_id(session, vendor_id)
        if not vendor:
            raise VendorNotFoundError(f"商家不存在: {vendor_id}")

        # 验证权限
        if vendor.user_id != user_id:
            raise InsufficientPermissionError("无权查看此商家统计")

        # 检查缓存
        cache_key = self._get_cache_key("vendor_stats", vendor_id)
        cached_stats = await self._get_from_cache(cache_key)
        if cached_stats:
            return VendorStats(**cached_stats)

        # 计算统计数据
        now = datetime.now()
        month_ago = now - timedelta(days=30)

        # 商品统计
        published_products_result = await session.execute(
            select(func.count(ProductModel.id)).where(
                ProductModel.vendor_id == uuid.UUID(vendor_id),
                ProductModel.status == ProductStatus.PUBLISHED,
                ProductModel.is_deleted == False,
            )
        )
        published_products = published_products_result.scalar()

        draft_products_result = await session.execute(
            select(func.count(ProductModel.id)).where(
                ProductModel.vendor_id == uuid.UUID(vendor_id),
                ProductModel.status == ProductStatus.DRAFT,
                ProductModel.is_deleted == False,
            )
        )
        draft_products = draft_products_result.scalar()

        # 订单统计
        completed_orders_result = await session.execute(
            select(func.count(OrderModel.id)).where(
                OrderModel.vendor_id == uuid.UUID(vendor_id),
                OrderModel.status == OrderStatus.COMPLETED,
            )
        )
        completed_orders = completed_orders_result.scalar()

        pending_orders_result = await session.execute(
            select(func.count(OrderModel.id)).where(
                OrderModel.vendor_id == uuid.UUID(vendor_id),
                OrderModel.status.in_(
                    [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PAID]
                ),
            )
        )
        pending_orders = pending_orders_result.scalar()

        # 收入统计
        this_month_revenue_result = await session.execute(
            select(func.sum(OrderModel.total_amount)).where(
                OrderModel.vendor_id == uuid.UUID(vendor_id),
                OrderModel.payment_status == PaymentStatus.SUCCESS,
                OrderModel.paid_at >= month_ago,
            )
        )
        this_month_revenue = this_month_revenue_result.scalar() or Decimal("0")

        stats = VendorStats(
            total_products=vendor.product_count,
            published_products=published_products,
            draft_products=draft_products,
            total_orders=vendor.total_orders,
            completed_orders=completed_orders,
            pending_orders=pending_orders,
            total_revenue=MoneyAmount(
                amount=vendor.total_sales_amount, currency=vendor.total_sales_currency
            ),
            this_month_revenue=MoneyAmount(
                amount=this_month_revenue, currency=CurrencyType.CNY
            ),
            average_rating=vendor.average_rating,
            total_reviews=vendor.rating_count,
            top_products=[],
            revenue_trend=[],
        )

        # 缓存结果
        await self._set_to_cache(cache_key, stats.dict(), ttl=600)  # 10分钟

        return stats

    # ======================== 私有辅助方法 ========================

    async def _get_product_by_id(
        self, session: AsyncSession, product_id: str, include_vendor: bool = False
    ) -> Optional[ProductModel]:
        """根据ID获取商品"""
        query = select(ProductModel).where(
            ProductModel.id == uuid.UUID(product_id), ProductModel.is_deleted == False
        )

        if include_vendor:
            query = query.options(selectinload(ProductModel.vendor))

        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def _get_vendor_by_id(
        self, session: AsyncSession, vendor_id: str, include_products: bool = False
    ) -> Optional[VendorModel]:
        """根据ID获取商家"""
        query = select(VendorModel).where(VendorModel.id == uuid.UUID(vendor_id))

        if include_products:
            query = query.options(selectinload(VendorModel.products))

        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def _get_vendor_by_user_id(
        self, session: AsyncSession, user_id: uuid.UUID
    ) -> Optional[VendorModel]:
        """根据用户ID获取商家"""
        result = await session.execute(
            select(VendorModel).where(VendorModel.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def _get_order_by_id(
        self, session: AsyncSession, order_id: str, include_all: bool = False
    ) -> Optional[OrderModel]:
        """根据ID获取订单"""
        query = select(OrderModel).where(OrderModel.id == uuid.UUID(order_id))

        if include_all:
            query = query.options(
                selectinload(OrderModel.vendor),
                selectinload(OrderModel.items),
                selectinload(OrderModel.payments),
            )

        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def _get_review_by_id(
        self, session: AsyncSession, review_id: str, include_all: bool = False
    ) -> Optional[ReviewModel]:
        """根据ID获取评价"""
        query = select(ReviewModel).where(ReviewModel.id == uuid.UUID(review_id))

        if include_all:
            query = query.options(
                selectinload(ReviewModel.product).selectinload(ProductModel.vendor)
            )

        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def _can_user_manage_product(
        self, session: AsyncSession, user_id: uuid.UUID, product: ProductModel
    ) -> bool:
        """检查用户是否可以管理商品"""
        vendor = await self._get_vendor_by_user_id(session, user_id)
        if not vendor:
            return False

        return vendor.id == product.vendor_id

    async def _get_recent_reviews(
        self, session: AsyncSession, product_id: str, limit: int = 5
    ) -> List[ReviewListItem]:
        """获取商品最近评价"""
        result = await session.execute(
            select(ReviewModel)
            .where(
                ReviewModel.product_id == uuid.UUID(product_id),
                ReviewModel.status == ReviewStatus.PUBLISHED,
            )
            .order_by(desc(ReviewModel.created_at))
            .limit(limit)
        )
        reviews = result.scalars().all()

        items = []
        for review in reviews:
            item = ReviewListItem(
                id=str(review.id),
                rating=review.rating,
                title=review.title,
                content=review.content,
                user_name="匿名用户" if review.is_anonymous else "用户",  # 需要用户服务支持
                user_avatar=None,
                is_verified_purchase=review.is_verified_purchase,
                helpful_count=review.helpful_count,
                created_at=review.created_at,
            )
            items.append(item)

        return items

    async def _get_related_products(
        self, session: AsyncSession, product: ProductModel, limit: int = 6
    ) -> List[ProductListItem]:
        """获取相关商品"""
        # 基于分类和商家获取相关商品
        result = await session.execute(
            select(ProductModel)
            .where(
                ProductModel.id != product.id,
                ProductModel.is_deleted == False,
                ProductModel.status == ProductStatus.PUBLISHED,
                or_(
                    ProductModel.category == product.category,
                    ProductModel.vendor_id == product.vendor_id,
                ),
            )
            .order_by(desc(ProductModel.average_rating))
            .limit(limit)
            .options(selectinload(ProductModel.vendor))
        )
        products = result.scalars().all()

        items = []
        for p in products:
            item = ProductListItem(
                id=str(p.id),
                name=p.name,
                slug=p.slug,
                short_description=p.short_description,
                product_type=p.product_type,
                category=p.category,
                logo_url=p.logo_url,
                cover_url=p.cover_url,
                pricing=PricingInfo(**p.pricing_info),
                average_rating=p.average_rating,
                rating_count=p.rating_count,
                download_count=p.download_count,
                is_featured=p.is_featured,
                is_verified=p.is_verified,
                vendor_name=p.vendor.display_name,
                created_at=p.created_at,
            )
            items.append(item)

        return items

    async def _get_vendor_recent_reviews(
        self, session: AsyncSession, vendor_id: str, limit: int = 5
    ) -> List[ReviewListItem]:
        """获取商家最近评价"""
        result = await session.execute(
            select(ReviewModel)
            .join(ProductModel)
            .where(
                ProductModel.vendor_id == uuid.UUID(vendor_id),
                ReviewModel.status == ReviewStatus.PUBLISHED,
            )
            .order_by(desc(ReviewModel.created_at))
            .limit(limit)
        )
        reviews = result.scalars().all()

        items = []
        for review in reviews:
            item = ReviewListItem(
                id=str(review.id),
                rating=review.rating,
                title=review.title,
                content=review.content,
                user_name="匿名用户" if review.is_anonymous else "用户",
                user_avatar=None,
                is_verified_purchase=review.is_verified_purchase,
                helpful_count=review.helpful_count,
                created_at=review.created_at,
            )
            items.append(item)

        return items

    def _get_payment_gateway_name(self, method: PaymentMethod) -> str:
        """获取支付网关名称"""
        gateway_info = self._payment_gateways.get(method, {})
        return gateway_info.get("name", method.value)

    async def _call_payment_gateway(
        self, payment: PaymentModel, return_url: str = None, cancel_url: str = None
    ) -> Dict[str, Any]:
        """调用支付网关"""
        # 这里是支付网关集成的示例代码
        # 实际实现需要根据具体的支付网关API进行集成

        if payment.method == PaymentMethod.ALIPAY:
            return await self._call_alipay_gateway(payment, return_url, cancel_url)
        elif payment.method == PaymentMethod.WECHAT_PAY:
            return await self._call_wechat_gateway(payment, return_url, cancel_url)
        elif payment.method == PaymentMethod.PAYPAL:
            return await self._call_paypal_gateway(payment, return_url, cancel_url)
        else:
            return {
                "status": "pending",
                "payment_url": f"/payment/{payment.transaction_id}",
                "message": "请前往支付页面完成支付",
            }

    async def _call_alipay_gateway(
        self, payment: PaymentModel, return_url: str = None, cancel_url: str = None
    ) -> Dict[str, Any]:
        """调用支付宝网关"""
        # 支付宝SDK集成示例
        return {
            "status": "pending",
            "payment_url": f"https://openapi.alipay.com/gateway.do?{payment.transaction_id}",
            "qr_code": f"alipay://pay?id={payment.transaction_id}",
            "message": "请使用支付宝扫码支付",
        }

    async def _call_wechat_gateway(
        self, payment: PaymentModel, return_url: str = None, cancel_url: str = None
    ) -> Dict[str, Any]:
        """调用微信支付网关"""
        # 微信支付SDK集成示例
        return {
            "status": "pending",
            "payment_url": f"weixin://wxpay/bizpayurl?pr={payment.transaction_id}",
            "qr_code": f"wxpay://pay?id={payment.transaction_id}",
            "message": "请使用微信扫码支付",
        }

    async def _call_paypal_gateway(
        self, payment: PaymentModel, return_url: str = None, cancel_url: str = None
    ) -> Dict[str, Any]:
        """调用PayPal网关"""
        # PayPal SDK集成示例
        return {
            "status": "pending",
            "payment_url": f"https://www.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token={payment.transaction_id}",
            "message": "Redirecting to PayPal...",
        }

    async def _verify_payment_callback(
        self, payment: PaymentModel, gateway_data: Dict[str, Any]
    ) -> bool:
        """验证支付回调"""
        # 这里实现支付回调验证逻辑
        # 需要根据不同的支付网关进行签名验证

        if payment.method == PaymentMethod.ALIPAY:
            return self._verify_alipay_callback(payment, gateway_data)
        elif payment.method == PaymentMethod.WECHAT_PAY:
            return self._verify_wechat_callback(payment, gateway_data)
        elif payment.method == PaymentMethod.PAYPAL:
            return self._verify_paypal_callback(payment, gateway_data)

        # 默认返回True用于测试，实际应该根据具体业务逻辑验证
        return gateway_data.get("status") == "success"

    def _verify_alipay_callback(
        self, payment: PaymentModel, gateway_data: Dict[str, Any]
    ) -> bool:
        """验证支付宝回调"""
        # 实现支付宝回调验证逻辑
        return True

    def _verify_wechat_callback(
        self, payment: PaymentModel, gateway_data: Dict[str, Any]
    ) -> bool:
        """验证微信支付回调"""
        # 实现微信支付回调验证逻辑
        return True

    def _verify_paypal_callback(
        self, payment: PaymentModel, gateway_data: Dict[str, Any]
    ) -> bool:
        """验证PayPal回调"""
        # 实现PayPal回调验证逻辑
        return True

    async def _process_refund(
        self, session: AsyncSession, order: OrderModel, reason: str = None
    ) -> bool:
        """处理退款"""
        try:
            # 找到成功的支付记录
            successful_payment = None
            for payment in order.payments:
                if payment.status == PaymentStatus.SUCCESS:
                    successful_payment = payment
                    break

            if not successful_payment:
                return False

            # 创建退款记录（这里简化处理）
            refund_transaction_id = (
                f"REF{int(time.time())}{uuid.uuid4().hex[:8].upper()}"
            )

            # 调用支付网关退款接口
            refund_result = await self._call_refund_gateway(
                successful_payment, refund_transaction_id, reason
            )

            if refund_result.get("success"):
                # 更新支付状态
                successful_payment.status = PaymentStatus.REFUNDED

                # 创建退款交易记录
                await self._create_transaction_record(
                    session,
                    order.buyer_id,
                    order,
                    TransactionType.REFUND,
                    order.total_amount,
                    order.total_currency,
                )

                return True

            return False

        except Exception as e:
            self.logger.error(f"处理退款失败: {e}")
            return False

    async def _call_refund_gateway(
        self, payment: PaymentModel, refund_transaction_id: str, reason: str = None
    ) -> Dict[str, Any]:
        """调用退款网关"""
        # 实现退款网关调用逻辑
        return {"success": True, "refund_id": refund_transaction_id}

    async def _create_transaction_record(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        order: OrderModel,
        transaction_type: TransactionType,
        amount: Decimal,
        currency: str,
    ) -> TransactionModel:
        """创建交易记录"""
        # 获取用户当前余额（这里简化处理）
        balance_before = Decimal("0")
        balance_after = balance_before

        if transaction_type == TransactionType.PURCHASE:
            balance_after = balance_before - amount
            title = f"购买商品 - 订单号: {order.order_number}"
        elif transaction_type == TransactionType.REFUND:
            balance_after = balance_before + amount
            title = f"订单退款 - 订单号: {order.order_number}"
        else:
            title = f"交易 - 订单号: {order.order_number}"

        transaction = TransactionModel(
            user_id=user_id,
            order_id=order.id,
            transaction_type=transaction_type,
            amount=amount,
            currency=currency,
            balance_before=balance_before,
            balance_after=balance_after,
            title=title,
            description=f"订单 {order.order_number} 相关交易",
        )

        session.add(transaction)
        return transaction

    # ======================== 缓存清理方法 ========================

    async def _clear_product_caches(self, product_id: str):
        """清除商品相关缓存"""
        patterns = [
            self._get_cache_key("product", product_id, "*"),
            self._get_cache_key("marketplace_stats"),
        ]

        for pattern in patterns:
            await self._delete_cache_pattern(pattern)

    async def _clear_vendor_caches(self, vendor_id: str):
        """清除商家相关缓存"""
        patterns = [
            self._get_cache_key("vendor", vendor_id, "*"),
            self._get_cache_key("vendor_stats", vendor_id),
            self._get_cache_key("marketplace_stats"),
        ]

        for pattern in patterns:
            await self._delete_cache_pattern(pattern)

    async def _clear_order_caches(self, order_id: str):
        """清除订单相关缓存"""
        patterns = [
            self._get_cache_key("order", order_id, "*"),
            self._get_cache_key("marketplace_stats"),
        ]

        for pattern in patterns:
            await self._delete_cache_pattern(pattern)

    async def _clear_review_caches(self, review_id: str):
        """清除评价相关缓存"""
        patterns = [
            self._get_cache_key("review", review_id, "*"),
        ]

        for pattern in patterns:
            await self._delete_cache_pattern(pattern)

    async def _clear_campaign_caches(self):
        """清除活动相关缓存"""
        patterns = [
            self._get_cache_key("campaign", "*"),
            self._get_cache_key("active_campaigns", "*"),
        ]

        for pattern in patterns:
            await self._delete_cache_pattern(pattern)

    # ======================== 健康检查和维护 ========================

    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        return {
            "service": "marketplace",
            "status": "healthy",
            "database": HAS_DATABASE,
            "cache": self._cache_enabled,
            "config": {
                "default_page_size": self.config.default_page_size,
                "max_page_size": self.config.max_page_size,
                "cache_ttl": self.config.cache_ttl,
            },
        }

    async def get_service_info(self) -> Dict[str, Any]:
        """获取服务信息"""
        return {
            "name": "Marketplace Service",
            "version": "1.0.0",
            "description": "数字商品市场管理服务",
            "features": [
                "商品管理",
                "商家管理",
                "订单系统",
                "支付集成",
                "评价系统",
                "营销活动",
                "统计分析",
                "财务管理",
            ],
            "dependencies": {
                "sqlalchemy": HAS_SQLALCHEMY,
                "redis": HAS_REDIS,
                "database": HAS_DATABASE,
            },
        }


# ======================== 导出 ========================

__all__ = [
    "MarketplaceService",
    "MarketplaceConfig",
    "MarketplaceError",
    "ProductNotFoundError",
    "VendorNotFoundError",
    "OrderNotFoundError",
    "PaymentError",
    "InsufficientPermissionError",
    "InvalidPricingError",
    "CampaignNotFoundError",
    "InsufficientBalanceError",
]
