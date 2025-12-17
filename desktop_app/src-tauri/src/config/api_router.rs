//! API 路由配置
//! 
//! 根据不同的功能模块路由到不同的后端服务：
//! - 用户认证、社区功能 → 社区平台 (8001)
//! - 角色模板、适配器、核心AI → 核心服务 (8000)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// API 后端配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiBackend {
    pub name: String,
    pub base_url: String,
    pub description: String,
}

/// API 路由配置
#[derive(Debug, Clone)]
pub struct ApiRouter {
    backends: HashMap<String, ApiBackend>,
    routes: HashMap<String, String>,
}

impl Default for ApiRouter {
    fn default() -> Self {
        let mut backends = HashMap::new();
        let mut routes = HashMap::new();

        // 定义后端服务
        backends.insert(
            "core".to_string(),
            ApiBackend {
                name: "core".to_string(),
                base_url: std::env::var("ZISHU_CORE_API_URL")
                    .unwrap_or_else(|_| "http://127.0.0.1:8000".to_string()),
                description: "核心服务（角色模板、适配器、工作流）".to_string(),
            },
        );

        backends.insert(
            "community".to_string(),
            ApiBackend {
                name: "community".to_string(),
                base_url: std::env::var("ZISHU_COMMUNITY_API_URL")
                    .unwrap_or_else(|_| "http://localhost:8001".to_string()),
                description: "社区平台（用户认证、社区互动）".to_string(),
            },
        );

        // 定义路由规则（社区平台）
        let community_routes = vec![
            "/auth", "/user", "/users", "/community", "/social",
            "/posts", "/comments", "/notifications", "/market",
        ];
        for route in community_routes {
            routes.insert(route.to_string(), "community".to_string());
        }

        // 定义路由规则（核心服务）
        let core_routes = vec![
            "/chat", "/characters", "/adapters", "/workflows",
            "/tasks", "/system", "/settings", "/models", "/screen",
        ];
        for route in core_routes {
            routes.insert(route.to_string(), "core".to_string());
        }

        Self { backends, routes }
    }
}

impl ApiRouter {
    /// 创建新的路由器
    pub fn new() -> Self {
        Self::default()
    }

    /// 根据路径获取后端URL
    pub fn get_backend_url(&self, path: &str) -> String {
        let normalized_path = if path.starts_with('/') {
            path.to_string()
        } else {
            format!("/{}", path)
        };

        // 查找匹配的路由
        for (prefix, backend_name) in &self.routes {
            if normalized_path.starts_with(prefix) {
                if let Some(backend) = self.backends.get(backend_name) {
                    return backend.base_url.clone();
                }
            }
        }

        // 默认返回核心服务
        self.backends
            .get("core")
            .map(|b| b.base_url.clone())
            .unwrap_or_else(|| "http://127.0.0.1:8000".to_string())
    }

    /// 构建完整URL
    pub fn build_url(&self, path: &str) -> String {
        let base_url = self.get_backend_url(path);
        let normalized_path = if path.starts_with('/') {
            path.to_string()
        } else {
            format!("/{}", path)
        };

        format!("{}{}", base_url.trim_end_matches('/'), normalized_path)
    }

    /// 获取指定后端的URL
    pub fn get_backend(&self, name: &str) -> Option<String> {
        self.backends.get(name).map(|b| b.base_url.clone())
    }

    /// 获取核心服务URL
    pub fn core_url(&self) -> String {
        self.get_backend("core")
            .unwrap_or_else(|| "http://127.0.0.1:8000".to_string())
    }

    /// 获取社区平台URL
    pub fn community_url(&self) -> String {
        self.get_backend("community")
            .unwrap_or_else(|| "http://localhost:8001".to_string())
    }

    /// 获取所有后端信息
    pub fn get_all_backends(&self) -> Vec<ApiBackend> {
        self.backends.values().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_router_default() {
        let router = ApiRouter::new();
        
        // 测试社区平台路由
        assert!(router.get_backend_url("/auth/login").contains("8001"));
        assert!(router.get_backend_url("/user/profile").contains("8001"));
        
        // 测试核心服务路由
        assert!(router.get_backend_url("/characters/list").contains("8000"));
        assert!(router.get_backend_url("/adapters/install").contains("8000"));
        
        // 测试默认路由
        assert!(router.get_backend_url("/unknown/path").contains("8000"));
    }

    #[test]
    fn test_build_url() {
        let router = ApiRouter::new();
        
        let url = router.build_url("/auth/login");
        assert!(url.contains("8001"));
        assert!(url.ends_with("/auth/login"));
    }

    #[test]
    fn test_get_backend() {
        let router = ApiRouter::new();
        
        assert!(router.core_url().contains("8000"));
        assert!(router.community_url().contains("8001"));
    }
}
