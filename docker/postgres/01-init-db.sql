-- Zishu-sensei Database Initialization Script
-- 为Docker Desktop部署创建数据库和用户

-- 创建数据库
CREATE DATABASE IF NOT EXISTS zishu;
CREATE DATABASE IF NOT EXISTS zishu_sensei;

-- 创建用户（如果不存在）
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'zishu') THEN

      CREATE ROLE zishu LOGIN PASSWORD 'zishu123';
   END IF;
END
$do$;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE zishu TO zishu;
GRANT ALL PRIVILEGES ON DATABASE zishu_sensei TO zishu;

-- 连接到zishu数据库
\c zishu;

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 授予schema权限
GRANT ALL ON SCHEMA public TO zishu;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zishu;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zishu;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zishu;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zishu;

-- 连接到zishu_sensei数据库并进行初始化
\c zishu_sensei;

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 授予schema权限
GRANT ALL ON SCHEMA public TO zishu;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zishu;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zishu;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zishu;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zishu;
