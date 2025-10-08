# BakLab Setup Tool

[English](README.md) | 中文

独立的 setup 工具，用于生成 BakLab 应用的 Docker Compose 生产环境配置。通过引导式界面完成核心服务（数据库、Redis、邮件）、应用设置（域名、安全、品牌）、管理员账户创建，以及 OAuth 登录和网站分析等可选功能的配置。

## 快速开始

### 1. 准备工作

运行 setup 工具前，请准备以下内容：

- **域名**：指向您服务器的有效域名（HTTPS 访问和 SSL 证书配置所必需）。
- **SSL 证书**：与您的域名相匹配的 TLS 证书和私钥文件，用于 HTTPS。
- **SMTP 服务**：用于发送通知和用户注册邮件的邮件服务器凭据。
- **可选服务**：外部 PostgreSQL 数据库、Redis 服务器、OAuth 应用（Google/GitHub）、用于分析的 GeoIP 数据库文件。

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

### 4. 安全

setup 工具强制使用 HTTPS 进行所有通信，并为每个会话生成唯一的一次性访问令牌。会话在可配置的超时时间（默认 30 分钟）后自动过期并清理敏感数据。通过严格的 CORS 和 CSP 安全策略进行域名验证，确保仅授权访问。配置完成后，可安全删除 setup 工具和临时数据。

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
