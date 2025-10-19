//! 市场相关命令
//!
//! 提供适配器和主题商店的客户端功能，包括：
//! - 浏览和搜索市场内容
//! - 下载和安装
//! - 版本检查和更新
//! - 评分和评论（只读）

use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};
use reqwest::Client;
use std::path::PathBuf;
use tokio::fs;

use crate::{
    commands::*,
    state::AppState,
    database::get_database,
};

// ================================
// 数据类型
// ================================

/// 市场产品类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MarketProductType {
    /// 适配器
    Adapter,
    /// 主题
    Theme,
    /// 工作流模板
    Workflow,
}

/// 市场产品信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketProduct {
    /// 产品ID
    pub id: String,
    /// 产品类型
    pub product_type: MarketProductType,
    /// 名称
    pub name: String,
    /// 显示名称
    pub display_name: String,
    /// 描述
    pub description: String,
    /// 作者
    pub author: MarketAuthor,
    /// 版本
    pub version: String,
    /// 所有版本
    pub versions: Vec<ProductVersion>,
    /// 下载URL
    pub download_url: String,
    /// 图标URL
    pub icon_url: Option<String>,
    /// 截图
    pub screenshots: Vec<String>,
    /// 标签
    pub tags: Vec<String>,
    /// 类别
    pub category: String,
    /// 评分
    pub rating: f64,
    /// 评分数量
    pub rating_count: u32,
    /// 下载数量
    pub download_count: u64,
    /// 文件大小
    pub file_size: u64,
    /// 许可证
    pub license: String,
    /// 主页
    pub homepage_url: Option<String>,
    /// 文档URL
    pub documentation_url: Option<String>,
    /// 仓库URL
    pub repository_url: Option<String>,
    /// 是否推荐
    pub is_featured: bool,
    /// 是否已验证
    pub is_verified: bool,
    /// 创建时间
    pub created_at: String,
    /// 更新时间
    pub updated_at: String,
    /// 依赖
    pub dependencies: Vec<ProductDependency>,
    /// 系统要求
    pub requirements: ProductRequirements,
}

/// 市场作者信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketAuthor {
    /// 作者ID
    pub id: String,
    /// 作者名称
    pub name: String,
    /// 作者头像
    pub avatar_url: Option<String>,
    /// 是否已验证
    pub verified: bool,
}

/// 产品版本
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductVersion {
    /// 版本号
    pub version: String,
    /// 发布时间
    pub released_at: String,
    /// 变更日志
    pub changelog: Option<String>,
    /// 下载URL
    pub download_url: String,
    /// 文件大小
    pub file_size: u64,
    /// 校验和
    pub checksum: Option<String>,
}

/// 产品依赖
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductDependency {
    /// 依赖产品ID
    pub product_id: String,
    /// 依赖产品名称
    pub product_name: String,
    /// 版本要求
    pub version_requirement: String,
    /// 是否必需
    pub required: bool,
}

/// 产品系统要求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductRequirements {
    /// 支持的操作系统
    pub operating_systems: Vec<String>,
    /// 最小内存（MB）
    pub min_memory_mb: Option<u64>,
    /// 最小磁盘空间（MB）
    pub min_disk_space_mb: Option<u64>,
    /// 其他要求
    pub other: Option<String>,
}

/// 市场搜索请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketSearchRequest {
    /// 搜索关键词
    pub query: String,
    /// 产品类型过滤
    pub product_type: Option<MarketProductType>,
    /// 类别过滤
    pub category: Option<String>,
    /// 标签过滤
    pub tags: Option<Vec<String>>,
    /// 仅显示推荐
    pub featured_only: Option<bool>,
    /// 仅显示已验证
    pub verified_only: Option<bool>,
    /// 分页
    pub page: Option<u32>,
    /// 每页大小
    pub page_size: Option<u32>,
    /// 排序字段
    pub sort_by: Option<String>,
    /// 排序顺序
    pub sort_order: Option<String>,
}

/// 产品评论
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductReview {
    /// 评论ID
    pub id: String,
    /// 用户
    pub user: MarketAuthor,
    /// 评分
    pub rating: u8,
    /// 评论内容
    pub content: String,
    /// 点赞数
    pub likes: u32,
    /// 创建时间
    pub created_at: String,
    /// 更新时间
    pub updated_at: String,
}

/// 下载进度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    /// 产品ID
    pub product_id: String,
    /// 已下载字节数
    pub downloaded_bytes: u64,
    /// 总字节数
    pub total_bytes: u64,
    /// 下载速度（字节/秒）
    pub speed_bps: u64,
    /// 进度百分比
    pub percentage: f64,
    /// 状态
    pub status: String,
}

// ================================
// 命令处理器
// ================================

