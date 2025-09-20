# BakLab Setup Tool

独立的 setup 工具，用于生成 BakLab 应用的生产环境配置。此工具采用安全的 HTTPS 协议，确保配置过程的安全性。

## 快速开始

### 1. 准备 SSL 证书

setup 工具要求使用 HTTPS，需要提前准备 SSL 证书：

```bash
# 自签名证书（仅用于内网环境）
openssl req -x509 -newkey rsa:4096 -keyout setup.key -out setup.crt -days 365 -nodes

# 或使用 Let's Encrypt 等证书颁发机构的正式证书
```

### 2. 运行 setup 工具

```bash
# 直接运行（需要指定必需参数）
go run . -cert=setup.crt -key=setup.key -domain=your-domain.com

# 编译后运行
go build -o setup .
./setup -cert=setup.crt -key=setup.key -domain=your-domain.com
```

### 3. 访问配置界面

工具启动后会显示一次性访问链接，类似：
`https://your-domain.com:8443?token=abc123...`

### 4. 配置步骤

按界面指引完成配置：

1. **Database** - 配置 PostgreSQL 连接（支持 Docker 或外部服务）
2. **Redis** - 配置 Redis/Valkey 缓存服务（支持 Docker 或外部服务）
3. **Application** - 设置域名、品牌、CORS 等应用配置
4. **Admin User** - 创建系统管理员账户
5. **Review** - 检查配置并测试连接
6. **Complete** - 生成配置文件并完成部署

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
scp -r output/ server:/opt/baklab/
```

### 2. 启动生产环境

```bash
cd /opt/baklab
docker-compose -f output/docker-compose.production.yml up -d
```

### 3. 验证部署

```bash
# 检查服务状态
docker-compose -f output/docker-compose.production.yml ps
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