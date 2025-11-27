# BakLab 设置程序

[English](README.md) | 中文

独立的 setup 工具，用于生成 BakLab 应用的 Docker Compose 生产环境配置。通过引导式界面完成核心服务（数据库、Redis、邮件）、应用设置（域名、安全、品牌）、管理员账户创建，以及 OAuth 登录和网站分析等可选功能的配置。

## 安装

### 下载预编译二进制文件（推荐）

为您的平台下载最新版本：

**Linux (amd64)**
```bash
wget https://github.com/biliqiqi/baklab-setup/releases/latest/download/baklab-setup-linux-amd64
chmod +x baklab-setup-linux-amd64
mv baklab-setup-linux-amd64 baklab-setup
```

**macOS (Apple Silicon)**
```bash
wget https://github.com/biliqiqi/baklab-setup/releases/latest/download/baklab-setup-darwin-arm64
chmod +x baklab-setup-darwin-arm64
mv baklab-setup-darwin-arm64 baklab-setup
```

**Windows**
- 下载 [baklab-setup-windows-amd64.exe](https://github.com/biliqiqi/baklab-setup/releases/latest/download/baklab-setup-windows-amd64.exe)

或访问 [Releases 页面](https://github.com/biliqiqi/baklab-setup/releases) 查看所有版本和平台。

### 通过 go install 安装

```bash
go install github.com/biliqiqi/baklab-setup@latest
```

### 从源码构建

```bash
git clone https://github.com/biliqiqi/baklab-setup.git
cd baklab-setup

# 构建前端
cd static
npm install
npm run build
cd ..

# 构建 Go 二进制文件
go build -o baklab-setup
```

## 快速开始

### 1. 准备工作

运行 setup 工具前，请准备以下内容：

- **域名**：指向您服务器的有效域名（HTTPS 访问所必需）。
- **SSL 证书**：两种方式二选一
  - 使用现有证书：提供 TLS 证书和私钥文件
  - 自动证书：使用 `-auto-cert` 从 Let's Encrypt 自动获取（需要端口 80 可访问）
- **SMTP 服务**：用于发送通知和用户注册邮件的邮件服务器凭据。
- **可选服务**：外部 PostgreSQL 数据库、Redis 服务器、OAuth 应用（Google/GitHub）、用于分析的 GeoIP 数据库文件。

### 2. 运行 setup 工具

```bash
# 方式一：自动获取 Let's Encrypt 证书
baklab-setup -auto-cert -domain=your-domain.com

# 方式二：使用现有证书
baklab-setup -cert=/etc/letsencrypt/live/your-domain.com/fullchain.pem \
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
├── caddy/                       # Caddy 反向代理配置（默认）
│   ├── Caddyfile
│   └── logs/
├── nginx/                       # Nginx 反向代理配置（可选）
│   ├── nginx.conf
│   └── templates/
│       └── baklab.conf.template
├── keys/                        # 应用密钥文件
├── geoip/                       # GeoIP 数据目录
├── manage_static/               # 静态文件管理
└── frontend_dist/               # 前端静态资源目录
```

**注意**：setup 工具默认使用 Caddy 作为反向代理。您可以通过配置界面切换到 Nginx，或使用 `-reverse-proxy` 参数配合 `-regen` 进行切换。

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
./baklab-setup -h
```

**必需选项：**
- `-domain string`: HTTPS 访问域名（必需）

**证书选项**（二选一）：
- `-auto-cert`: 自动从 Let's Encrypt 获取证书
- `-cert string` + `-key string`: 使用现有证书和私钥文件

**可选选项：**
- `-port string`: HTTPS 端口（默认 "8443"）
- `-timeout duration`: 最大会话时长（默认 "30m"）
- `-data string`: 数据目录（默认 "./data"）
- `-cache-dir string`: 自动证书缓存目录（默认 "./cert-cache"）

**导入/导出选项：**
- `-config string`: 导入已清理的 config.json 文件（密码已移除，可安全分享）
- `-input string`: 从之前的 output 目录导入（包含密码和敏感数据）
- `-output string`: 指定生成文件的输出目录（可选，默认为自动生成的路径）

**重新生成选项：**
- `-regen`: 从现有配置重新生成所有配置文件（需要配合 `-input`）
- `-reverse-proxy string`: 覆盖反向代理类型：'caddy' 或 'nginx'（仅与 `-regen` 一起使用）

### 示例

**使用自动证书进行基本设置：**
```bash
./baklab-setup -auto-cert -domain=example.com
```

**使用现有证书设置：**
```bash
./baklab-setup -cert=/path/to/cert.pem -key=/path/to/key.pem -domain=example.com
```

**使用不同的反向代理重新生成配置：**
```bash
./baklab-setup -regen -input=./output -reverse-proxy=nginx
```

**导入之前的配置进行编辑：**
```bash
./baklab-setup -input=./output -domain=example.com -auto-cert
```

## 开发说明

### 目录结构

- **internal/** : 内部模块（模型、服务、Web处理器等）
- **static/** : Web 界面静态资源
- **output/** : 生成的配置文件输出目录
- **data/** : setup 过程中的临时数据存储
