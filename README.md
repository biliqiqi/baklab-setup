# BakLab Setup Tool

English | [中文](README.zh.md)

A standalone setup tool for generating Docker Compose production environment configurations for BakLab applications. The guided interface walks you through configuring essential services (database, Redis, email), application settings (domain, security, branding), admin account creation, and optional features like OAuth login and analytics.

## Installation

### Download Pre-built Binary (Recommended)

Download the latest release for your platform:

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
- Download [baklab-setup-windows-amd64.exe](https://github.com/biliqiqi/baklab-setup/releases/latest)

Or visit the [Releases page](https://github.com/biliqiqi/baklab-setup/releases) for all versions and platforms.

### Install via go install

```bash
go install github.com/biliqiqi/baklab-setup@latest
```

### Build from source

```bash
git clone https://github.com/biliqiqi/baklab-setup.git
cd baklab-setup

# Build frontend
cd static
npm install
npm run build
cd ..

# Build Go binary
go build -o baklab-setup
```

## Quick Start

### 1. Prerequisites

Before running the setup tool, prepare the following:

- **Domain Name**: A valid domain name that points to your server (required for HTTPS access).
- **SSL Certificate**: Choose one of the following methods:
  - Use existing certificates: Provide TLS certificate and private key files
  - Auto certificate: Use `-auto-cert` to automatically obtain from Let's Encrypt (port 80 must be accessible)
- **SMTP Service**: Email server credentials for sending notifications and user registration emails.
- **Optional Services**: External PostgreSQL database, Redis server, OAuth applications (Google/GitHub), GeoIP database file for analytics.

### 2. Run Setup Tool

```bash
# Option 1: Automatically obtain Let's Encrypt certificate
baklab-setup -auto-cert -domain=your-domain.com

# Option 2: Use existing certificates
baklab-setup -cert=/etc/letsencrypt/live/your-domain.com/fullchain.pem \
             -key=/etc/letsencrypt/live/your-domain.com/privkey.pem \
             -domain=your-domain.com
```

### 3. Access Configuration Interface

After the tool starts, it will display a one-time access link, similar to:
`https://your-domain.com:8443?token=abc123...`

### 4. Security

The setup tool enforces HTTPS for all communications and generates a unique one-time access token for each session. Sessions automatically expire after a configurable timeout (default 30 minutes), cleaning up sensitive data. Domain validation with strict CORS and CSP security policies ensures only authorized access. After configuration completion, the setup tool and temporary data can be safely deleted.

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
- `-domain string`: Domain name for HTTPS access (REQUIRED)

Certificate options (choose one):
- `-auto-cert`: Automatically obtain certificate from Let's Encrypt
- `-cert string` + `-key string`: Use existing certificate and private key files

Optional options:
- `-cache-dir string`: Auto certificate cache directory (default "./cert-cache")
- `-port string`: HTTPS port (default "8443")
- `-data string`: Data directory (default "./data")
- `-static string`: Static files directory (default "./static")
- `-timeout duration`: Maximum session duration (default 30m)
- `-config string`: Import existing config.json file for revision
- `-input string`: Import from previous output directory (includes passwords and sensitive data)

## Development Notes

### Directory Structure

- **internal/**: Internal modules (models, services, web handlers, etc.)
- **static/**: Web interface static resources
- **output/**: Generated configuration files output directory
- **data/**: Temporary data storage during setup process