/// 搜索市场产品
#[tauri::command]
pub async fn search_market_products(
    request: MarketSearchRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<PaginatedResponse<MarketProduct>>, String> {
    info!("搜索市场产品: {:?}", request.query);
    
    match search_products_in_market(&request).await {
        Ok(results) => {
            info!("搜索到 {} 个产品", results.total);
            Ok(CommandResponse::success(results))
        }
        Err(e) => {
            error!("搜索市场产品失败: {}", e);
            Ok(CommandResponse::error(format!("搜索失败: {}", e)))
        }
    }
}

/// 获取产品详情
#[tauri::command]
pub async fn get_market_product(
    product_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<MarketProduct>, String> {
    info!("获取产品详情: {}", product_id);
    
    match get_product_details(&product_id).await {
        Ok(product) => {
            info!("成功获取产品详情: {}", product.name);
            Ok(CommandResponse::success(product))
        }
        Err(e) => {
            error!("获取产品详情失败: {}", e);
            Ok(CommandResponse::error(format!("获取产品详情失败: {}", e)))
        }
    }
}

/// 获取推荐产品
#[tauri::command]
pub async fn get_featured_products(
    product_type: Option<MarketProductType>,
    limit: Option<u32>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<MarketProduct>>, String> {
    info!("获取推荐产品");
    
    match get_featured_products_from_market(product_type, limit).await {
        Ok(products) => {
            info!("获取到 {} 个推荐产品", products.len());
            Ok(CommandResponse::success(products))
        }
        Err(e) => {
            error!("获取推荐产品失败: {}", e);
            Ok(CommandResponse::error(format!("获取推荐产品失败: {}", e)))
        }
    }
}

/// 获取产品评论
#[tauri::command]
pub async fn get_product_reviews(
    product_id: String,
    page: Option<u32>,
    page_size: Option<u32>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<PaginatedResponse<ProductReview>>, String> {
    info!("获取产品评论: {}", product_id);
    
    match get_reviews_from_market(&product_id, page, page_size).await {
        Ok(reviews) => {
            info!("获取到 {} 条评论", reviews.total);
            Ok(CommandResponse::success(reviews))
        }
        Err(e) => {
            error!("获取产品评论失败: {}", e);
            Ok(CommandResponse::error(format!("获取评论失败: {}", e)))
        }
    }
}

/// 下载产品
#[tauri::command]
pub async fn download_market_product(
    product_id: String,
    version: Option<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<String>, String> {
    info!("下载产品: {} 版本: {:?}", product_id, version);
    
    match download_product(&product_id, version.as_deref(), &app_handle).await {
        Ok(file_path) => {
            info!("产品下载成功: {}", file_path);
            Ok(CommandResponse::success_with_message(
                file_path,
                "下载成功".to_string(),
            ))
        }
        Err(e) => {
            error!("下载产品失败: {}", e);
            Ok(CommandResponse::error(format!("下载失败: {}", e)))
        }
    }
}

/// 检查产品更新
#[tauri::command]
pub async fn check_product_updates(
    product_ids: Vec<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<ProductUpdateInfo>>, String> {
    info!("检查产品更新: {:?}", product_ids);
    
    match check_updates_for_products(&product_ids).await {
        Ok(updates) => {
            let update_count = updates.iter().filter(|u| u.has_update).count();
            info!("发现 {} 个产品有更新", update_count);
            Ok(CommandResponse::success(updates))
        }
        Err(e) => {
            error!("检查产品更新失败: {}", e);
            Ok(CommandResponse::error(format!("检查更新失败: {}", e)))
        }
    }
}

/// 获取产品类别列表
#[tauri::command]
pub async fn get_market_categories(
    product_type: Option<MarketProductType>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<MarketCategory>>, String> {
    info!("获取市场类别");
    
    match get_categories_from_market(product_type).await {
        Ok(categories) => {
            info!("获取到 {} 个类别", categories.len());
            Ok(CommandResponse::success(categories))
        }
        Err(e) => {
            error!("获取市场类别失败: {}", e);
            Ok(CommandResponse::error(format!("获取类别失败: {}", e)))
        }
    }
}

// ================================
// 辅助类型
// ================================

/// 产品更新信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductUpdateInfo {
    /// 产品ID
    pub product_id: String,
    /// 产品名称
    pub product_name: String,
    /// 当前版本
    pub current_version: String,
    /// 最新版本
    pub latest_version: String,
    /// 是否有更新
    pub has_update: bool,
    /// 变更日志
    pub changelog: Option<String>,
    /// 下载URL
    pub download_url: Option<String>,
}

/// 市场类别
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketCategory {
    /// 类别ID
    pub id: String,
    /// 类别名称
    pub name: String,
    /// 类别描述
    pub description: Option<String>,
    /// 产品数量
    pub product_count: u32,
    /// 图标
    pub icon: Option<String>,
}

// ================================
// 后端 API 函数
// ================================

/// 从市场搜索产品
async fn search_products_in_market(request: &MarketSearchRequest) -> Result<PaginatedResponse<MarketProduct>, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    let mut query_params: Vec<(&str, String)> = vec![
        ("q", request.query.clone()),
    ];
    
    if let Some(ref product_type) = request.product_type {
        query_params.push(("type", format!("{:?}", product_type).to_lowercase()));
    }
    if let Some(ref category) = request.category {
        query_params.push(("category", category.clone()));
    }
    if let Some(page) = request.page {
        query_params.push(("page", page.to_string()));
    }
    if let Some(page_size) = request.page_size {
        query_params.push(("page_size", page_size.to_string()));
    }
    if let Some(ref sort_by) = request.sort_by {
        query_params.push(("sort_by", sort_by.clone()));
    }
    if let Some(ref sort_order) = request.sort_order {
        query_params.push(("sort_order", sort_order.clone()));
    }
    if let Some(featured) = request.featured_only {
        if featured {
            query_params.push(("featured", "true".to_string()));
        }
    }
    if let Some(verified) = request.verified_only {
        if verified {
            query_params.push(("verified", "true".to_string()));
        }
    }
    
    let url = format!("{}/api/marketplace/search", backend_url);
    let query_pairs: Vec<(String, String)> = query_params
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();
    
    match client.get(&url).query(&query_pairs).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<PaginatedResponse<MarketProduct>>().await {
                    Ok(results) => Ok(results),
                    Err(e) => Err(format!("解析搜索结果失败: {}", e)),
                }
            } else {
                Err(format!("搜索请求失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("网络请求失败: {}", e)),
    }
}

/// 获取产品详情
async fn get_product_details(product_id: &str) -> Result<MarketProduct, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    let url = format!("{}/api/marketplace/products/{}", backend_url, product_id);
    
    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<MarketProduct>().await {
                    Ok(product) => Ok(product),
                    Err(e) => Err(format!("解析产品详情失败: {}", e)),
                }
            } else {
                Err(format!("获取产品详情失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("网络请求失败: {}", e)),
    }
}

/// 获取推荐产品
async fn get_featured_products_from_market(
    product_type: Option<MarketProductType>,
    limit: Option<u32>,
) -> Result<Vec<MarketProduct>, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    let mut query_params: Vec<(&str, String)> = vec![];
    
    if let Some(ref ptype) = product_type {
        query_params.push(("type", format!("{:?}", ptype).to_lowercase()));
    }
    if let Some(lim) = limit {
        query_params.push(("limit", lim.to_string()));
    }
    
    let url = format!("{}/api/marketplace/featured", backend_url);
    let query_pairs: Vec<(String, String)> = query_params
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();
    
    match client.get(&url).query(&query_pairs).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Vec<MarketProduct>>().await {
                    Ok(products) => Ok(products),
                    Err(e) => Err(format!("解析推荐产品失败: {}", e)),
                }
            } else {
                Err(format!("获取推荐产品失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("网络请求失败: {}", e)),
    }
}

/// 获取产品评论
async fn get_reviews_from_market(
    product_id: &str,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<PaginatedResponse<ProductReview>, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    let url = format!("{}/api/marketplace/products/{}/reviews", backend_url, product_id);
    
    let mut query_params: Vec<(&str, String)> = vec![];
    if let Some(p) = page {
        query_params.push(("page", p.to_string()));
    }
    if let Some(ps) = page_size {
        query_params.push(("page_size", ps.to_string()));
    }
    
    let query_pairs: Vec<(String, String)> = query_params
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();
    
    match client.get(&url).query(&query_pairs).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<PaginatedResponse<ProductReview>>().await {
                    Ok(reviews) => Ok(reviews),
                    Err(e) => Err(format!("解析评论失败: {}", e)),
                }
            } else {
                Err(format!("获取评论失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("网络请求失败: {}", e)),
    }
}

/// 下载产品
async fn download_product(
    product_id: &str,
    version: Option<&str>,
    app_handle: &AppHandle,
) -> Result<String, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    // 获取产品详情
    let product = get_product_details(product_id).await?;
    
    // 确定下载URL
    let download_url = if let Some(ver) = version {
        // 查找指定版本
        product.versions
            .iter()
            .find(|v| v.version == ver)
            .map(|v| v.download_url.clone())
            .unwrap_or(product.download_url)
    } else {
        product.download_url
    };
    
    // 创建下载目录
    let download_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?
        .join("downloads");
    
    fs::create_dir_all(&download_dir)
        .await
        .map_err(|e| format!("创建下载目录失败: {}", e))?;
    
    // 生成文件名
    let file_name = format!("{}_{}.zip", product_id, version.unwrap_or(&product.version));
    let file_path = download_dir.join(&file_name);
    
    // 下载文件
    match client.get(&download_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                let bytes = response.bytes().await
                    .map_err(|e| format!("读取下载内容失败: {}", e))?;
                
                fs::write(&file_path, bytes)
                    .await
                    .map_err(|e| format!("保存文件失败: {}", e))?;
                
                Ok(file_path.to_string_lossy().to_string())
            } else {
                Err(format!("下载失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("下载请求失败: {}", e)),
    }
}

/// 检查产品更新
async fn check_updates_for_products(product_ids: &[String]) -> Result<Vec<ProductUpdateInfo>, String> {
    let db = get_database().ok_or("数据库未初始化")?;
    let mut updates = Vec::new();
    
    for product_id in product_ids {
        // 获取本地安装的版本
        let local_adapter = db.adapter_registry.get_adapter(product_id)
            .map_err(|e| format!("查询本地适配器失败: {}", e))?;
        
        if let Some(adapter) = local_adapter {
            // 获取市场上的最新版本
            match get_product_details(product_id).await {
                Ok(market_product) => {
                    let has_update = compare_versions(&adapter.version, &market_product.version);
                    
                    updates.push(ProductUpdateInfo {
                        product_id: product_id.clone(),
                        product_name: adapter.name.clone(),
                        current_version: adapter.version.clone(),
                        latest_version: market_product.version.clone(),
                        has_update,
                        changelog: market_product.versions.first()
                            .and_then(|v| v.changelog.clone()),
                        download_url: Some(market_product.download_url),
                    });
                }
                Err(e) => {
                    warn!("获取产品 {} 的市场信息失败: {}", product_id, e);
                }
            }
        }
    }
    
    Ok(updates)
}

/// 获取市场类别
async fn get_categories_from_market(product_type: Option<MarketProductType>) -> Result<Vec<MarketCategory>, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    let mut query_params: Vec<(&str, String)> = vec![];
    if let Some(ref ptype) = product_type {
        query_params.push(("type", format!("{:?}", ptype).to_lowercase()));
    }
    
    let url = format!("{}/api/marketplace/categories", backend_url);
    let query_pairs: Vec<(String, String)> = query_params
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();
    
    match client.get(&url).query(&query_pairs).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Vec<MarketCategory>>().await {
                    Ok(categories) => Ok(categories),
                    Err(e) => Err(format!("解析类别列表失败: {}", e)),
                }
            } else {
                Err(format!("获取类别列表失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("网络请求失败: {}", e)),
    }
}

// ================================
// 辅助函数
// ================================

/// 获取后端URL
fn get_backend_url() -> String {
    std::env::var("ZISHU_BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:8000".to_string())
}

/// 比较版本号（简单实现）
fn compare_versions(current: &str, latest: &str) -> bool {
    // 简单的版本比较，实际应使用 semver crate
    current != latest
}

// ================================
// 命令元数据
// ================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();
    
    metadata.insert("search_market_products".to_string(), CommandMetadata {
        name: "search_market_products".to_string(),
        description: "搜索市场产品".to_string(),
        input_type: Some("MarketSearchRequest".to_string()),
        output_type: Some("PaginatedResponse<MarketProduct>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "market".to_string(),
    });
    
    metadata.insert("get_market_product".to_string(), CommandMetadata {
        name: "get_market_product".to_string(),
        description: "获取市场产品详情".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("MarketProduct".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "market".to_string(),
    });
    
    metadata.insert("get_featured_products".to_string(), CommandMetadata {
        name: "get_featured_products".to_string(),
        description: "获取推荐产品".to_string(),
        input_type: Some("Option<MarketProductType>".to_string()),
        output_type: Some("Vec<MarketProduct>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "market".to_string(),
    });
    
    metadata.insert("get_product_reviews".to_string(), CommandMetadata {
        name: "get_product_reviews".to_string(),
        description: "获取产品评论".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("PaginatedResponse<ProductReview>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "market".to_string(),
    });
    
    metadata.insert("download_market_product".to_string(), CommandMetadata {
        name: "download_market_product".to_string(),
        description: "下载市场产品".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("String".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "market".to_string(),
    });
    
    metadata.insert("check_product_updates".to_string(), CommandMetadata {
        name: "check_product_updates".to_string(),
        description: "检查产品更新".to_string(),
        input_type: Some("Vec<String>".to_string()),
        output_type: Some("Vec<ProductUpdateInfo>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "market".to_string(),
    });
    
    metadata.insert("get_market_categories".to_string(), CommandMetadata {
        name: "get_market_categories".to_string(),
        description: "获取市场类别列表".to_string(),
        input_type: Some("Option<MarketProductType>".to_string()),
        output_type: Some("Vec<MarketCategory>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "market".to_string(),
    });
    
    metadata
}

