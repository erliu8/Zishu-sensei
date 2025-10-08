# ! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
适配器市场路由系统 - Zishu-sensei
提供全面的数字商品市场功能，包含适配器交易、订单管理、支付系统、评价体系、商家管理等功能
专注于AI适配器的销售和分发平台
"""

import asyncio
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Literal
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request,
    Response,
    BackgroundTasks,
    Query,
    Path,
    Body,
    File,
    UploadFile,
)
from fastapi.responses import JSONResponse
import logging
from cachetools import TTLCache

from ..dependencies import get_logger, get_config
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
    MarketplaceStats,
    VendorStats,
    # 基础模型
    Product,
    Vendor,
    Order,
    Payment,
    Review,
    Transaction,
    Campaign,
    MoneyAmount,
    # 辅助函数
    generate_order_number,
    calculate_discount_amount,
    validate_product_pricing,
    calculate_commission,
    is_campaign_active,
    get_product_final_price,
    validate_order_items,
    create_product_slug,
)
from ..schemas.adapter import (
    AdapterType,
    AdapterStatus,
    AdapterMetadata,
    AdapterInfo,
    AdapterValidationResult,
    validate_adapter_metadata,
    validate_adapter_file_integrity,
)
from ..schemas.responses import BaseResponse, ErrorResponse
from ..security import SecurityManager, SecurityContext, PermissionType
from ..auth import require_auth, require_permission, get_current_user_info

# 路由器配置
router = APIRouter(
    prefix="/marketplace",
    tags=["marketplace"],
    responses={
        401: {"description": "未授权访问"},
        403: {"description": "权限不足"},
        404: {"description": "资源不存在"},
        422: {"description": "参数验证失败"},
        429: {"description": "请求过于频繁"},
        500: {"description": "服务器内部错误"},
    },
)

# 全局缓存配置
CACHE_TTL = 3600  # 1小时缓存
CACHE_SHORT_TTL = 300  # 5分钟缓存
product_cache = TTLCache(maxsize=2000, ttl=CACHE_TTL)
vendor_cache = TTLCache(maxsize=500, ttl=CACHE_TTL)
order_cache = TTLCache(maxsize=5000, ttl=CACHE_SHORT_TTL)
review_cache = TTLCache(maxsize=10000, ttl=CACHE_SHORT_TTL)
stats_cache = TTLCache(maxsize=100, ttl=1800)  # 30分钟统计缓存


# 依赖函数
async def get_db_session():
    """获取数据库会话 - 临时Mock实现"""
    # TODO: 实现真实的数据库连接
    from unittest.mock import Mock

    return Mock()


async def get_marketplace_service():
    """获取市场服务 - 临时Mock实现"""
    # TODO: 实现真实的市场服务
    from unittest.mock import Mock

    return Mock()


async def get_payment_service():
    """获取支付服务 - 临时Mock实现"""
    # TODO: 实现真实的支付服务
    from unittest.mock import Mock

    return Mock()


async def get_notification_service():
    """获取通知服务 - 临时Mock实现"""
    # TODO: 实现真实的通知服务
    from unittest.mock import Mock

    return Mock()


async def get_search_service():
    """获取搜索服务 - 临时Mock实现"""
    # TODO: 实现真实的搜索服务
    from unittest.mock import Mock

    return Mock()


async def get_adapter_service():
    """获取适配器服务 - 临时Mock实现"""
    # TODO: 实现真实的适配器服务
    from unittest.mock import Mock

    return Mock()


def require_vendor_permission(required_role: str = "vendor"):
    """需要商家权限的依赖"""

    def dependency(
        current_user: SecurityContext = Depends(require_auth),
        db: Session = Depends(get_db_session),
    ):
        # TODO: 从数据库检查用户是否是认证商家
        # vendor = get_vendor_by_user_id(db, current_user.user_id)
        # if not vendor or vendor.status != VendorStatus.ACTIVE:
        #     raise HTTPException(403, "需要商家权限")
        return current_user

    return dependency


# 工具函数
def calculate_platform_commission(
    amount: MoneyAmount, rate: float = 0.05
) -> MoneyAmount:
    """计算平台佣金"""
    return calculate_commission(amount, rate)


def validate_product_data(product_data: dict) -> List[str]:
    """验证商品数据"""
    errors = []

    # 基本字段验证
    if not product_data.get("name", "").strip():
        errors.append("商品名称不能为空")

    if not product_data.get("description", "").strip():
        errors.append("商品描述不能为空")

    if len(product_data.get("description", "")) < 10:
        errors.append("商品描述至少需要10个字符")

    # 价格验证
    pricing = product_data.get("pricing")
    if pricing and not validate_product_pricing(pricing):
        errors.append("商品定价配置无效")

    return errors


def sanitize_product_content(content: str) -> str:
    """清理商品内容"""
    # TODO: 实现更严格的内容过滤
    return content.strip()


async def send_marketplace_notification(
    user_id: str,
    notification_type: str,
    title: str,
    content: str,
    data: Dict[str, Any] = None,
    notification_service=None,
):
    """发送市场通知"""
    if notification_service:
        # TODO: 实现真实的通知发送逻辑
        pass


def generate_download_token(product_id: str, user_id: str) -> str:
    """生成下载令牌"""
    import hashlib
    import time

    token_data = f"{product_id}:{user_id}:{int(time.time())}"
    return hashlib.sha256(token_data.encode()).hexdigest()[:32]


# ======================== 商品管理路由 ========================


@router.get("/", response_model=PaginatedResponse)
async def list_products(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    product_type: Optional[ProductType] = Query(None, description="商品类型"),
    category: Optional[str] = Query(None, description="分类"),
    vendor_id: Optional[str] = Query(None, description="商家ID"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    price_min: Optional[Decimal] = Query(None, ge=0, description="最低价格"),
    price_max: Optional[Decimal] = Query(None, ge=0, description="最高价格"),
    rating_min: Optional[float] = Query(None, ge=0, le=5, description="最低评分"),
    is_free: Optional[bool] = Query(None, description="仅显示免费商品"),
    is_featured: Optional[bool] = Query(None, description="仅显示精选商品"),
    tags: Optional[List[str]] = Query(None, description="标签过滤"),
    sort_by: str = Query("created_at", description="排序字段"),
    sort_order: Literal["asc", "desc"] = Query("desc", description="排序方向"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取商品列表

    支持多种过滤条件、搜索、分页和排序功能
    """
    try:
        # 构建缓存键
        cache_key = f"products:{page}:{size}:{product_type}:{category}:{vendor_id}:{search}:{price_min}:{price_max}:{rating_min}:{is_free}:{is_featured}:{tags}:{sort_by}:{sort_order}"

        # 检查缓存
        if cache_key in product_cache:
            logger.info(f"从缓存返回商品列表: {cache_key}")
            return product_cache[cache_key]

        # TODO: 实现真实的数据库查询逻辑
        # 模拟商品数据
        products = [
            ProductListItem(
                id=str(uuid.uuid4()),
                name="高效对话适配器 Pro",
                slug="efficient-chat-adapter-pro",
                short_description="专为对话场景优化的高性能适配器，支持多轮对话和上下文理解",
                product_type=ProductType.ADAPTER,
                category="对话生成",
                logo_url="https://example.com/adapter-logo-1.png",
                cover_url="https://example.com/adapter-cover-1.jpg",
                pricing={
                    "pricing_model": PricingModel.ONE_TIME,
                    "base_price": {
                        "amount": Decimal("199.00"),
                        "currency": CurrencyType.CNY,
                    },
                    "sale_price": {
                        "amount": Decimal("149.00"),
                        "currency": CurrencyType.CNY,
                    },
                },
                average_rating=4.8,
                rating_count=256,
                download_count=1850,
                is_featured=True,
                is_verified=True,
                vendor_name="AI创新工作室",
                created_at=datetime.now() - timedelta(days=30),
            ),
            ProductListItem(
                id=str(uuid.uuid4()),
                name="开源文本生成适配器",
                slug="open-source-text-generator",
                short_description="完全开源的文本生成适配器，支持自定义训练和微调",
                product_type=ProductType.ADAPTER,
                category="文本生成",
                logo_url="https://example.com/adapter-logo-2.png",
                cover_url="https://example.com/adapter-cover-2.jpg",
                pricing={
                    "pricing_model": PricingModel.FREE,
                    "base_price": {
                        "amount": Decimal("0.00"),
                        "currency": CurrencyType.CNY,
                    },
                },
                average_rating=4.5,
                rating_count=128,
                download_count=3200,
                is_featured=False,
                is_verified=True,
                vendor_name="开源社区",
                created_at=datetime.now() - timedelta(days=15),
            ),
            ProductListItem(
                id=str(uuid.uuid4()),
                name="企业级API接入服务",
                slug="enterprise-api-service",
                short_description="为企业用户提供稳定可靠的API接入服务，包含技术支持",
                product_type=ProductType.SERVICE,
                category="API服务",
                logo_url="https://example.com/service-logo-1.png",
                cover_url="https://example.com/service-cover-1.jpg",
                pricing={
                    "pricing_model": PricingModel.SUBSCRIPTION,
                    "base_price": {
                        "amount": Decimal("999.00"),
                        "currency": CurrencyType.CNY,
                    },
                    "billing_cycle": "monthly",
                },
                average_rating=4.9,
                rating_count=89,
                download_count=450,
                is_featured=True,
                is_verified=True,
                vendor_name="企业服务商",
                created_at=datetime.now() - timedelta(days=7),
            ),
        ]

        # 应用过滤逻辑
        filtered_products = products

        if product_type:
            filtered_products = [
                p for p in filtered_products if p.product_type == product_type
            ]

        if category:
            filtered_products = [p for p in filtered_products if p.category == category]

        if search:
            search_lower = search.lower()
            filtered_products = [
                p
                for p in filtered_products
                if search_lower in p.name.lower()
                or search_lower in (p.short_description or "").lower()
            ]

        if price_min is not None:
            filtered_products = [
                p
                for p in filtered_products
                if p.pricing["base_price"]["amount"] >= price_min
            ]

        if price_max is not None:
            filtered_products = [
                p
                for p in filtered_products
                if p.pricing["base_price"]["amount"] <= price_max
            ]

        if rating_min is not None:
            filtered_products = [
                p for p in filtered_products if p.average_rating >= rating_min
            ]

        if is_free is not None:
            if is_free:
                filtered_products = [
                    p
                    for p in filtered_products
                    if p.pricing["pricing_model"] == PricingModel.FREE
                ]
            else:
                filtered_products = [
                    p
                    for p in filtered_products
                    if p.pricing["pricing_model"] != PricingModel.FREE
                ]

        if is_featured is not None:
            filtered_products = [
                p for p in filtered_products if p.is_featured == is_featured
            ]

        if tags:
            # TODO: 实现标签过滤逻辑
            pass

        # 排序
        if sort_by == "rating":
            filtered_products.sort(
                key=lambda x: x.average_rating, reverse=(sort_order == "desc")
            )
        elif sort_by == "price":
            filtered_products.sort(
                key=lambda x: x.pricing["base_price"]["amount"],
                reverse=(sort_order == "desc"),
            )
        elif sort_by == "downloads":
            filtered_products.sort(
                key=lambda x: x.download_count, reverse=(sort_order == "desc")
            )
        else:  # created_at
            filtered_products.sort(
                key=lambda x: x.created_at, reverse=(sort_order == "desc")
            )

        # 分页
        total = len(filtered_products)
        start = (page - 1) * size
        end = start + size
        paginated_products = filtered_products[start:end]

        response = PaginatedResponse(
            items=paginated_products,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1,
            total_pages=(total + size - 1) // size,
        )

        # 缓存结果
        product_cache[cache_key] = response

        logger.info(f"返回商品列表: 总数={total}, 页码={page}, 过滤后={len(filtered_products)}")
        return response

    except Exception as e:
        logger.error(f"获取商品列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取商品列表失败"
        )


