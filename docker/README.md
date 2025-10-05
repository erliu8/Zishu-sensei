# Docker 镜像源配置说明

## 自动配置脚本

运行以下命令自动配置Docker镜像源：

```bash
# 给脚本执行权限
chmod +x scripts/setup-docker-mirrors.sh

# 运行配置脚本
sudo scripts/setup-docker-mirrors.sh
```

## 手动配置步骤

1. **创建Docker配置目录**：
```bash
sudo mkdir -p /etc/docker
```

2. **创建或修改daemon.json文件**：
```bash
sudo nano /etc/docker/daemon.json
```

3. **添加以下内容**：
```json
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
```

4. **重启Docker服务**：
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

5. **验证配置**：
```bash
docker info | grep -A 10 "Registry Mirrors"
```

## 国内镜像源列表

- **中科大镜像源**: https://docker.mirrors.ustc.edu.cn
- **网易镜像源**: https://hub-mirror.c.163.com
- **百度镜像源**: https://mirror.baidubce.com
- **DockerProxy**: https://dockerproxy.com
- **南京大学镜像源**: https://docker.nju.edu.cn
- **阿里云镜像源**: https://registry.cn-hangzhou.aliyuncs.com (需要登录)

## 启动服务

配置完成后，使用以下命令启动服务：

```bash
# 启动核心服务
docker-compose up -d

# 启动包含社区平台的完整服务
docker-compose --profile community up -d

# 查看服务状态
docker-compose ps
```

## 常用Docker命令

```bash
# 拉取镜像测试
docker pull hello-world

# 查看镜像列表
docker images

# 查看运行中的容器
docker ps

# 查看所有容器
docker ps -a

# 查看容器日志
docker-compose logs -f [service_name]
```
