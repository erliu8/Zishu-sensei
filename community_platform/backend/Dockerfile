# ============ 构建阶段 ============
FROM python:3.10-slim AS builder

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

# 配置apt镜像源并安装编译依赖
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true && \
    sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true && \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make && \
    rm -rf /var/lib/apt/lists/*

# 配置pip镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

# 设置工作目录
WORKDIR /app

# 安装构建工具
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# 复制 requirements.txt 并分层安装依赖
COPY requirements.txt .

# 先从PyTorch官方源安装CPU版本 (约200MB，而GPU版本约2GB+)
RUN pip install --no-cache-dir \
    torch==2.1.2 \
    torchvision==0.16.2 \
    --index-url https://download.pytorch.org/whl/cpu

# 分离依赖文件：基础依赖
RUN grep -E "^(fastapi|uvicorn|sqlalchemy|asyncpg|alembic|psycopg2-binary|redis|hiredis|python-jose|passlib|bcrypt|python-dotenv|websockets|pydantic|email-validator|httpx|requests|python-dateutil|qdrant-client)" requirements.txt > base-requirements.txt && \
    pip install --no-cache-dir --no-deps -r base-requirements.txt || pip install --no-cache-dir -r base-requirements.txt

# ML 库（大型依赖）- 跳过torch因为已经安装
RUN grep -E "^(sentence-transformers|transformers|numpy)" requirements.txt > ml-requirements.txt && \
    pip install --no-cache-dir -r ml-requirements.txt

# 测试依赖（可选，如果生产环境不需要可以注释掉）
RUN grep -E "^(pytest)" requirements.txt > test-requirements.txt && \
    pip install --no-cache-dir -r test-requirements.txt || true

# 安装剩余依赖（如果有遗漏的话）
RUN pip install --no-cache-dir -r requirements.txt

# ============ 运行阶段 ============
FROM python:3.10-slim

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_ENDPOINT=https://hf-mirror.com \
    DEBIAN_FRONTEND=noninteractive

# 配置apt镜像源并安装运行时依赖
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true && \
    sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true && \
    apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    wget \
    libgomp1 \
    redis-tools && \
    rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 从构建阶段复制Python包
COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 先创建必要的目录（不常变化）
RUN mkdir -p uploads logs && \
    chmod -R 755 uploads logs

# 复制启动脚本（不常变化）
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# 最后复制应用代码（频繁变化，放最后以最大化缓存利用）
COPY . .

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 暴露端口
EXPOSE 8000

# 设置入口点和默认命令
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
