-- PostgreSQL initialization script for Zishu-sensei
-- This script runs when the database container is first created

-- Create the main database if it doesn't exist
-- (This is usually handled by POSTGRES_DB environment variable)

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS zishu;
CREATE SCHEMA IF NOT EXISTS logs;
CREATE SCHEMA IF NOT EXISTS metrics;

-- Set default search path
ALTER DATABASE zishu SET search_path TO zishu, public;

-- Create basic tables structure (these will be managed by the application)
-- This is just to ensure the database is properly initialized

-- Users table
CREATE TABLE IF NOT EXISTS zishu.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'
);

-- Sessions table for chat sessions
CREATE TABLE IF NOT EXISTS zishu.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES zishu.users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'
);

-- Messages table for chat messages
CREATE TABLE IF NOT EXISTS zishu.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES zishu.chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Knowledge base table
CREATE TABLE IF NOT EXISTS zishu.knowledge_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding dimension
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Logs table for application logs
CREATE TABLE IF NOT EXISTS logs.app_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level VARCHAR(20) NOT NULL,
    logger VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    user_id UUID,
    session_id UUID,
    request_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

-- Metrics table for custom metrics
CREATE TABLE IF NOT EXISTS metrics.api_metrics (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    user_id UUID,
    request_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON zishu.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON zishu.users(username);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON zishu.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON zishu.chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON zishu.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON zishu.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_title ON zishu.knowledge_entries USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_content ON zishu.knowledge_entries USING gin(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_tags ON zishu.knowledge_entries USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON logs.app_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON logs.app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_user_id ON logs.app_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_metrics_timestamp ON metrics.api_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON metrics.api_metrics(endpoint);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON zishu.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON zishu.chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_entries_updated_at BEFORE UPDATE ON zishu.knowledge_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT USAGE ON SCHEMA zishu TO zishu;
GRANT USAGE ON SCHEMA logs TO zishu;
GRANT USAGE ON SCHEMA metrics TO zishu;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA zishu TO zishu;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA logs TO zishu;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA metrics TO zishu;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA zishu TO zishu;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA logs TO zishu;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA metrics TO zishu;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA zishu GRANT ALL ON TABLES TO zishu;
ALTER DEFAULT PRIVILEGES IN SCHEMA logs GRANT ALL ON TABLES TO zishu;
ALTER DEFAULT PRIVILEGES IN SCHEMA metrics GRANT ALL ON TABLES TO zishu;

ALTER DEFAULT PRIVILEGES IN SCHEMA zishu GRANT ALL ON SEQUENCES TO zishu;
ALTER DEFAULT PRIVILEGES IN SCHEMA logs GRANT ALL ON SEQUENCES TO zishu;
ALTER DEFAULT PRIVILEGES IN SCHEMA metrics GRANT ALL ON SEQUENCES TO zishu;
