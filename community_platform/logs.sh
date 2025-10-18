#!/bin/bash

# 查看日志脚本
# View logs script

if [ -z "$1" ]; then
    echo "查看所有服务日志..."
    docker-compose logs -f
else
    echo "查看 $1 服务日志..."
    docker-compose logs -f "$1"
fi