@router.post("/", response_model=ProductDetailResponse)
async def create_product(
    request: ProductCreateRequest,
    current_user: SecurityContext = Depends(require_vendor_permission()),
    db: Session = Depends(get_db_session),
    adapter_service=Depends(get_adapter_service),
    logger: logging.Logger = Depends(get_logger),
):
    """
    创建新商品

    需要商家权限，支持适配器商品的创建和验证
    """
    try:
        # 验证商品数据
        validation_errors = validate_product_data(request.model_dump())
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "商品数据验证失败", "errors": validation_errors},
            )

        # 验证商品标识符
        if not re.match(r"^[a-z0-9\-]+$", request.slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="商品标识符格式不正确，只能包含小写字母、数字和连字符",
            )

        # TODO: 检查标识符是否已存在
        # existing = get_product_by_slug(db, request.slug)
        # if existing:
        #     raise HTTPException(409, "商品标识符已存在")

        # 如果是适配器商品，进行特殊验证
        if request.product_type == ProductType.ADAPTER:
            # TODO: 验证适配器文件和元数据
            # adapter_validation = await adapter_service.validate_adapter(request.file_path)
            # if not adapter_validation.is_valid:
            #     raise HTTPException(400, f"适配器验证失败: {adapter_validation.errors}")
            pass

        # 创建商品
        product_id = str(uuid.uuid4())

        # 清理内容
        clean_name = sanitize_product_content(request.name)
        clean_description = sanitize_product_content(request.description)

        product_data = {
            **request.model_dump(),
            "id": product_id,
            "status": ProductStatus.PENDING_REVIEW,
            "name": clean_name,
            "description": clean_description,
            "download_count": 0,
            "purchase_count": 0,
            "view_count": 0,
            "favorite_count": 0,
            "average_rating": 0.0,
            "rating_count": 0,
            "is_featured": False,
            "is_verified": False,
            "is_recommended": False,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }

        # TODO: 保存到数据库
        # product = create_product_in_db(db, **product_data)

        # 清理缓存
        product_cache.clear()

        logger.info(
            f"创建商品成功: {clean_name} ({request.slug}) by vendor {request.vendor_id}"
        )

        # 构建响应（模拟数据）
        product = Product(**product_data)

        return ProductDetailResponse(
            **product.model_dump(),
            vendor=VendorListItem(
                id=request.vendor_id,
                name="示例商家",
                display_name="示例商家",
                vendor_type=VendorType.INDIVIDUAL,
                logo_url=None,
                product_count=1,
                average_rating=5.0,
                rating_count=0,
                is_verified=True,
                verification_level=1,
                joined_at=datetime.now(),
            ),
            recent_reviews=[],
            related_products=[],
            is_favorited=False,
            can_purchase=True,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建商品失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建商品失败"
        )


