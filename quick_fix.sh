#!/bin/bash

# Zishu-Sensei 构建问题快速修复脚本

set -e

echo "🔧 开始修复 Zishu-Sensei 构建问题..."

# 检查当前目录
if [ ! -f "desktop_app/src-tauri/Cargo.toml" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

echo "📁 当前目录验证通过"

# 1. 清理编译警告
echo "🧹 清理编译警告..."
cd desktop_app/src-tauri
if command -v cargo &> /dev/null; then
    echo "正在运行 cargo fix..."
    cargo fix --bin "zishu-sensei" --allow-dirty --allow-staged || echo "⚠️  部分警告无法自动修复"
    echo "✅ 编译警告清理完成"
else
    echo "⚠️  未找到 cargo 命令，跳过警告修复"
fi

cd ../..

# 2. 生成更新器密钥对
echo "🔑 检查更新器密钥配置..."

if command -v minisign &> /dev/null; then
    echo "找到 minisign，生成新的密钥对..."
    
    # 检查是否已存在密钥文件
    if [ -f "zishu-sensei.key" ] || [ -f "zishu-sensei.pub" ]; then
        echo "⚠️  发现现有密钥文件，是否要重新生成？ (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            rm -f zishu-sensei.key zishu-sensei.pub
            echo "🗑️  已删除旧密钥文件"
        else
            echo "保持现有密钥文件"
        fi
    fi
    
    if [ ! -f "zishu-sensei.key" ]; then
        echo "正在生成新的密钥对..."
        echo "请输入私钥密码（可以留空）："
        minisign -G -p zishu-sensei.pub -s zishu-sensei.key
        
        echo "✅ 密钥对生成完成"
        echo ""
        echo "📋 请将以下内容配置到 GitHub Secrets："
        echo ""
        echo "1. TAURI_PRIVATE_KEY 的内容："
        echo "================================"
        cat zishu-sensei.key
        echo "================================"
        echo ""
        echo "2. TAURI_KEY_PASSWORD 的内容："
        echo "（您刚才设置的密码，如果没有设置则留空）"
        echo ""
        echo "3. 更新 tauri.conf.json 中的公钥："
        echo "将以下 base64 编码替换 tauri.conf.json 中的 pubkey 字段："
        echo "================================"
        cat zishu-sensei.pub | base64 -w 0
        echo ""
        echo "================================"
    fi
else
    echo "⚠️  未找到 minisign 命令"
    echo "请安装 minisign："
    echo "  Ubuntu/Debian: sudo apt install minisign"
    echo "  macOS: brew install minisign"
    echo "  或访问: https://jedisct1.github.io/minisign/"
fi

# 3. 检查依赖更新
echo "📦 检查依赖..."
cd desktop_app

if [ -f "package-lock.json" ]; then
    echo "清理 package-lock.json..."
    rm -f package-lock.json
fi

if [ -d "node_modules" ]; then
    echo "是否要重新安装 Node.js 依赖？ (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "清理 node_modules..."
        rm -rf node_modules
        echo "重新安装依赖..."
        npm install --legacy-peer-deps
        echo "✅ 依赖安装完成"
    fi
fi

cd ..

echo ""
echo "🎉 快速修复完成！"
echo ""
echo "📝 接下来的步骤："
echo "1. 按照上述提示配置 GitHub Secrets"
echo "2. 如果生成了新密钥，更新 tauri.conf.json 中的公钥"
echo "3. 运行构建测试："
echo "   cd desktop_app && npm run tauri:build"
echo ""
echo "📖 详细说明请查看 BUILD_FIX_GUIDE.md 文件"

# 4. 权限设置
chmod +x quick_fix.sh

echo "✅ 脚本执行完成"
