# BakLab Setup Tool

A standalone setup tool for generating Docker Compose production environment configurations for BakLab applications.

## Quick Start

### 1. Prepare SSL Certificate

The setup tool requires HTTPS and needs SSL certificates prepared in advance. It's recommended to use the same certificate as your production application.

### 2. Run Setup Tool

```bash
# Example: Using Let's Encrypt certificate
go run . -cert=/etc/letsencrypt/live/your-domain.com/fullchain.pem \
         -key=/etc/letsencrypt/live/your-domain.com/privkey.pem \
         -domain=your-domain.com

# Or run after compilation
go build -o setup .
./setup -cert=/etc/letsencrypt/live/your-domain.com/fullchain.pem \
        -key=/etc/letsencrypt/live/your-domain.com/privkey.pem \
        -domain=your-domain.com
```

### 3. Access Configuration Interface

After the tool starts, it will display a one-time access link, similar to:
`https://your-domain.com:8443?token=abc123...`

### 4. Configuration Steps

Follow the interface instructions to complete the setup process, including:

- **Database** - Configure PostgreSQL connection (supports Docker or external service)
- **Redis** - Configure Redis/Valkey cache service (supports Docker or external service)
- **SMTP Email** - Configure email service for notifications
- **Application** - Set domain, branding, CORS, and other application configurations
- **SSL/HTTPS** - Configure SSL certificates for secure connections
- **Admin User** - Create system administrator account
- **Third-party Login** - Configure OAuth providers (Google, GitHub)
- **Analytics** - Configure GoAccess web analytics (optional)
- **Review** - Check configuration and test connections
- **Configuration Complete** - Generate configuration files and complete deployment

### 5. Security Features

- **One-time Access Token**: Generates unique access token for each startup
- **HTTPS Enforcement**: All communications through encrypted connections
- **Auto Timeout**: Automatically closes and cleans sensitive data after 30 minutes
- **Domain Validation**: Strict CORS and CSP security policies

## Generated Configuration Files

```
output/
├── .env.production              # Environment variables
├── docker-compose.production.yml # Docker Compose configuration
├── Dockerfile.pg                # PostgreSQL custom image (if using Docker mode)
├── db/                          # Database configuration (if using Docker mode)
│   ├── initdb/                  # Initialization scripts
│   └── postgresql.conf          # PostgreSQL configuration
├── redis/                       # Redis configuration (if using Docker mode)
│   ├── redis.conf
│   └── users.acl                # ACL user configuration
├── nginx/                       # Nginx reverse proxy configuration
│   ├── nginx.conf
│   └── templates/
│       └── webapp.conf.template
├── keys/                        # Application key files
├── geoip/                       # GeoIP data directory
├── manage_static/               # Static file management
└── static/                      # Static resources directory
```

## Technical Features

- **Flexible Deployment Modes**: Supports Docker containerized deployment or external service connections
- **Database Support**: PostgreSQL with pg_cron extension, automatic initialization scripts
- **Cache Service**: Redis/Valkey with ACL user permission management
- **Web Service**: Nginx reverse proxy, supports SSL/TLS
- **Security Configuration**: User isolation, permission control, security header settings

## Deployment Process

### 1. Copy Configuration to Server

```bash
# Copy generated configuration to deployment server
scp -r output server:/opt/baklab/
```

### 2. Start Production Environment

```bash
cd /opt/baklab/output
docker compose -f docker-compose.production.yml --env-file .env.production up -d
```

### 3. Verify Deployment

```bash
# Check service status
docker compose -f docker-compose.production.yml ps
# Test access
curl -I https://your-domain.com
```

## Command Line Options

```bash
./setup -h
```

Required options:
- `-cert string`: TLS certificate file path (REQUIRED)
- `-key string`: TLS private key file path (REQUIRED)
- `-domain string`: Domain name for HTTPS access (REQUIRED)

Optional options:
- `-port string`: HTTPS port (default "8443")
- `-data string`: Data directory (default "./data")
- `-static string`: Static files directory (default "./static")
- `-timeout duration`: Maximum session duration (default 30m)
- `-config string`: Import existing config.json file for revision

## Development Notes

### Directory Structure

- **internal/**: Internal modules (models, services, web handlers, etc.)
- **static/**: Web interface static resources
- **output/**: Generated configuration files output directory
- **data/**: Temporary data storage during setup process

## Security Reminders

⚠️ **Important Security Measures**:

- The setup tool will automatically timeout and clean sensitive data after 30 minutes
- Setup tool and temporary data can be deleted after configuration completion
- Recommended to backup generated configuration files in production environment
