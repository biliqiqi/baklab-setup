# BakLab Setup Tool

独立的 setup 工具，用于生成 BakLab 应用的 Docker Compose 生产环境配置。

## 快速开始

### 1. 准备 SSL 证书

setup 工具要求使用 HTTPS，需要提前准备 SSL 证书。推荐使用与最终托管应用相同的证书。

### 2. 运行 setup 工具

```bash
# 示例：使用 Let's Encrypt 证书
go run . -cert=/etc/letsencrypt/live/your-domain.com/fullchain.pem \
         -key=/etc/letsencrypt/live/your-domain.com/privkey.pem \
         -domain=your-domain.com

# 或编译后运行
go build -o setup .
./setup -cert=/etc/letsencrypt/live/your-domain.com/fullchain.pem \
        -key=/etc/letsencrypt/live/your-domain.com/privkey.pem \
        -domain=your-domain.com
```

### 3. 访问配置界面

工具启动后会显示一次性访问链接，类似：
`https://your-domain.com:8443?token=abc123...`

### 4. 配置步骤

按界面指引完成配置流程，主要包括：

- **数据库** - 配置 PostgreSQL 连接（支持 Docker 或外部服务）
- **Redis** - 配置 Redis/Valkey 缓存服务（支持 Docker 或外部服务）
- **SMTP 邮件** - 配置邮件服务用于通知
- **应用** - 设置域名、品牌、CORS 等应用配置
- **SSL/HTTPS** - 配置 SSL 证书以实现安全连接
- **管理员用户** - 创建系统管理员账户
- **第三方登录** - 配置 OAuth 提供商（Google、GitHub）
- **分析** - 配置 GoAccess 网站分析（可选）
- **检查** - 检查配置并测试连接
- **配置完成** - 生成配置文件并完成部署

### 5. 安全特性

- **一次性访问令牌**：每次启动生成唯一访问令牌
- **HTTPS 强制**：所有通信均通过加密连接
- **自动超时**：30分钟后自动关闭并清理敏感数据
- **域名验证**：严格的 CORS 和 CSP 安全策略

## 生成的配置文件

```
output/
├── .env.production              # 环境变量配置
├── docker-compose.production.yml # Docker Compose 配置
├── Dockerfile.pg                # PostgreSQL 自定义镜像（如使用 Docker 模式）
├── db/                          # 数据库配置（如使用 Docker 模式）
│   ├── initdb/                  # 初始化脚本
│   └── postgresql.conf          # PostgreSQL 配置
├── redis/                       # Redis 配置（如使用 Docker 模式）
│   ├── redis.conf
│   └── users.acl                # ACL 用户配置
├── nginx/                       # Nginx 反向代理配置
│   ├── nginx.conf
│   └── templates/
│       └── webapp.conf.template
├── keys/                        # 应用密钥文件
├── geoip/                       # GeoIP 数据目录
├── manage_static/               # 静态文件管理
└── static/                      # 静态资源目录
```

## 技术特性

- **灵活部署模式**：支持 Docker 容器化部署或连接外部服务
- **数据库支持**：PostgreSQL 带 pg_cron 扩展，自动初始化脚本
- **缓存服务**：Redis/Valkey 带 ACL 用户权限管理
- **Web 服务**：Nginx 反向代理，支持 SSL/TLS
- **安全配置**：用户隔离、权限控制、安全头设置

## 部署流程

### 1. 复制配置到服务器

```bash
# 复制生成的配置到部署服务器
scp -r output server:/opt/baklab/
```

### 2. 启动生产环境

```bash
cd /opt/baklab/output
docker compose -f docker-compose.production.yml --env-file .env.production up -d
```

### 3. 验证部署

```bash
# 检查服务状态
docker compose -f docker-compose.production.yml ps
# 测试访问
curl -I https://your-domain.com
```

## 命令行选项

```bash
./setup -h
```

必需选项：
- `-cert string`: TLS 证书文件路径（必需）
- `-key string`: TLS 私钥文件路径（必需）
- `-domain string`: HTTPS 访问域名（必需）

可选选项：
- `-port string`: HTTPS 端口（默认 "8443"）
- `-data string`: 数据目录（默认 "./data"）
- `-static string`: 静态文件目录（默认 "./static"）
- `-timeout duration`: 最大会话时长（默认 30m）

## 开发说明

### 目录结构

- **internal/** : 内部模块（模型、服务、Web处理器等）
- **static/** : Web 界面静态资源
- **output/** : 生成的配置文件输出目录
- **data/** : setup 过程中的临时数据存储

## 安全提醒

⚠️ **重要安全措施**：

- setup 工具会在30分钟后自动超时并清理敏感数据
- 配置完成后可删除 setup 工具和临时数据
- 生产环境建议备份生成的配置文件