@router.get("/{product_id}", response_model=ProductDetailResponse)
async def get_product(
    product_id: str = Path(..., description="商品ID"),
    current_user: Optional[SecurityContext] = Depends(get_current_user_info),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取商品详情

    包含商品信息、商家信息、最近评价、相关商品等
    """
    try:
        # 检查缓存
        cache_key = f"product_detail:{product_id}"
        if cache_key in product_cache:
            cached_response = product_cache[cache_key]
            # 如果用户已认证，更新用户相关信息
            if current_user:
                # TODO: 检查用户是否收藏了该商品
                cached_response.is_favorited = False
                # TODO: 检查用户是否可以购买
                cached_response.can_purchase = True
            return cached_response

        # TODO: 从数据库获取商品信息
        # product = get_product_by_id(db, product_id)
        # if not product or product.status == ProductStatus.DELETED:
        #     raise HTTPException(404, "商品不存在")

        # 模拟商品数据
        product_data = {
            "id": product_id,
            "vendor_id": str(uuid.uuid4()),
            "name": "高效对话适配器 Pro",
            "slug": "efficient-chat-adapter-pro",
            "description": """# 高效对话适配器 Pro

## 产品概述
这是一个专为对话场景优化的高性能AI适配器，支持多轮对话、上下文理解和情感分析。

## 核心特性
- **多轮对话支持**: 能够维持长期对话上下文，提供连贯的交互体验
- **情感识别**: 智能识别用户情感状态，调整回复风格
- **个性化定制**: 支持个性化参数调整，满足不同场景需求
- **高性能优化**: 经过深度优化，响应速度提升50%

## 技术规格
- 模型架构: Transformer-based
- 支持语言: 中文、英文
- 上下文长度: 4096 tokens
- 推理速度: < 100ms
- 内存占用: < 2GB

## 使用场景
- 客服机器人
- 智能助手
- 教育辅导
- 娱乐聊天

## 安装使用
```python
from zishu_adapters import load_adapter

adapter = load_adapter("efficient-chat-adapter-pro")
response = adapter.generate("你好，请介绍一下你自己")
```

## 版本历史
- v2.1.0: 新增情感识别功能
- v2.0.0: 重构架构，性能大幅提升
- v1.5.0: 添加多语言支持
- v1.0.0: 首次发布

适合各种规模的项目使用，从个人开发到企业级应用都能完美支持。""",
            "short_description": "专为对话场景优化的高性能适配器，支持多轮对话和上下文理解",
            "product_type": ProductType.ADAPTER,
            "category": "对话生成",
            "subcategory": "多轮对话",
            "tags": ["对话", "多轮", "情感分析", "高性能", "优化"],
            "logo_url": "https://example.com/adapter-logo.png",
            "cover_url": "https://example.com/adapter-cover.jpg",
            "screenshots": [
                "https://example.com/screenshot1.jpg",
                "https://example.com/screenshot2.jpg",
                "https://example.com/screenshot3.jpg",
            ],
            "video_url": "https://example.com/demo-video.mp4",
            "demo_url": "https://example.com/live-demo",
            "version": "2.1.0",
            "compatibility": {
                "base_models": ["gpt-3.5", "gpt-4", "llama2"],
                "python_version": ">=3.8",
                "frameworks": {"transformers": ">=4.30.0", "torch": ">=2.0.0"},
            },
            "requirements": ["Python 3.8+", "CUDA 11.8+", "8GB RAM", "2GB 显存"],
            "file_size": 512 * 1024 * 1024,  # 512MB
            "keywords": ["AI", "对话", "适配器", "聊天机器人"],
            "metadata": {
                "model_type": "conversation",
                "training_data": "高质量对话数据集",
                "performance_metrics": {
                    "accuracy": 0.95,
                    "response_time": "85ms",
                    "memory_usage": "1.8GB",
                },
            },
            "status": ProductStatus.PUBLISHED,
            "pricing": {
                "pricing_model": PricingModel.ONE_TIME,
                "base_price": {
                    "amount": Decimal("199.00"),
                    "currency": CurrencyType.CNY,
                },
                "sale_price": {
                    "amount": Decimal("149.00"),
                    "currency": CurrencyType.CNY,
                },
                "license_type": "商业许可",
                "usage_limits": {
                    "concurrent_users": 1000,
                    "api_calls_per_month": 100000,
                },
            },
            "download_count": 1850,
            "purchase_count": 520,
            "view_count": 8450,
            "favorite_count": 380,
            "average_rating": 4.8,
            "rating_count": 256,
            "is_featured": True,
            "is_verified": True,
            "is_recommended": True,
            "published_at": datetime.now() - timedelta(days=30),
            "created_at": datetime.now() - timedelta(days=35),
            "updated_at": datetime.now() - timedelta(days=2),
        }

        # 模拟商家信息
        vendor_data = VendorListItem(
            id=product_data["vendor_id"],
            name="AI创新工作室",
            display_name="AI创新工作室",
            vendor_type=VendorType.COMPANY,
            logo_url="https://example.com/vendor-logo.png",
            product_count=12,
            average_rating=4.7,
            rating_count=89,
            is_verified=True,
            verification_level=3,
            joined_at=datetime.now() - timedelta(days=365),
        )

        # 模拟最近评价
        recent_reviews = [
            ReviewListItem(
                id=str(uuid.uuid4()),
                rating=ReviewRating.FIVE_STARS,
                title="非常优秀的适配器！",
                content="使用了两个月，效果超出预期。对话质量很高，响应速度也很快。客服支持也很及时。强烈推荐！",
                user_name="AI开发者123",
                user_avatar="https://example.com/avatar1.jpg",
                is_verified_purchase=True,
                helpful_count=15,
                created_at=datetime.now() - timedelta(days=3),
            ),
            ReviewListItem(
                id=str(uuid.uuid4()),
                rating=ReviewRating.FOUR_STARS,
                title="性能不错，有改进空间",
                content="整体性能很好，但在处理一些特殊场景时还有待优化。期待后续版本的改进。",
                user_name="产品经理_小王",
                user_avatar="https://example.com/avatar2.jpg",
                is_verified_purchase=True,
                helpful_count=8,
                created_at=datetime.now() - timedelta(days=7),
            ),
        ]

        # 模拟相关商品
        related_products = [
            ProductListItem(
                id=str(uuid.uuid4()),
                name="情感分析增强插件",
                slug="emotion-analysis-plugin",
                short_description="专业的情感分析插件，完美配合对话适配器使用",
                product_type=ProductType.PLUGIN,
                category="情感分析",
                logo_url="https://example.com/plugin-logo.png",
                cover_url="https://example.com/plugin-cover.jpg",
                pricing={
                    "pricing_model": PricingModel.ONE_TIME,
                    "base_price": {
                        "amount": Decimal("99.00"),
                        "currency": CurrencyType.CNY,
                    },
                },
                average_rating=4.6,
                rating_count=125,
                download_count=680,
                is_featured=False,
                is_verified=True,
                vendor_name="AI创新工作室",
                created_at=datetime.now() - timedelta(days=20),
            )
        ]

        # 获取用户相关信息
        is_favorited = False
        can_purchase = True
        if current_user:
            # TODO: 检查用户是否收藏了该商品
            # is_favorited = check_user_favorite(db, current_user.user_id, product_id)
            # TODO: 检查用户是否已购买
            # user_purchase = get_user_purchase(db, current_user.user_id, product_id)
            # can_purchase = user_purchase is None
            pass

        response = ProductDetailResponse(
            **product_data,
            vendor=vendor_data,
            recent_reviews=recent_reviews,
            related_products=related_products,
            is_favorited=is_favorited,
            can_purchase=can_purchase,
        )

        # TODO: 增加浏览量
        # increment_product_view_count(db, product_id)

        # 缓存结果（不包含用户特定信息）
        base_response = response.model_copy()
        base_response.is_favorited = False
        base_response.can_purchase = True
        product_cache[cache_key] = base_response

        logger.info(f"获取商品详情: {product_id}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取商品详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取商品详情失败"
        )


@router.put("/{product_id}", response_model=ProductDetailResponse)
async def update_product(
    product_id: str = Path(..., description="商品ID"),
    request: ProductUpdateRequest = Body(...),
    current_user: SecurityContext = Depends(require_vendor_permission()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新商品信息

    只有商品所有者或管理员可以更新
    """
    try:
        # TODO: 检查商品是否存在和权限
        # product = get_product_by_id(db, product_id)
        # if not product:
        #     raise HTTPException(404, "商品不存在")

        # if product.vendor_id != current_user.vendor_id:
        #     # 检查是否是管理员
        #     if not has_permission(current_user, PermissionType.ADMIN):
        #         raise HTTPException(403, "没有权限更新此商品")

        # 构建更新数据
        update_data = {k: v for k, v in request.model_dump().items() if v is not None}
        if update_data:
            update_data["updated_at"] = datetime.now()

            # 清理内容
            if "name" in update_data:
                update_data["name"] = sanitize_product_content(update_data["name"])
            if "description" in update_data:
                update_data["description"] = sanitize_product_content(
                    update_data["description"]
                )

        # TODO: 更新数据库
        # update_product_in_db(db, product_id, **update_data)

        # 清理缓存
        product_cache.clear()

        logger.info(f"更新商品成功: {product_id} by {current_user.user_id}")

        # 返回更新后的商品详情
        return await get_product(product_id, current_user, db, logger)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新商品失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新商品失败"
        )


