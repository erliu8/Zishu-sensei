#!/bin/bash

# Docker镜像源配置脚本
# 用于配置国内Docker镜像源加速

set -e

echo "🚀 开始配置Docker镜像源..."

# 检查是否有Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 创建Docker配置目录
mkdir -p /etc/docker

# 备份现有配置（如果存在）
if [ -f /etc/docker/daemon.json ]; then
    echo "📦 备份现有配置到 /etc/docker/daemon.json.backup"
    cp /etc/docker/daemon.json /etc/docker/daemon.json.backup
fi

# 写入新的镜像源配置
echo "📝 配置Docker镜像源..."
cat <<EOF | tee /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com",
    "https://dockerproxy.com",
    "https://docker.nju.edu.cn"
  ],
  "insecure-registries": [],
  "experimental": false,
  "features": {
    "buildkit": true
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

# 重启Docker服务
echo "🔄 重启Docker服务..."
systemctl daemon-reload
systemctl restart docker

# 验证配置
echo "✅ 验证Docker镜像源配置..."
docker info | grep -A 10 "Registry Mirrors"

echo "🎉 Docker镜像源配置完成！"
echo ""
echo "📋 已配置的镜像源："
echo "  - 中科大镜像源: https://docker.mirrors.ustc.edu.cn"
echo "  - 网易镜像源: https://hub-mirror.c.163.com"
echo "  - 百度镜像源: https://mirror.baidubce.com"
echo "  - DockerProxy: https://dockerproxy.com"
echo "  - 南京大学镜像源: https://docker.nju.edu.cn"
echo ""
echo "💡 现在可以快速拉取镜像了！"
