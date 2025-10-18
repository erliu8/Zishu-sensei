#!/bin/bash

# Zishu Sensei - 开发服务器启动脚本
# 用于快速启动不同的开发环境

echo "🚀 Zishu Sensei - 开发服务器"
echo "================================"
echo ""
echo "请选择要启动的服务:"
echo ""
echo "1) 社区平台前端 (Next.js)"
echo "2) 社区平台后端 (FastAPI)"
echo "3) 社区平台完整服务 (Docker)"
echo "4) 桌面应用 (Tauri)"
echo "5) 全部服务"
echo ""
read -p "请选择 (1-5): " choice

case $choice in
    1)
        echo ""
        echo "启动社区平台前端..."
        echo "访问地址: http://localhost:3000"
        echo ""
        cd community_platform/frontend
        npm run dev
        ;;
    2)
        echo ""
        echo "启动社区平台后端..."
        echo "API 地址: http://localhost:8000"
        echo "API 文档: http://localhost:8000/docs"
        echo ""
        cd community_platform/backend
        
        # 检查虚拟环境
        if [ ! -d "venv" ]; then
            echo "创建虚拟环境..."
            python3 -m venv venv
        fi
        
        source venv/bin/activate
        pip install -r requirements.txt
        uvicorn main:app --reload --host 0.0.0.0 --port 8000
        ;;
    3)
        echo ""
        echo "启动社区平台完整服务 (Docker)..."
        echo "前端: http://localhost:3000"
        echo "后端: http://localhost:8000"
        echo "数据库: localhost:5432"
        echo "Redis: localhost:6379"
        echo ""
        cd community_platform
        ./deploy.sh
        ;;
    4)
        echo ""
        echo "启动桌面应用..."
        echo ""
        cd desktop_app
        npm run tauri:dev
        ;;
    5)
        echo ""
        echo "启动所有服务..."
        echo ""
        
        # 使用 tmux 或 screen 同时运行多个服务
        if command -v tmux &> /dev/null; then
            echo "使用 tmux 启动服务..."
            
            # 创建新会话
            tmux new-session -d -s zishu
            
            # 前端
            tmux new-window -t zishu:1 -n frontend
            tmux send-keys -t zishu:1 'cd community_platform/frontend && npm run dev' C-m
            
            # 后端
            tmux new-window -t zishu:2 -n backend
            tmux send-keys -t zishu:2 'cd community_platform/backend && source venv/bin/activate && uvicorn main:app --reload' C-m
            
            # 桌面应用
            tmux new-window -t zishu:3 -n desktop
            tmux send-keys -t zishu:3 'cd desktop_app && npm run tauri:dev' C-m
            
            # 切换到第一个窗口
            tmux select-window -t zishu:1
            
            # 连接到会话
            echo ""
            echo "所有服务已在 tmux 中启动"
            echo "按 Ctrl+B 然后按数字键切换窗口"
            echo "按 Ctrl+B 然后按 D 分离会话"
            echo "使用 'tmux attach -t zishu' 重新连接"
            echo ""
            tmux attach -t zishu
        else
            echo "tmux 未安装，无法同时启动多个服务"
            echo "请安装 tmux: sudo apt install tmux (Ubuntu/Debian)"
            echo "或单独启动各个服务"
            exit 1
        fi
        ;;
    *)
        echo "无效选择"
        exit 1
        ;;
esac