@router.delete("/{product_id}")
async def delete_product(
    product_id: str = Path(..., description="商品ID"),
    current_user: SecurityContext = Depends(require_vendor_permission()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    删除商品

    只有商品所有者或管理员可以删除，会软删除商品
    """
    try:
        # TODO: 检查商品是否存在和权限
        # product = get_product_by_id(db, product_id)
        # if not product:
        #     raise HTTPException(404, "商品不存在")

        # if product.vendor_id != current_user.vendor_id:
        #     if not has_permission(current_user, PermissionType.ADMIN):
        #         raise HTTPException(403, "没有权限删除此商品")

        # TODO: 软删除商品
        # soft_delete_product(db, product_id)

        # 清理缓存
        product_cache.clear()
        order_cache.clear()

        logger.info(f"删除商品: {product_id} by {current_user.user_id}")

        return BaseResponse(success=True, message="商品已删除")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除商品失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除商品失败"
        )


# ======================== 商品操作路由 ========================


@router.post("/{product_id}/favorite")
async def favorite_product(
    product_id: str = Path(..., description="商品ID"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    收藏/取消收藏商品
    """
    try:
        # TODO: 检查商品是否存在
        # product = get_product_by_id(db, product_id)
        # if not product:
        #     raise HTTPException(404, "商品不存在")

        # TODO: 检查是否已收藏
        # existing_favorite = get_user_favorite(db, current_user.user_id, product_id)

        # 模拟收藏逻辑
        # if existing_favorite:
        #     delete_favorite(db, existing_favorite.id)
        #     message = "已取消收藏"
        # else:
        #     create_favorite(db, current_user.user_id, product_id)
        #     message = "收藏成功"

        message = "收藏成功"  # 临时实现

        # 清理缓存
        product_cache.clear()

        logger.info(f"收藏操作: {current_user.user_id} -> {product_id}")

        return BaseResponse(success=True, message=message)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"收藏操作失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="操作失败"
        )


@router.get("/{product_id}/download")
async def download_product(
    product_id: str = Path(..., description="商品ID"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    下载商品文件

    需要先购买商品或商品为免费
    """
    try:
        # TODO: 检查商品是否存在
        # product = get_product_by_id(db, product_id)
        # if not product:
        #     raise HTTPException(404, "商品不存在")

        # TODO: 检查用户是否有下载权限
        # if product.pricing.pricing_model != PricingModel.FREE:
        #     purchase = get_user_purchase(db, current_user.user_id, product_id)
        #     if not purchase or purchase.status != OrderStatus.COMPLETED:
        #         raise HTTPException(403, "需要先购买商品")

        # 生成下载令牌
        download_token = generate_download_token(product_id, current_user.user_id)

        # TODO: 记录下载行为
        # record_download(db, current_user.user_id, product_id)

        # TODO: 增加下载计数
        # increment_download_count(db, product_id)

        logger.info(f"生成下载令牌: {current_user.user_id} -> {product_id}")

        return {
            "download_token": download_token,
            "download_url": f"/api/marketplace/download/{download_token}",
            "expires_at": datetime.now() + timedelta(hours=1),
            "message": "下载链接已生成，1小时内有效",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成下载链接失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="生成下载链接失败"
        )


@router.post("/{product_id}/upload", response_model=BaseResponse)
async def upload_product_file(
    product_id: str = Path(..., description="商品ID"),
    file: UploadFile = File(..., description="商品文件"),
    current_user: SecurityContext = Depends(require_vendor_permission()),
    db: Session = Depends(get_db_session),
    adapter_service=Depends(get_adapter_service),
    logger: logging.Logger = Depends(get_logger),
):
    """
    上传商品文件

    只有商品所有者可以上传文件
    """
    try:
        # TODO: 检查商品是否存在和权限
        # product = get_product_by_id(db, product_id)
        # if not product or product.vendor_id != current_user.vendor_id:
        #     raise HTTPException(404, "商品不存在或无权限")

        # 验证文件类型和大小
        allowed_extensions = {".zip", ".tar.gz", ".safetensors", ".bin", ".pt", ".pth"}
        file_ext = (
            "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
        )

        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件类型，支持的格式: {', '.join(allowed_extensions)}",
            )

        # 检查文件大小（限制100MB）
        max_size = 100 * 1024 * 1024  # 100MB
        file_content = await file.read()
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="文件过大，最大支持100MB"
            )

        # TODO: 保存文件到存储
        # file_path = save_product_file(product_id, file.filename, file_content)

        # 如果是适配器文件，进行验证
        # if product.product_type == ProductType.ADAPTER:
        #     validation_result = await adapter_service.validate_file(file_path)
        #     if not validation_result.is_valid:
        #         raise HTTPException(400, f"适配器文件验证失败: {validation_result.errors}")

        # TODO: 更新商品文件信息
        # update_product_file_info(db, product_id, file_path, len(file_content))

        logger.info(
            f"上传商品文件成功: {product_id}, 文件: {file.filename}, 大小: {len(file_content)}"
        )

        return BaseResponse(success=True, message="文件上传成功")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传商品文件失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="文件上传失败"
        )


# ======================== 分类和标签路由 ========================


@router.get("/categories", response_model=List[Dict[str, Any]])
async def list_categories(
    parent_category: Optional[str] = Query(None, description="父分类"),
    include_count: bool = Query(True, description="是否包含商品数量"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取商品分类列表

    支持层级分类和商品数量统计
    """
    try:
        # TODO: 从数据库获取分类数据
        # categories = get_product_categories(db, parent_category, include_count)

        # 模拟分类数据
        categories = [
            {
                "name": "对话生成",
                "slug": "conversation",
                "description": "专用于对话和聊天场景的适配器",
                "product_count": 45 if include_count else None,
                "subcategories": [
                    {"name": "多轮对话", "slug": "multi-turn", "product_count": 28},
                    {"name": "单轮问答", "slug": "single-turn", "product_count": 17},
                ],
            },
            {
                "name": "文本生成",
                "slug": "text-generation",
                "description": "用于各种文本生成任务的适配器",
                "product_count": 32 if include_count else None,
                "subcategories": [
                    {"name": "创意写作", "slug": "creative-writing", "product_count": 18},
                    {"name": "技术文档", "slug": "technical-writing", "product_count": 14},
                ],
            },
            {
                "name": "代码生成",
                "slug": "code-generation",
                "description": "专门用于代码生成和编程辅助的适配器",
                "product_count": 28 if include_count else None,
                "subcategories": [
                    {"name": "Python", "slug": "python", "product_count": 12},
                    {"name": "JavaScript", "slug": "javascript", "product_count": 8},
                    {"name": "其他语言", "slug": "other-languages", "product_count": 8},
                ],
            },
            {
                "name": "数据分析",
                "slug": "data-analysis",
                "description": "用于数据分析和处理的适配器",
                "product_count": 15 if include_count else None,
                "subcategories": [
                    {"name": "数据清洗", "slug": "data-cleaning", "product_count": 7},
                    {"name": "数据可视化", "slug": "data-visualization", "product_count": 8},
                ],
            },
        ]

        # 如果指定了父分类，返回子分类
        if parent_category:
            for category in categories:
                if category["slug"] == parent_category:
                    return category.get("subcategories", [])
            raise HTTPException(404, "分类不存在")

        logger.info(f"获取分类列表: parent={parent_category}, include_count={include_count}")
        return categories

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取分类列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取分类列表失败"
        )


@router.get("/tags", response_model=List[Dict[str, Any]])
async def list_popular_tags(
    limit: int = Query(50, ge=1, le=100, description="返回数量限制"),
    min_count: int = Query(1, ge=1, description="最小商品数量"),
    sort_by: Literal["count", "name"] = Query("count", description="排序方式"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取热门标签列表

    按商品数量或名称排序
    """
    try:
        # TODO: 从数据库获取标签统计
        # tags = get_popular_tags(db, limit, min_count, sort_by)

        # 模拟标签数据
        tags = [
            {"tag": "对话", "count": 45, "category": "功能"},
            {"tag": "高性能", "count": 38, "category": "特性"},
            {"tag": "开源", "count": 32, "category": "许可"},
            {"tag": "多语言", "count": 28, "category": "功能"},
            {"tag": "API", "count": 25, "category": "接口"},
            {"tag": "企业级", "count": 22, "category": "应用"},
            {"tag": "免费", "count": 20, "category": "价格"},
            {"tag": "教程", "count": 18, "category": "类型"},
            {"tag": "情感分析", "count": 15, "category": "功能"},
            {"tag": "实时", "count": 12, "category": "特性"},
        ]

        # 过滤和排序
        filtered_tags = [tag for tag in tags if tag["count"] >= min_count]

        if sort_by == "count":
            filtered_tags.sort(key=lambda x: x["count"], reverse=True)
        else:  # name
            filtered_tags.sort(key=lambda x: x["tag"])

        # 限制数量
        result_tags = filtered_tags[:limit]

        logger.info(
            f"获取热门标签: limit={limit}, min_count={min_count}, 结果数={len(result_tags)}"
        )
        return result_tags

    except Exception as e:
        logger.error(f"获取热门标签失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取标签列表失败"
        )


# ======================== 订单管理路由 ========================


@router.get("/orders", response_model=PaginatedResponse)
async def list_orders(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    status: Optional[OrderStatus] = Query(None, description="订单状态"),
    vendor_id: Optional[str] = Query(None, description="商家ID"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取订单列表

    用户只能查看自己的订单，商家能查看自己商品的订单，管理员能查看所有订单
    """
    try:
        # TODO: 根据用户权限过滤订单
        # user_orders = get_user_orders(db, current_user.user_id, ...)

        # 模拟订单数据
        orders = [
            OrderListItem(
                id=str(uuid.uuid4()),
                order_number="ORD20241201001",
                status=OrderStatus.COMPLETED,
                total_amount=MoneyAmount(
                    amount=Decimal("149.00"), currency=CurrencyType.CNY
                ),
                payment_status=PaymentStatus.SUCCESS,
                item_count=1,
                vendor_name="AI创新工作室",
                created_at=datetime.now() - timedelta(days=7),
            ),
            OrderListItem(
                id=str(uuid.uuid4()),
                order_number="ORD20241201002",
                status=OrderStatus.PENDING,
                total_amount=MoneyAmount(
                    amount=Decimal("999.00"), currency=CurrencyType.CNY
                ),
                payment_status=PaymentStatus.PENDING,
                item_count=1,
                vendor_name="企业服务商",
                created_at=datetime.now() - timedelta(hours=2),
            ),
        ]

        # 应用过滤条件
        if status:
            orders = [o for o in orders if o.status == status]

        # 分页
        total = len(orders)
        start = (page - 1) * size
        end = start + size
        paginated_orders = orders[start:end]

        response = PaginatedResponse(
            items=paginated_orders,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1,
            total_pages=(total + size - 1) // size,
        )

        logger.info(f"获取订单列表: user={current_user.user_id}, 总数={total}")
        return response

    except Exception as e:
        logger.error(f"获取订单列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取订单列表失败"
        )


@router.post("/orders", response_model=OrderDetailResponse)
async def create_order(
    request: OrderCreateRequest,
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    marketplace_service=Depends(get_marketplace_service),
    logger: logging.Logger = Depends(get_logger),
):
    """
    创建新订单

    验证商品可用性和价格，计算总金额
    """
    try:
        # 验证订单项目
        if not validate_order_items(request.items):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="订单项目无效"
            )

        # TODO: 验证商品存在性和可购买性
        # for item in request.items:
        #     product = get_product_by_id(db, item["product_id"])
        #     if not product or product.status != ProductStatus.PUBLISHED:
        #         raise HTTPException(400, f"商品 {item['product_id']} 不可购买")

        # 生成订单号
        order_number = generate_order_number()
        order_id = str(uuid.uuid4())

        # 计算订单金额
        subtotal = MoneyAmount(amount=Decimal("149.00"), currency=CurrencyType.CNY)
        tax_amount = MoneyAmount(amount=Decimal("0.00"), currency=CurrencyType.CNY)
        discount_amount = MoneyAmount(amount=Decimal("0.00"), currency=CurrencyType.CNY)
        total_amount = MoneyAmount(
            amount=subtotal.amount - discount_amount.amount + tax_amount.amount,
            currency=subtotal.currency,
        )

        # 创建订单
        order_data = {
            **request.model_dump(),
            "id": order_id,
            "order_number": order_number,
            "buyer_id": current_user.user_id,
            "vendor_id": str(uuid.uuid4()),  # TODO: 从商品获取
            "status": OrderStatus.PENDING,
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "payment_status": PaymentStatus.PENDING,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }

        # TODO: 保存到数据库
        # order = create_order_in_db(db, **order_data)

        # 清理缓存
        order_cache.clear()

        logger.info(f"创建订单成功: {order_number} by {current_user.user_id}")

        # 构建详细响应
        order = Order(**order_data)

        return OrderDetailResponse(
            **order.model_dump(),
            buyer={
                "id": current_user.user_id,
                "username": "current_user",
                "nickname": "当前用户",
                "avatar_url": None,
                "email": "user@example.com",
            },
            vendor=VendorListItem(
                id=order_data["vendor_id"],
                name="AI创新工作室",
                display_name="AI创新工作室",
                vendor_type=VendorType.COMPANY,
                logo_url=None,
                product_count=12,
                average_rating=4.7,
                rating_count=89,
                is_verified=True,
                verification_level=3,
                joined_at=datetime.now() - timedelta(days=365),
            ),
            product_details=[
                {
                    "product_id": request.items[0]["product_id"],
                    "product_name": "高效对话适配器 Pro",
                    "quantity": request.items[0]["quantity"],
                    "unit_price": request.items[0]["price"],
                    "total_price": request.items[0]["price"]
                    * request.items[0]["quantity"],
                }
            ],
            payment_history=[],
            can_cancel=True,
            can_refund=False,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建订单失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建订单失败"
        )


@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
async def get_order(
    order_id: str = Path(..., description="订单ID"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取订单详情

    只能查看自己的订单或自己商品的订单
    """
    try:
        # TODO: 检查订单存在性和权限
        # order = get_order_by_id(db, order_id)
        # if not order:
        #     raise HTTPException(404, "订单不存在")

        # if order.buyer_id != current_user.user_id:
        #     # 检查是否是该订单商品的商家
        #     vendor = get_vendor_by_user_id(db, current_user.user_id)
        #     if not vendor or order.vendor_id != vendor.id:
        #         raise HTTPException(403, "无权限查看此订单")

        # 模拟订单详情数据
        order_data = {
            "id": order_id,
            "order_number": "ORD20241201001",
            "buyer_id": current_user.user_id,
            "vendor_id": str(uuid.uuid4()),
            "status": OrderStatus.COMPLETED,
            "items": [
                {
                    "product_id": str(uuid.uuid4()),
                    "quantity": 1,
                    "price": Decimal("149.00"),
                }
            ],
            "subtotal": MoneyAmount(
                amount=Decimal("149.00"), currency=CurrencyType.CNY
            ),
            "discount_amount": MoneyAmount(
                amount=Decimal("0.00"), currency=CurrencyType.CNY
            ),
            "tax_amount": MoneyAmount(
                amount=Decimal("0.00"), currency=CurrencyType.CNY
            ),
            "total_amount": MoneyAmount(
                amount=Decimal("149.00"), currency=CurrencyType.CNY
            ),
            "payment_method": PaymentMethod.ALIPAY,
            "payment_status": PaymentStatus.SUCCESS,
            "delivery_method": "数字下载",
            "buyer_notes": None,
            "vendor_notes": None,
            "internal_notes": None,
            "created_at": datetime.now() - timedelta(days=7),
            "updated_at": datetime.now() - timedelta(days=7),
            "paid_at": datetime.now() - timedelta(days=7),
            "delivered_at": datetime.now() - timedelta(days=7),
            "completed_at": datetime.now() - timedelta(days=7),
        }

        response = OrderDetailResponse(
            **order_data,
            buyer={
                "id": current_user.user_id,
                "username": "current_user",
                "nickname": "当前用户",
                "avatar_url": None,
                "email": "user@example.com",
            },
            vendor=VendorListItem(
                id=order_data["vendor_id"],
                name="AI创新工作室",
                display_name="AI创新工作室",
                vendor_type=VendorType.COMPANY,
                logo_url=None,
                product_count=12,
                average_rating=4.7,
                rating_count=89,
                is_verified=True,
                verification_level=3,
                joined_at=datetime.now() - timedelta(days=365),
            ),
            product_details=[
                {
                    "product_id": order_data["items"][0]["product_id"],
                    "product_name": "高效对话适配器 Pro",
                    "product_slug": "efficient-chat-adapter-pro",
                    "quantity": 1,
                    "unit_price": Decimal("149.00"),
                    "total_price": Decimal("149.00"),
                    "download_token": generate_download_token(
                        order_data["items"][0]["product_id"], current_user.user_id
                    )
                    if order_data["status"] == OrderStatus.COMPLETED
                    else None,
                }
            ],
            payment_history=[
                PaymentListItem(
                    id=str(uuid.uuid4()),
                    transaction_id="TXN20241201001",
                    amount=MoneyAmount(
                        amount=Decimal("149.00"), currency=CurrencyType.CNY
                    ),
                    method=PaymentMethod.ALIPAY,
                    status=PaymentStatus.SUCCESS,
                    created_at=datetime.now() - timedelta(days=7),
                    paid_at=datetime.now() - timedelta(days=7),
                )
            ],
            can_cancel=False,
            can_refund=order_data["status"] == OrderStatus.COMPLETED,
        )

        logger.info(f"获取订单详情: {order_id}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取订单详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取订单详情失败"
        )


@router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: str = Path(..., description="订单ID"),
    reason: Optional[str] = Body(None, description="取消原因"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    payment_service=Depends(get_payment_service),
    logger: logging.Logger = Depends(get_logger),
):
    """
    取消订单

    只能取消未支付或未完成的订单
    """
    try:
        # TODO: 检查订单存在性和权限
        # order = get_order_by_id(db, order_id)
        # if not order or order.buyer_id != current_user.user_id:
        #     raise HTTPException(404, "订单不存在")

        # if order.status not in [OrderStatus.PENDING, OrderStatus.CONFIRMED]:
        #     raise HTTPException(400, "订单状态不允许取消")

        # TODO: 如果已支付，发起退款
        # if order.payment_status == PaymentStatus.SUCCESS:
        #     refund_result = await payment_service.refund(order.id)
        #     if not refund_result.success:
        #         raise HTTPException(400, "退款发起失败")

        # TODO: 更新订单状态
        # update_order_status(db, order_id, OrderStatus.CANCELLED, reason)

        # 清理缓存
        order_cache.clear()

        logger.info(f"取消订单: {order_id} by {current_user.user_id}, 原因: {reason}")

        return BaseResponse(success=True, message="订单已取消")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"取消订单失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="取消订单失败"
        )


# ======================== 支付系统路由 ========================


@router.post("/payments", response_model=Dict[str, Any])
async def create_payment(
    request: PaymentCreateRequest,
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    payment_service=Depends(get_payment_service),
    logger: logging.Logger = Depends(get_logger),
):
    """
    创建支付

    生成支付链接或二维码
    """
    try:
        # TODO: 检查订单存在性和权限
        # order = get_order_by_id(db, request.order_id)
        # if not order or order.buyer_id != current_user.user_id:
        #     raise HTTPException(404, "订单不存在")

        # if order.status != OrderStatus.PENDING:
        #     raise HTTPException(400, "订单状态不允许支付")

        # 生成支付记录
        payment_id = str(uuid.uuid4())
        transaction_id = f"TXN{int(datetime.now().timestamp())}"

        payment_data = {
            "id": payment_id,
            "order_id": request.order_id,
            "transaction_id": transaction_id,
            "amount": MoneyAmount(amount=Decimal("149.00"), currency=CurrencyType.CNY),
            "method": request.method,
            "status": PaymentStatus.PENDING,
            "gateway": "alipay" if request.method == PaymentMethod.ALIPAY else "wechat",
            "gateway_transaction_id": None,
            "gateway_response": {},
            "created_at": datetime.now(),
        }

        # TODO: 保存支付记录
        # payment = create_payment_in_db(db, **payment_data)

        # TODO: 调用支付网关
        # gateway_response = await payment_service.create_payment(payment_data)

        # 模拟支付网关响应
        gateway_response = {
            "payment_url": f"https://payment.example.com/pay/{payment_id}",
            "qr_code": f"https://payment.example.com/qr/{payment_id}",
            "expires_at": datetime.now() + timedelta(minutes=15),
        }

        logger.info(f"创建支付: {payment_id} for order {request.order_id}")

        return {
            "payment_id": payment_id,
            "transaction_id": transaction_id,
            "status": PaymentStatus.PENDING,
            "payment_method": request.method,
            **gateway_response,
            "message": "支付创建成功，请在15分钟内完成支付",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建支付失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建支付失败"
        )


@router.get("/payments/{payment_id}/status")
async def get_payment_status(
    payment_id: str = Path(..., description="支付ID"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    payment_service=Depends(get_payment_service),
    logger: logging.Logger = Depends(get_logger),
):
    """
    查询支付状态

    用于前端轮询支付结果
    """
    try:
        # TODO: 检查支付记录存在性和权限
        # payment = get_payment_by_id(db, payment_id)
        # if not payment:
        #     raise HTTPException(404, "支付记录不存在")

        # order = get_order_by_id(db, payment.order_id)
        # if not order or order.buyer_id != current_user.user_id:
        #     raise HTTPException(403, "无权限查看此支付")

        # TODO: 查询支付网关状态
        # gateway_status = await payment_service.query_payment_status(payment_id)

        # 模拟支付状态
        payment_status = {
            "payment_id": payment_id,
            "status": PaymentStatus.SUCCESS,
            "paid_at": datetime.now() - timedelta(minutes=5),
            "gateway_transaction_id": f"GATEWAY_{payment_id}",
            "amount": MoneyAmount(amount=Decimal("149.00"), currency=CurrencyType.CNY),
        }

        logger.info(f"查询支付状态: {payment_id}, 状态: {payment_status['status']}")
        return payment_status

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询支付状态失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="查询支付状态失败"
        )


@router.post("/payments/{payment_id}/refund")
async def refund_payment(
    payment_id: str = Path(..., description="支付ID"),
    refund_amount: Optional[Decimal] = Body(None, description="退款金额，不填则全额退款"),
    refund_reason: str = Body(..., description="退款原因"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    payment_service=Depends(get_payment_service),
    logger: logging.Logger = Depends(get_logger),
):
    """
    申请退款

    支持全额和部分退款
    """
    try:
        # TODO: 检查支付记录和权限
        # payment = get_payment_by_id(db, payment_id)
        # if not payment or payment.status != PaymentStatus.SUCCESS:
        #     raise HTTPException(400, "支付记录不存在或状态不正确")

        # order = get_order_by_id(db, payment.order_id)
        # if not order or order.buyer_id != current_user.user_id:
        #     raise HTTPException(403, "无权限申请退款")

        # 验证退款金额
        original_amount = Decimal("149.00")  # TODO: 从支付记录获取
        if refund_amount and refund_amount > original_amount:
            raise HTTPException(400, "退款金额不能超过原支付金额")

        actual_refund_amount = refund_amount or original_amount

        # TODO: 调用支付网关退款接口
        # refund_result = await payment_service.refund(payment_id, actual_refund_amount, refund_reason)

        # 创建退款记录
        refund_id = str(uuid.uuid4())
        refund_data = {
            "id": refund_id,
            "payment_id": payment_id,
            "amount": MoneyAmount(
                amount=actual_refund_amount, currency=CurrencyType.CNY
            ),
            "reason": refund_reason,
            "status": PaymentStatus.PROCESSING,
            "created_at": datetime.now(),
        }

        # TODO: 保存退款记录
        # create_refund_record(db, **refund_data)

        logger.info(
            f"申请退款: {payment_id}, 金额: {actual_refund_amount}, 原因: {refund_reason}"
        )

        return {
            "refund_id": refund_id,
            "status": "processing",
            "refund_amount": actual_refund_amount,
            "estimated_arrival": "1-3个工作日",
            "message": "退款申请已提交，请耐心等待处理",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"申请退款失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="申请退款失败"
        )


# ======================== 评价系统路由 ========================


@router.get("/{product_id}/reviews", response_model=PaginatedResponse)
async def list_product_reviews(
    product_id: str = Path(..., description="商品ID"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    rating_filter: Optional[ReviewRating] = Query(None, description="评分过滤"),
    sort_by: Literal["created_at", "rating", "helpful"] = Query(
        "created_at", description="排序字段"
    ),
    sort_order: Literal["asc", "desc"] = Query("desc", description="排序方向"),
    verified_only: bool = Query(False, description="仅显示已验证购买的评价"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取商品评价列表

    支持按评分过滤、排序和分页
    """
    try:
        # 构建缓存键
        cache_key = f"reviews:{product_id}:{page}:{size}:{rating_filter}:{sort_by}:{sort_order}:{verified_only}"

        # 检查缓存
        if cache_key in review_cache:
            logger.info(f"从缓存返回评价列表: {cache_key}")
            return review_cache[cache_key]

        # TODO: 从数据库获取评价数据
        # reviews = get_product_reviews(db, product_id, page, size, rating_filter, sort_by, sort_order, verified_only)

        # 模拟评价数据
        reviews = [
            ReviewListItem(
                id=str(uuid.uuid4()),
                rating=ReviewRating.FIVE_STARS,
                title="非常优秀的适配器！",
                content="使用了两个月，效果超出预期。对话质量很高，响应速度也很快。客服支持也很及时。强烈推荐给需要的朋友！安装简单，文档清晰，上手很容易。",
                user_name="AI开发者123",
                user_avatar="https://example.com/avatar1.jpg",
                is_verified_purchase=True,
                helpful_count=15,
                created_at=datetime.now() - timedelta(days=3),
            ),
            ReviewListItem(
                id=str(uuid.uuid4()),
                rating=ReviewRating.FOUR_STARS,
                title="性能不错，有改进空间",
                content="整体性能很好，但在处理一些特殊场景时还有待优化。期待后续版本的改进。价格合理，性价比还可以。",
                user_name="产品经理_小王",
                user_avatar="https://example.com/avatar2.jpg",
                is_verified_purchase=True,
                helpful_count=8,
                created_at=datetime.now() - timedelta(days=7),
            ),
            ReviewListItem(
                id=str(uuid.uuid4()),
                rating=ReviewRating.FIVE_STARS,
                title="企业级应用效果很好",
                content="在我们的客服系统中部署后，用户满意度明显提升。多轮对话能力很强，上下文理解准确。技术支持响应也很及时。",
                user_name="企业用户_李工",
                user_avatar=None,
                is_verified_purchase=True,
                helpful_count=12,
                created_at=datetime.now() - timedelta(days=10),
            ),
            ReviewListItem(
                id=str(uuid.uuid4()),
                rating=ReviewRating.THREE_STARS,
                title="功能基本满足需求",
                content="基本功能都有，但一些高级特性还需要完善。对于初学者来说足够了，但对于专业用户可能需要更多定制选项。",
                user_name="学习者_小张",
                user_avatar="https://example.com/avatar3.jpg",
                is_verified_purchase=False,
                helpful_count=5,
                created_at=datetime.now() - timedelta(days=15),
            ),
        ]

        # 应用过滤条件
        filtered_reviews = reviews

        if rating_filter:
            filtered_reviews = [
                r for r in filtered_reviews if r.rating == rating_filter
            ]

        if verified_only:
            filtered_reviews = [r for r in filtered_reviews if r.is_verified_purchase]

        # 排序
        if sort_by == "rating":
            filtered_reviews.sort(
                key=lambda x: x.rating.value, reverse=(sort_order == "desc")
            )
        elif sort_by == "helpful":
            filtered_reviews.sort(
                key=lambda x: x.helpful_count, reverse=(sort_order == "desc")
            )
        else:  # created_at
            filtered_reviews.sort(
                key=lambda x: x.created_at, reverse=(sort_order == "desc")
            )

        # 分页
        total = len(filtered_reviews)
        start = (page - 1) * size
        end = start + size
        paginated_reviews = filtered_reviews[start:end]

        response = PaginatedResponse(
            items=paginated_reviews,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1,
            total_pages=(total + size - 1) // size,
        )

        # 缓存结果
        review_cache[cache_key] = response

        logger.info(f"获取商品评价列表: {product_id}, 总数={total}")
        return response

    except Exception as e:
        logger.error(f"获取商品评价列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取评价列表失败"
        )


@router.post("/{product_id}/reviews", response_model=ReviewDetailResponse)
async def create_review(
    product_id: str = Path(..., description="商品ID"),
    request: ReviewCreateRequest = Body(...),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    notification_service=Depends(get_notification_service),
    logger: logging.Logger = Depends(get_logger),
):
    """
    创建商品评价

    需要先购买商品才能评价
    """
    try:
        # 验证商品ID匹配
        if request.product_id != product_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="商品ID不匹配"
            )

        # TODO: 检查用户是否购买过该商品
        # purchase = get_user_purchase(db, current_user.user_id, product_id)
        # if not purchase or purchase.status != OrderStatus.COMPLETED:
        #     raise HTTPException(403, "需要先购买商品才能评价")

        # TODO: 检查是否已经评价过
        # existing_review = get_user_review(db, current_user.user_id, product_id)
        # if existing_review:
        #     raise HTTPException(409, "您已经评价过此商品")

        # 清理评价内容
        clean_title = sanitize_product_content(request.title or "")
        clean_content = sanitize_product_content(request.content)

        # 创建评价
        review_id = str(uuid.uuid4())
        review_data = {
            **request.model_dump(),
            "id": review_id,
            "user_id": current_user.user_id,
            "title": clean_title,
            "content": clean_content,
            "status": ReviewStatus.PUBLISHED,
            "is_verified_purchase": True,  # TODO: 从购买记录验证
            "helpful_count": 0,
            "reply_count": 0,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }

        # TODO: 保存到数据库
        # review = create_review_in_db(db, **review_data)

        # 发送通知给商家
        await send_marketplace_notification(
            user_id="vendor_user_id",  # TODO: 从商品获取商家用户ID
            notification_type="new_review",
            title="收到新评价",
            content=f"用户对您的商品给出了 {request.rating.value} 星评价",
            notification_service=notification_service,
        )

        # TODO: 更新商品评分统计
        # update_product_rating_stats(db, product_id)

        # 清理缓存
        review_cache.clear()
        product_cache.clear()

        logger.info(f"创建评价成功: {review_id} by {current_user.user_id} for {product_id}")

        # 构建响应
        review = Review(**review_data)

        return ReviewDetailResponse(
            **review.model_dump(),
            user={
                "id": current_user.user_id,
                "username": "current_user",
                "nickname": "当前用户",
                "avatar_url": None,
                "email": "user@example.com",
            },
            product=ProductListItem(
                id=product_id,
                name="高效对话适配器 Pro",
                slug="efficient-chat-adapter-pro",
                short_description="专为对话场景优化的高性能适配器",
                product_type=ProductType.ADAPTER,
                category="对话生成",
                logo_url="https://example.com/adapter-logo.png",
                cover_url="https://example.com/adapter-cover.jpg",
                pricing={
                    "pricing_model": PricingModel.ONE_TIME,
                    "base_price": {
                        "amount": Decimal("199.00"),
                        "currency": CurrencyType.CNY,
                    },
                },
                average_rating=4.8,
                rating_count=257,  # +1
                download_count=1850,
                is_featured=True,
                is_verified=True,
                vendor_name="AI创新工作室",
                created_at=datetime.now() - timedelta(days=30),
            ),
            replies=[],
            is_helpful=False,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建评价失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建评价失败"
        )


@router.post("/reviews/{review_id}/helpful")
async def mark_review_helpful(
    review_id: str = Path(..., description="评价ID"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    标记评价有用/取消标记
    """
    try:
        # TODO: 检查评价是否存在
        # review = get_review_by_id(db, review_id)
        # if not review:
        #     raise HTTPException(404, "评价不存在")

        # TODO: 检查是否已标记
        # existing_helpful = get_user_helpful_mark(db, current_user.user_id, review_id)

        # 模拟标记逻辑
        # if existing_helpful:
        #     delete_helpful_mark(db, existing_helpful.id)
        #     message = "已取消标记"
        # else:
        #     create_helpful_mark(db, current_user.user_id, review_id)
        #     message = "标记成功"

        message = "标记成功"  # 临时实现

        # 清理缓存
        review_cache.clear()

        logger.info(f"标记评价有用: {current_user.user_id} -> {review_id}")

        return BaseResponse(success=True, message=message)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"标记评价失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="操作失败"
        )


# ======================== 商家管理路由 ========================


@router.get("/vendors", response_model=PaginatedResponse)
async def list_vendors(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    vendor_type: Optional[VendorType] = Query(None, description="商家类型"),
    is_verified: Optional[bool] = Query(None, description="仅显示认证商家"),
    search: Optional[str] = Query(None, description="搜索商家名称"),
    sort_by: Literal["joined_at", "rating", "product_count"] = Query(
        "joined_at", description="排序字段"
    ),
    sort_order: Literal["asc", "desc"] = Query("desc", description="排序方向"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取商家列表

    支持按类型、认证状态过滤和搜索
    """
    try:
        # 构建缓存键
        cache_key = f"vendors:{page}:{size}:{vendor_type}:{is_verified}:{search}:{sort_by}:{sort_order}"

        # 检查缓存
        if cache_key in vendor_cache:
            logger.info(f"从缓存返回商家列表: {cache_key}")
            return vendor_cache[cache_key]

        # TODO: 从数据库获取商家数据
        # vendors = get_vendors_list(db, ...)

        # 模拟商家数据
        vendors = [
            VendorListItem(
                id=str(uuid.uuid4()),
                name="AI创新工作室",
                display_name="AI创新工作室",
                vendor_type=VendorType.COMPANY,
                logo_url="https://example.com/vendor1-logo.png",
                product_count=12,
                average_rating=4.7,
                rating_count=89,
                is_verified=True,
                verification_level=3,
                joined_at=datetime.now() - timedelta(days=365),
            ),
            VendorListItem(
                id=str(uuid.uuid4()),
                name="开源社区",
                display_name="开源适配器社区",
                vendor_type=VendorType.ORGANIZATION,
                logo_url="https://example.com/vendor2-logo.png",
                product_count=25,
                average_rating=4.5,
                rating_count=156,
                is_verified=True,
                verification_level=2,
                joined_at=datetime.now() - timedelta(days=500),
            ),
            VendorListItem(
                id=str(uuid.uuid4()),
                name="个人开发者",
                display_name="张三的适配器工坊",
                vendor_type=VendorType.INDIVIDUAL,
                logo_url=None,
                product_count=3,
                average_rating=4.2,
                rating_count=28,
                is_verified=False,
                verification_level=0,
                joined_at=datetime.now() - timedelta(days=60),
            ),
        ]

        # 应用过滤条件
        filtered_vendors = vendors

        if vendor_type:
            filtered_vendors = [
                v for v in filtered_vendors if v.vendor_type == vendor_type
            ]

        if is_verified is not None:
            filtered_vendors = [
                v for v in filtered_vendors if v.is_verified == is_verified
            ]

        if search:
            search_lower = search.lower()
            filtered_vendors = [
                v
                for v in filtered_vendors
                if search_lower in v.name.lower()
                or search_lower in v.display_name.lower()
            ]

        # 排序
        if sort_by == "rating":
            filtered_vendors.sort(
                key=lambda x: x.average_rating, reverse=(sort_order == "desc")
            )
        elif sort_by == "product_count":
            filtered_vendors.sort(
                key=lambda x: x.product_count, reverse=(sort_order == "desc")
            )
        else:  # joined_at
            filtered_vendors.sort(
                key=lambda x: x.joined_at, reverse=(sort_order == "desc")
            )

        # 分页
        total = len(filtered_vendors)
        start = (page - 1) * size
        end = start + size
        paginated_vendors = filtered_vendors[start:end]

        response = PaginatedResponse(
            items=paginated_vendors,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1,
            total_pages=(total + size - 1) // size,
        )

        # 缓存结果
        vendor_cache[cache_key] = response

        logger.info(f"获取商家列表: 总数={total}")
        return response

    except Exception as e:
        logger.error(f"获取商家列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取商家列表失败"
        )


@router.post("/vendors", response_model=VendorDetailResponse)
async def create_vendor(
    request: VendorCreateRequest,
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    申请成为商家

    用户可以申请成为商家，需要审核
    """
    try:
        # 验证用户ID匹配
        if request.user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="用户ID不匹配"
            )

        # TODO: 检查用户是否已经是商家
        # existing_vendor = get_vendor_by_user_id(db, current_user.user_id)
        # if existing_vendor:
        #     raise HTTPException(409, "您已经是商家")

        # 创建商家申请
        vendor_id = str(uuid.uuid4())
        vendor_data = {
            **request.model_dump(),
            "id": vendor_id,
            "status": VendorStatus.PENDING,
            "product_count": 0,
            "total_sales": MoneyAmount(
                amount=Decimal("0.00"), currency=CurrencyType.CNY
            ),
            "total_orders": 0,
            "average_rating": 0.0,
            "rating_count": 0,
            "is_verified": False,
            "verification_level": 0,
            "balance": MoneyAmount(amount=Decimal("0.00"), currency=CurrencyType.CNY),
            "commission_rate": 0.05,  # 5% 平台佣金
            "joined_at": datetime.now(),
            "verified_at": None,
            "last_login_at": None,
        }

        # TODO: 保存到数据库
        # vendor = create_vendor_in_db(db, **vendor_data)

        # 清理缓存
        vendor_cache.clear()

        logger.info(f"创建商家申请: {request.name} by {current_user.user_id}")

        # 构建响应
        vendor = Vendor(**vendor_data)

        return VendorDetailResponse(
            **vendor.model_dump(), products=[], recent_reviews=[], is_following=False
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建商家申请失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建商家申请失败"
        )


@router.get("/vendors/{vendor_id}", response_model=VendorDetailResponse)
async def get_vendor(
    vendor_id: str = Path(..., description="商家ID"),
    current_user: Optional[SecurityContext] = Depends(get_current_user_info),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取商家详情

    包含商家信息、商品列表、最近评价等
    """
    try:
        # TODO: 从数据库获取商家信息
        # vendor = get_vendor_by_id(db, vendor_id)
        # if not vendor or vendor.status == VendorStatus.BANNED:
        #     raise HTTPException(404, "商家不存在")

        # 模拟商家数据
        vendor_data = {
            "id": vendor_id,
            "user_id": str(uuid.uuid4()),
            "name": "AI创新工作室",
            "display_name": "AI创新工作室",
            "description": "专注于AI适配器开发的创新团队，致力于为用户提供高质量的AI解决方案。我们的产品涵盖对话生成、文本处理、代码生成等多个领域。",
            "vendor_type": VendorType.COMPANY,
            "email": "contact@ai-innovation.com",
            "phone": "+86-138-0000-0000",
            "website": "https://ai-innovation.com",
            "country": "中国",
            "city": "北京",
            "address": "北京市海淀区中关村软件园",
            "logo_url": "https://example.com/vendor-logo.png",
            "banner_url": "https://example.com/vendor-banner.jpg",
            "social_links": {
                "github": "https://github.com/ai-innovation",
                "twitter": "https://twitter.com/ai_innovation",
            },
            "status": VendorStatus.ACTIVE,
            "product_count": 12,
            "total_sales": MoneyAmount(
                amount=Decimal("125000.00"), currency=CurrencyType.CNY
            ),
            "total_orders": 850,
            "average_rating": 4.7,
            "rating_count": 89,
            "is_verified": True,
            "verification_level": 3,
            "balance": MoneyAmount(
                amount=Decimal("8500.00"), currency=CurrencyType.CNY
            ),
            "commission_rate": 0.05,
            "joined_at": datetime.now() - timedelta(days=365),
            "verified_at": datetime.now() - timedelta(days=300),
            "last_login_at": datetime.now() - timedelta(hours=2),
        }

        # 模拟商家商品
        products = [
            ProductListItem(
                id=str(uuid.uuid4()),
                name="高效对话适配器 Pro",
                slug="efficient-chat-adapter-pro",
                short_description="专为对话场景优化的高性能适配器",
                product_type=ProductType.ADAPTER,
                category="对话生成",
                logo_url="https://example.com/adapter-logo.png",
                cover_url="https://example.com/adapter-cover.jpg",
                pricing={
                    "pricing_model": PricingModel.ONE_TIME,
                    "base_price": {
                        "amount": Decimal("199.00"),
                        "currency": CurrencyType.CNY,
                    },
                },
                average_rating=4.8,
                rating_count=256,
                download_count=1850,
                is_featured=True,
                is_verified=True,
                vendor_name="AI创新工作室",
                created_at=datetime.now() - timedelta(days=30),
            )
        ]

        # 模拟最近评价
        recent_reviews = [
            ReviewListItem(
                id=str(uuid.uuid4()),
                rating=ReviewRating.FIVE_STARS,
                title="优秀的商家！",
                content="产品质量很好，客服响应及时，发货速度快。推荐！",
                user_name="满意客户",
                user_avatar=None,
                is_verified_purchase=True,
                helpful_count=8,
                created_at=datetime.now() - timedelta(days=5),
            )
        ]

        # 获取用户关注状态
        is_following = False
        if current_user:
            # TODO: 检查用户是否关注了该商家
            # is_following = check_user_follow_vendor(db, current_user.user_id, vendor_id)
            pass

        response = VendorDetailResponse(
            **vendor_data,
            products=products,
            recent_reviews=recent_reviews,
            is_following=is_following,
        )

        logger.info(f"获取商家详情: {vendor_id}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取商家详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取商家详情失败"
        )


# ======================== 搜索和统计路由 ========================


@router.get("/search", response_model=PaginatedResponse)
async def search_marketplace(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    type: Literal["all", "products", "vendors"] = Query("all", description="搜索类型"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    filters: SearchFilters = Depends(),
    search_service=Depends(get_search_service),
    logger: logging.Logger = Depends(get_logger),
):
    """
    市场搜索

    支持搜索商品和商家，带智能推荐
    """
    try:
        # TODO: 实现真实的搜索逻辑
        # results = await search_service.search_marketplace(q, type, page, size, filters)

        # 模拟搜索结果
        all_results = []

        if type in ["all", "products"]:
            # 商品搜索结果
            products = [
                {
                    "type": "product",
                    "id": str(uuid.uuid4()),
                    "name": f"包含'{q}'的高效适配器",
                    "description": f"这是一个与{q}相关的专业适配器产品",
                    "price": {
                        "amount": Decimal("199.00"),
                        "currency": CurrencyType.CNY,
                    },
                    "rating": 4.8,
                    "vendor_name": "AI创新工作室",
                    "relevance_score": 0.95,
                }
            ]
            all_results.extend(products)

        if type in ["all", "vendors"]:
            # 商家搜索结果
            vendors = [
                {
                    "type": "vendor",
                    "id": str(uuid.uuid4()),
                    "name": f"专业{q}服务商",
                    "description": f"专注于{q}领域的专业服务提供商",
                    "product_count": 15,
                    "rating": 4.6,
                    "verification_level": 3,
                    "relevance_score": 0.88,
                }
            ]
            all_results.extend(vendors)

        # 按相关性排序
        all_results.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

        # 分页
        total = len(all_results)
        start = (page - 1) * size
        end = start + size
        results = all_results[start:end]

        response = PaginatedResponse(
            items=results,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1,
            total_pages=(total + size - 1) // size,
        )

        logger.info(f"市场搜索: '{q}' type={type}, 结果数={total}")
        return response

    except Exception as e:
        logger.error(f"市场搜索失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="搜索失败"
        )


@router.get("/stats", response_model=MarketplaceStats)
async def get_marketplace_stats(
    timeframe: Literal["day", "week", "month", "year"] = Query(
        "month", description="统计时间范围"
    ),
    current_user: Optional[SecurityContext] = Depends(get_current_user_info),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取市场统计数据

    包括商品数、商家数、订单数、收入等统计
    """
    try:
        # 检查缓存
        cache_key = f"marketplace_stats:{timeframe}"
        if cache_key in stats_cache:
            logger.info(f"从缓存返回统计数据: {cache_key}")
            return stats_cache[cache_key]

        # TODO: 从数据库获取真实统计数据
        # stats = calculate_marketplace_stats(db, timeframe)

        # 模拟统计数据
        stats = MarketplaceStats(
            total_products=1245,
            total_vendors=156,
            total_orders=8950,
            total_revenue=MoneyAmount(
                amount=Decimal("2850000.00"), currency=CurrencyType.CNY
            ),
            products_today=12,
            products_this_week=85,
            products_this_month=245,
            orders_today=156,
            orders_this_week=1280,
            orders_this_month=4250,
            revenue_today=MoneyAmount(
                amount=Decimal("25600.00"), currency=CurrencyType.CNY
            ),
            revenue_this_week=MoneyAmount(
                amount=Decimal("185000.00"), currency=CurrencyType.CNY
            ),
            revenue_this_month=MoneyAmount(
                amount=Decimal("685000.00"), currency=CurrencyType.CNY
            ),
            category_stats={
                "对话生成": 245,
                "文本生成": 189,
                "代码生成": 156,
                "数据分析": 125,
                "图像处理": 98,
                "其他": 432,
            },
            vendor_type_stats={"个人开发者": 89, "公司": 45, "组织": 15, "官方": 7},
            top_products=[
                {
                    "id": str(uuid.uuid4()),
                    "name": "高效对话适配器 Pro",
                    "sales_count": 520,
                    "revenue": Decimal("77480.00"),
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "智能代码生成器",
                    "sales_count": 380,
                    "revenue": Decimal("56240.00"),
                },
            ],
            top_vendors=[
                {
                    "id": str(uuid.uuid4()),
                    "name": "AI创新工作室",
                    "sales_count": 850,
                    "revenue": Decimal("125000.00"),
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "企业服务商",
                    "sales_count": 450,
                    "revenue": Decimal("89500.00"),
                },
            ],
            top_categories=[
                {"category": "对话生成", "product_count": 245, "order_count": 2150},
                {"category": "代码生成", "product_count": 156, "order_count": 1850},
                {"category": "文本生成", "product_count": 189, "order_count": 1650},
            ],
        )

        # 缓存结果
        stats_cache[cache_key] = stats

        logger.info(f"获取市场统计: timeframe={timeframe}")
        return stats

    except Exception as e:
        logger.error(f"获取市场统计失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取统计数据失败"
        )


@router.get("/trending", response_model=PaginatedResponse)
async def get_trending_products(
    timeframe: Literal["day", "week", "month"] = Query("week", description="时间范围"),
    category: Optional[str] = Query(None, description="分类过滤"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取热门商品

    基于销量、评分和热度计算
    """
    try:
        # TODO: 实现真实的热门商品算法
        # trending_products = get_trending_products_from_db(db, timeframe, category, page, size)

        # 模拟热门商品
        products = [
            {
                "id": str(uuid.uuid4()),
                "name": "高效对话适配器 Pro",
                "category": "对话生成",
                "vendor_name": "AI创新工作室",
                "current_price": Decimal("149.00"),
                "original_price": Decimal("199.00"),
                "sales_count": 520,
                "rating": 4.8,
                "trending_score": 156.7,
                "growth_rate": 23.5,
                "created_at": datetime.now() - timedelta(days=30),
            },
            {
                "id": str(uuid.uuid4()),
                "name": "智能代码生成器",
                "category": "代码生成",
                "vendor_name": "编程助手团队",
                "current_price": Decimal("299.00"),
                "original_price": None,
                "sales_count": 380,
                "rating": 4.7,
                "trending_score": 134.2,
                "growth_rate": 18.9,
                "created_at": datetime.now() - timedelta(days=45),
            },
        ]

        # 分类过滤
        if category:
            products = [p for p in products if p["category"] == category]

        # 分页
        total = len(products)
        start = (page - 1) * size
        end = start + size
        paginated_products = products[start:end]

        response = PaginatedResponse(
            items=paginated_products,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1,
            total_pages=(total + size - 1) // size,
        )

        logger.info(f"获取热门商品: timeframe={timeframe}, category={category}")
        return response

    except Exception as e:
        logger.error(f"获取热门商品失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取热门商品失败"
        )


# 导出路由
__all__ = ["router"]
