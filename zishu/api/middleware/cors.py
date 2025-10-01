# -*- coding: utf-8 -*-
"""
CORS中间件配置
处理跨域请求
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional


def setup_cors(
    app: FastAPI,
    allow_origins: Optional[List[str]] = None,
    allow_credentials: bool = True,
    allow_methods: Optional[List[str]] = None,
    allow_headers: Optional[List[str]] = None,
    expose_headers: Optional[List[str]] = None,
    max_age: int = 600
) -> None:
    """
    设置CORS中间件
    
    Args:
        app: FastAPI应用实例
        allow_origins: 允许的源列表
        allow_credentials: 是否允许凭据
        allow_methods: 允许的HTTP方法列表
        allow_headers: 允许的请求头列表
        expose_headers: 暴露的响应头列表
        max_age: 预检请求缓存时间(秒)
    """
    if allow_origins is None:
        allow_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ]
    
    if allow_methods is None:
        allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"]
    
    if allow_headers is None:
        allow_headers = [
            "Accept",
            "Accept-Language",
            "Content-Language",
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "X-API-Key",
            "X-Client-Version",
            "X-Request-ID",
            "Cache-Control",
            "Pragma",
        ]
    
    if expose_headers is None:
        expose_headers = [
            "X-Request-ID",
            "X-Response-Time",
            "X-Rate-Limit-Remaining",
            "X-Rate-Limit-Reset",
        ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=allow_methods,
        allow_headers=allow_headers,
        expose_headers=expose_headers,
        max_age=max_age,
    )


def get_cors_config() -> dict:
    """获取CORS配置"""
    return {
        "allow_origins": [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ],
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
        "allow_headers": [
            "Accept",
            "Accept-Language",
            "Content-Language",
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "X-API-Key",
            "X-Client-Version",
            "X-Request-ID",
            "Cache-Control",
            "Pragma",
        ],
        "expose_headers": [
            "X-Request-ID",
            "X-Response-Time",
            "X-Rate-Limit-Remaining",
            "X-Rate-Limit-Reset",
        ],
        "max_age": 600,
    }
