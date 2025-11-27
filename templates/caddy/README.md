# Caddy 反向代理配置说明

## 概述

BakLab Setup 现在支持在 Nginx 和 Caddy 之间选择反向代理服务器。默认使用 Caddy，但可以退回到 Nginx。

## 选择反向代理类型

在 setup 配置中，可以通过 `reverse_proxy.type` 字段选择：

```json
{
  "reverse_proxy": {
    "type": "caddy"  // 或 "nginx"
  }
}
```

- **默认值**：`caddy`
- **可选值**：`caddy` 或 `nginx`

## Caddy vs Nginx

### Caddy 优势

✅ **配置简洁**：Caddyfile 语法更简单，易于理解和维护
✅ **自动 HTTPS**：内置 Let's Encrypt 支持（虽然本项目使用自定义证书）
✅ **现代协议**：自动启用 HTTP/2 和 HTTP/3
✅ **安全默认值**：自动设置最佳实践的安全头部
✅ **优雅配置**：更少的指令，更清晰的结构

### Nginx 优势

✅ **成熟稳定**：经过多年生产环境验证
✅ **性能优化**：在极高并发下性能表现出色
✅ **广泛支持**：更多的文档和社区资源
✅ **功能丰富**：内置 rate limiting 等功能

## 功能对比

| 功能 | Caddy | Nginx | 备注 |
|------|-------|-------|------|
| 反向代理 | ✅ | ✅ | 功能一致 |
| SSL/TLS | ✅ | ✅ | 都支持自定义证书 |
| Gzip 压缩 | ✅ | ✅ | Caddy 同时支持 zstd |
| HTTP/2 | ✅ | ✅ | Caddy 自动启用 |
| SSE 支持 | ✅ | ✅ | 长连接处理 |
| 静态文件服务 | ✅ | ✅ | 缓存策略一致 |
| Rate Limiting | ⚠️ | ✅ | Caddy 需要应用层处理 |
| 日志格式 | JSON | 自定义 | GoAccess 需要适配 |

## Rate Limiting 说明

### Nginx 方案
- 在 nginx.conf 中配置：`limit_req_zone $binary_remote_addr zone=one:10m rate=60r/s`
- 反向代理级别限流

### Caddy 方案
- 标准 Caddy 不包含 rate limiting 插件
- **推荐方案**：使用应用层 rate limiting（已实现在 `middleware/limiter.go`）
- **替代方案**：
  1. 使用 Cloudflare 等 CDN 的 rate limiting 功能
  2. 使用包含 rate limit 模块的自定义 Caddy 构建

## 日志配置

### Caddy 日志
- **位置**：`./caddy/logs/access.log`
- **格式**：JSON
- **轮转**：自动轮转，保留 10 个文件，每个最大 100MB

### GoAccess 配置
如果使用 Caddy，需要调整 GoAccess 配置以解析 JSON 格式日志：

```conf
log-format CADDY
date-format %d/%b/%Y
time-format %H:%M:%S
```

或使用 JSON 日志解析（GoAccess 1.5+）。

## 如何切换反向代理

### 从 Nginx 切换到 Caddy

1. 更新配置：
   ```json
   {
     "reverse_proxy": { "type": "caddy" }
   }
   ```

2. 重新运行 setup 程序生成配置

3. 重新部署：
   ```bash
   docker compose -f docker-compose.production.yml down
   docker compose -f docker-compose.production.yml up -d
   ```

### 从 Caddy 切换回 Nginx

1. 更新配置：
   ```json
   {
     "reverse_proxy": { "type": "nginx" }
   }
   ```

2. 重新运行 setup 程序

3. 重新部署

## 生成的文件结构

### 使用 Caddy 时
```
output/
├── caddy/
│   ├── Caddyfile       # 主配置文件
│   └── logs/           # 日志目录
└── docker-compose.production.yml
```

### 使用 Nginx 时
```
output/
├── nginx/
│   ├── nginx.conf      # 主配置
│   ├── templates/
│   │   └── baklab.conf.template
│   └── logs/
└── docker-compose.production.yml
```

## Docker 卷说明

### Caddy 卷
- `caddy-data`: Caddy 运行时数据（自动 HTTPS 证书等）
- `caddy-config`: Caddy 配置缓存
- `./caddy/logs`: 访问日志

### Nginx 卷
- `./nginx/logs`: 访问和错误日志

## 健康检查

两种反向代理都配置了相同的健康检查端点：

- **端点**：`http://localhost:80/health`
- **间隔**：30 秒
- **超时**：10 秒
- **重试**：3 次

## 端口映射

无论使用哪种反向代理，端口映射都是一致的：

- **HTTP**：`${NGINX_PORT}:80` (通常是 `80:80`)
- **HTTPS**：`${NGINX_SSL_PORT}:443` (通常是 `443:443`)

## 故障排查

### Caddy 无法启动
1. 检查 Caddyfile 语法：
   ```bash
   docker exec baklab-caddy caddy validate --config /etc/caddy/Caddyfile
   ```

2. 查看日志：
   ```bash
   docker logs baklab-caddy
   ```

### Nginx 无法启动
1. 检查配置语法：
   ```bash
   docker exec baklab-nginx nginx -t
   ```

2. 查看日志：
   ```bash
   docker logs baklab-nginx
   ```

## 性能建议

### 小型部署（< 1000 并发）
- **推荐**：Caddy - 配置简单，功能足够

### 中型部署（1000-10000 并发）
- **推荐**：两者都可以，根据团队熟悉度选择

### 大型部署（> 10000 并发）
- **推荐**：Nginx - 更多的性能优化选项

## 迁移检查清单

从 Nginx 迁移到 Caddy 时，请确认：

- [ ] SSL 证书路径正确
- [ ] 所有域名配置正确（主域名、www、dali 服务）
- [ ] 静态文件目录挂载正确
- [ ] 日志目录有写权限
- [ ] GoAccess 配置（如果使用）已更新为解析 JSON 日志
- [ ] 应用层 rate limiting 已启用
- [ ] 健康检查正常工作

## 技术支持

遇到问题时：

1. 查看容器日志
2. 检查配置文件语法
3. 验证卷挂载和权限
4. 确认环境变量正确设置

更多信息：
- Caddy 文档：https://caddyserver.com/docs/
- Nginx 文档：https://nginx.org/en/docs/
