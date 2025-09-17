# BakLab Setup Tool

独立的 setup 工具，用于生成 BakLab 应用的生产环境配置。此工具会根据主项目的实际配置结构生成完全兼容的生产环境部署文件。

## 快速开始

### 1. 获取工具

```bash
# 克隆仓库
git clone https://github.com/biliqiqi/baklab-setup.git
cd baklab-setup

# 安装 Go 依赖
go mod download
```

### 2. 运行 setup 工具

```bash
# 方式1: 直接运行 Go 代码
go run .

# 方式2: 编译后运行
go build -o setup .
./setup
```

### 3. 访问配置界面

打开浏览器访问：**http://localhost:8080**

### 4. 配置步骤

按界面指引完成配置：

1. **Initialize** - 生成 setup 令牌
2. **Database** - 配置 PostgreSQL 连接
   - 支持自定义 PostgreSQL 构建（包含 pg_cron 扩展）
   - 自动配置数据库初始化脚本
3. **Redis** - 配置 Valkey 缓存服务
   - 使用 Valkey 7.2 替代传统 Redis
   - 支持 ACL 用户权限配置
4. **Application** - 设置域名、品牌、CORS 等
5. **Admin User** - 创建管理员账户
6. **Review** - 检查配置并测试连接
7. **Complete** - 生成配置文件并完成

### 5. 自动完成

配置完成后 setup 会：
- ✅ 生成生产环境配置文件
- ✅ 复制必要的模板文件到配置目录
- ✅ 自动关闭服务
- ✅ 提示删除 setup 目录

## 生成的配置文件

```
output/
├── .env.production              # 环境变量配置
├── docker-compose.production.yml # Docker Compose 配置
├── Dockerfile.pg                # PostgreSQL 自定义镜像
├── certs/                       # SSL 证书目录
├── db/                          # 数据库配置
│   ├── initdb/                  # 初始化脚本
│   └── postgresql.conf          # PostgreSQL 配置
├── geoip/                       # GeoIP 数据目录
├── keys/                        # 密钥文件目录
├── manage_static/               # 静态文件管理目录
├── nginx/                       # Nginx 配置
│   ├── nginx.conf
│   └── templates/
│       └── webapp.conf.template
├── redis/                       # Redis/Valkey 配置
│   ├── redis.conf
│   └── users.acl                # ACL 用户配置
└── static/                      # 静态资源目录
```

## 技术特性

### 数据库配置
- **PostgreSQL 16.6** 自定义构建
- **pg_cron 扩展** 支持定时任务
- 完整的数据库初始化脚本
- 自定义 PostgreSQL 配置优化

### 缓存配置
- **Valkey 7.2** (Redis 兼容)
- **动态 ACL 生成器** 自动配置用户权限
- 支持用户级别的访问控制

### Web 服务
- **Nginx 1.25.2** 反向代理
- **GoAccess** 实时日志分析
- SSL/TLS 证书支持
- 静态文件服务

### 安全特性
- 数据库用户隔离
- Redis ACL 权限控制
- 安全头配置

## 部署流程

### 1. 构建应用镜像

```bash
# BakLab 主项目以预构建镜像形式提供
# 镜像地址：ghcr.io/biliqiqi/baklab:latest
# 无需手动构建，setup 工具会自动使用该镜像
```

### 2. 准备部署环境

```bash
# 复制整个 output 目录到部署服务器
scp -r output/ server:/opt/baklab/

# 或者单独复制必要文件
scp output/.env.production server:/opt/baklab/
scp output/docker-compose.production.yml server:/opt/baklab/
scp -r output/db/ server:/opt/baklab/output/
scp -r output/nginx/ server:/opt/baklab/output/
scp -r output/redis/ server:/opt/baklab/output/
```

### 3. 启动生产环境

```bash
# 在部署服务器
cd /opt/baklab

# 加载环境变量并启动
source output/.env.production
docker-compose -f output/docker-compose.production.yml up -d
```

### 4. 验证部署

```bash
# 检查容器状态
docker-compose -f output/docker-compose.production.yml ps

# 查看日志
docker-compose -f output/docker-compose.production.yml logs -f

# 测试服务
curl -I http://your-domain.com
```

## 命令行选项

```bash
./setup -h
```

支持的选项：
- `-port string`: 设置端口 (默认 "8080")
- `-data string`: 数据目录 (默认 "./data")  
- `-static string`: 静态文件目录 (默认 "./static")

## 开发说明

### 目录说明

- **templates/** : 存放不可变的配置模板，从主项目复制而来
- **output/** : 存放生成的配置文件，每次生成前会清空
- **data/** : 存放 setup 过程中的临时数据
- **static/** : Web 界面的静态资源

### 配置生成逻辑

1. **清理阶段**: 清空 `output/` 目录
2. **模板复制**: 从 `templates/` 复制文件到 `output/`
3. **配置生成**: 基于用户输入生成配置文件
4. **文件整合**: 将所有配置文件整合到 `output/` 目录

### 与主项目的一致性

- 数据库配置与 `docker-compose.yml` 一致
- Redis 配置与 `docker-compose.share.yml` 一致  
- Nginx 配置与主项目模板一致
- 环境变量与主项目 `.env.example` 一致

## 安全提醒

⚠️ **重要**: setup 完成后建议采取以下安全措施：

```bash
# 1. 备份生成的配置文件
cp -r output/ /safe/backup/location/

# 2. 删除敏感的运行时数据
rm -rf data/

# 3. 如果在生产服务器上运行，考虑删除整个 setup 工具
# rm -rf /path/to/baklab-setup/
```

## 故障排除

### 常见问题

1. **端口冲突**: 修改 `-port` 参数或检查 8080 端口占用
2. **权限问题**: 确保有读写 setup 目录的权限
3. **Docker 构建失败**: 检查 Dockerfile.pg 和网络连接
4. **数据库连接失败**: 验证数据库配置和网络连通性

### 日志查看

```bash
# setup 应用日志
./setup 2>&1 | tee setup.log

# 生成配置后的容器日志  
docker-compose -f output/docker-compose.production.yml logs
```