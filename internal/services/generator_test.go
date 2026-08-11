package services

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/biliqiqi/baklab-setup/internal/model"
)

func TestGenerateCaddyConfig(t *testing.T) {
	tempDir := t.TempDir()

	templatesDir, err := filepath.Abs("../../templates")
	if err != nil {
		t.Fatalf("Failed to get templates directory path: %v", err)
	}

	g := NewGeneratorService()
	g.SetOutputDir(tempDir)
	g.SetTemplatesFS(os.DirFS(templatesDir))

	cfg := &model.SetupConfig{
		App: model.AppConfig{
			DomainName:        "app.example.com",
			RankingHostName:   "ranking.example.com",
			UserGuideHostName: "docs.baklab.app",
			HandleWWW:         true,
		},
		SSL: model.SSLConfig{
			Enabled: false,
		},
	}

	if err = g.GenerateCaddyConfig(cfg); err != nil {
		t.Fatalf("GenerateCaddyConfig() failed: %v", err)
	}

	caddyfilePath := filepath.Join(tempDir, "caddy", "Caddyfile")
	content, err := os.ReadFile(caddyfilePath)
	if err != nil {
		t.Fatalf("Failed to read generated Caddyfile: %v", err)
	}

	contentStr := string(content)

	if strings.Contains(contentStr, "${ROOT_DOMAIN_NAME}") {
		t.Errorf("Generated Caddyfile contains unresolved environment variable ${ROOT_DOMAIN_NAME}")
	}

	if strings.Contains(contentStr, "{{.RootDomain}}") {
		t.Errorf("Generated Caddyfile contains unresolved Go template variable {{.RootDomain}}")
	}

	if !strings.Contains(contentStr, "www.example.com") {
		t.Errorf("Generated Caddyfile should contain 'www.example.com', got:\n%s", contentStr)
	}

	if !strings.Contains(contentStr, "app.example.com") {
		t.Errorf("Generated Caddyfile should contain 'app.example.com'")
	}

	if !strings.Contains(contentStr, "ranking.example.com") {
		t.Errorf("Generated Caddyfile should contain 'ranking.example.com'")
	}

	if !strings.Contains(contentStr, "docs.baklab.app") {
		t.Errorf("Generated Caddyfile should contain 'docs.baklab.app'")
	}

	if !strings.Contains(contentStr, "reverse_proxy user-guide:80") {
		t.Errorf("Generated Caddyfile should proxy the user guide service")
	}

	if err = g.GenerateNginxConfig(cfg); err != nil {
		t.Fatalf("GenerateNginxConfig() failed: %v", err)
	}

	nginxPath := filepath.Join(tempDir, "nginx", "templates", "baklab.conf.template")
	nginxContent, err := os.ReadFile(nginxPath)
	if err != nil {
		t.Fatalf("Failed to read generated Nginx config: %v", err)
	}

	if !strings.Contains(string(nginxContent), "server_name ${USER_GUIDE_HOST_NAME};") {
		t.Errorf("Generated Nginx config should contain the user guide server")
	}

	if !strings.Contains(string(nginxContent), "proxy_pass http://user-guide:80;") {
		t.Errorf("Generated Nginx config should proxy the user guide service")
	}
}

func TestGenerateCaddyConfigWithSSL(t *testing.T) {
	tempDir := t.TempDir()

	templatesDir, err := filepath.Abs("../../templates")
	if err != nil {
		t.Fatalf("Failed to get templates directory path: %v", err)
	}

	g := NewGeneratorService()
	g.SetOutputDir(tempDir)
	g.SetTemplatesFS(os.DirFS(templatesDir))

	cfg := &model.SetupConfig{
		App: model.AppConfig{
			DomainName: "secure.example.com",
		},
		SSL: model.SSLConfig{
			Enabled: true,
		},
	}

	if err = g.GenerateCaddyConfig(cfg); err != nil {
		t.Fatalf("GenerateCaddyConfig() failed: %v", err)
	}

	caddyfilePath := filepath.Join(tempDir, "caddy", "Caddyfile")
	content, err := os.ReadFile(caddyfilePath)
	if err != nil {
		t.Fatalf("Failed to read generated Caddyfile: %v", err)
	}

	contentStr := string(content)

	if strings.Contains(contentStr, "/etc/letsencrypt/live/") {
		t.Errorf("Generated Caddyfile should not hardcode certbot certificate file paths")
	}

	if !strings.Contains(contentStr, "secure.example.com {") {
		t.Errorf("Generated Caddyfile should contain site block for secure.example.com")
	}

	if strings.Contains(contentStr, "/.well-known/acme-challenge/*") {
		t.Errorf("Generated Caddyfile should not contain manual ACME challenge handler for native Caddy ACME")
	}
}

func TestGenerateDevelopmentConfig(t *testing.T) {
	tempDir := t.TempDir()

	templatesDir, err := filepath.Abs("../../templates")
	if err != nil {
		t.Fatalf("Failed to get templates directory path: %v", err)
	}

	g := NewGeneratorService()
	g.SetOutputDir(tempDir)
	g.SetTemplatesFS(os.DirFS(templatesDir))

	cfg := &model.SetupConfig{
		Development: true,
		Database: model.DatabaseConfig{
			ServiceType: "external",
			Host:        "127.0.0.1",
			Port:        5432,
		},
		Redis: model.RedisConfig{
			ServiceType: "external",
			Host:        "127.0.0.1",
			Port:        6379,
		},
		App: model.AppConfig{
			DomainName:     "localhost",
			StaticHostName: "localhost",
			BrandName:      "BakLab",
			DefaultLang:    "en",
		},
		ReverseProxy: model.ReverseProxyConfig{Type: "caddy"},
	}

	if err := g.GenerateEnvFile(cfg); err != nil {
		t.Fatalf("GenerateEnvFile() failed: %v", err)
	}
	if err := g.GenerateDockerConfig(cfg); err != nil {
		t.Fatalf("GenerateDockerConfig() failed: %v", err)
	}

	envContent, err := os.ReadFile(filepath.Join(tempDir, ".env.development"))
	if err != nil {
		t.Fatalf("Failed to read development env file: %v", err)
	}
	if !strings.Contains(string(envContent), "DEV=true") {
		t.Error("Development env file should enable the backend development mode")
	}
	if !strings.Contains(string(envContent), "USE_HTTPS=false") {
		t.Error("Development env file should disable HTTPS")
	}

	composeContent, err := os.ReadFile(filepath.Join(tempDir, "docker-compose.development.yml"))
	if err != nil {
		t.Fatalf("Failed to read development compose file: %v", err)
	}
	compose := string(composeContent)
	if !strings.Contains(compose, `- "${APP_OUTER_PORT:-3000}:${APP_PORT:-3000}"`) {
		t.Error("Development compose file should expose the backend port")
	}
	if strings.Contains(compose, "./ssl/") {
		t.Error("Development compose file should not mount TLS certificates")
	}
	if strings.Contains(compose, "baklab-user-guide") {
		t.Error("Compose file should omit the user guide service when its hostname is empty")
	}

	caddyContent, err := os.ReadFile(filepath.Join(tempDir, "caddy", "Caddyfile"))
	if err != nil {
		t.Fatalf("Failed to read development Caddyfile: %v", err)
	}
	if !strings.Contains(string(caddyContent), ":80 {") {
		t.Error("Development Caddyfile should accept any local Host header over HTTP")
	}

	if err := g.GenerateNginxConfig(cfg); err != nil {
		t.Fatalf("GenerateNginxConfig() failed: %v", err)
	}
	nginxContent, err := os.ReadFile(filepath.Join(tempDir, "nginx", "templates", "baklab.conf.template"))
	if err != nil {
		t.Fatalf("Failed to read development Nginx config: %v", err)
	}
	nginx := string(nginxContent)
	if !strings.Contains(nginx, "listen 80 default_server;") || !strings.Contains(nginx, "server_name _;") {
		t.Error("Development Nginx config should accept any Host header")
	}
	if strings.Contains(nginx, "return 403;") {
		t.Error("Development Nginx config should not reject unmatched Host headers")
	}
}

func TestRootDomainFunction(t *testing.T) {
	tests := []struct {
		name     string
		domain   string
		expected string
	}{
		{
			name:     "subdomain",
			domain:   "app.example.com",
			expected: "example.com",
		},
		{
			name:     "deep subdomain",
			domain:   "api.staging.app.example.com",
			expected: "example.com",
		},
		{
			name:     "simple domain",
			domain:   "example.com",
			expected: "example.com",
		},
		{
			name:     "localhost",
			domain:   "localhost",
			expected: "localhost",
		},
		{
			name:     "trailing dot",
			domain:   "app.example.com.",
			expected: "example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rootDomain := func(domain string) string {
				domain = strings.TrimSuffix(domain, ".")

				if domain == "" {
					return domain
				}

				parts := strings.Split(domain, ".")

				if len(parts) < 2 {
					return domain
				}

				return strings.Join(parts[len(parts)-2:], ".")
			}

			result := rootDomain(tt.domain)
			if result != tt.expected {
				t.Errorf("rootDomain(%q) = %q, expected %q", tt.domain, result, tt.expected)
			}
		})
	}
}

func TestGenerateDockerConfigWithCaddyNativeACME(t *testing.T) {
	tempDir := t.TempDir()

	templatesDir, err := filepath.Abs("../../templates")
	if err != nil {
		t.Fatalf("Failed to get templates directory path: %v", err)
	}

	certPath := filepath.Join(tempDir, "input-fullchain.pem")
	keyPath := filepath.Join(tempDir, "input-privkey.pem")
	if err := os.WriteFile(certPath, []byte("dummy cert"), 0644); err != nil {
		t.Fatalf("Failed to write test cert file: %v", err)
	}
	if err := os.WriteFile(keyPath, []byte("dummy key"), 0644); err != nil {
		t.Fatalf("Failed to write test key file: %v", err)
	}

	g := NewGeneratorService()
	g.SetOutputDir(tempDir)
	g.SetTemplatesFS(os.DirFS(templatesDir))

	cfg := &model.SetupConfig{
		Database: model.DatabaseConfig{
			ServiceType:   "external",
			Host:          "127.0.0.1",
			Port:          5432,
			Name:          "baklab",
			AppUser:       "baklab",
			AppPassword:   "Password123!",
			SuperUser:     "postgres",
			SuperPassword: "Password123!",
		},
		Redis: model.RedisConfig{
			ServiceType:   "external",
			Host:          "127.0.0.1",
			Port:          6379,
			User:          "",
			Password:      "Password123!",
			AdminPassword: "Password123!",
		},
		App: model.AppConfig{
			DomainName:        "app.example.com",
			StaticHostName:    "static.example.com",
			UserGuideHostName: "docs.baklab.app",
			BrandName:         "BakLab",
			DefaultLang:       "en",
		},
		SSL: model.SSLConfig{
			Enabled:  true,
			CertPath: certPath,
			KeyPath:  keyPath,
		},
		ReverseProxy: model.ReverseProxyConfig{
			Type: "caddy",
		},
	}

	if err := g.GenerateDockerConfig(cfg); err != nil {
		t.Fatalf("GenerateDockerConfig() failed: %v", err)
	}

	composePath := filepath.Join(tempDir, "docker-compose.production.yml")
	content, err := os.ReadFile(composePath)
	if err != nil {
		t.Fatalf("Failed to read generated docker-compose.production.yml: %v", err)
	}

	contentStr := string(content)
	if strings.Contains(contentStr, "certbot:") {
		t.Errorf("Generated docker compose should not contain certbot service in native Caddy ACME mode")
	}
	if !strings.Contains(contentStr, "ghcr.io/biliqiqi/baklab-user-guide:latest") {
		t.Errorf("Generated docker compose should contain the user guide service")
	}

	sslCertPath := filepath.Join(tempDir, "ssl", "fullchain.pem")
	sslKeyPath := filepath.Join(tempDir, "ssl", "privkey.pem")
	if _, err := os.Stat(sslCertPath); err != nil {
		t.Errorf("Expected compatibility SSL cert at %s, err: %v", sslCertPath, err)
	}
	if _, err := os.Stat(sslKeyPath); err != nil {
		t.Errorf("Expected compatibility SSL key at %s, err: %v", sslKeyPath, err)
	}

	if strings.Contains(contentStr, "./caddy/certbot/conf:/etc/letsencrypt") {
		t.Errorf("Generated docker compose should not mount certbot letsencrypt directory")
	}
	if strings.Contains(contentStr, "./caddy/certbot/www:/var/www/certbot") {
		t.Errorf("Generated docker compose should not mount certbot webroot directory")
	}
}

func TestGenerateDockerConfigFallbackWhenJWTKeyPathIsDirectory(t *testing.T) {
	tempDir := t.TempDir()

	templatesDir, err := filepath.Abs("../../templates")
	if err != nil {
		t.Fatalf("Failed to get templates directory path: %v", err)
	}

	certPath := filepath.Join(tempDir, "input-fullchain.pem")
	keyPath := filepath.Join(tempDir, "input-privkey.pem")
	if err := os.WriteFile(certPath, []byte("dummy cert"), 0644); err != nil {
		t.Fatalf("Failed to write test cert file: %v", err)
	}
	if err := os.WriteFile(keyPath, []byte("dummy key"), 0644); err != nil {
		t.Fatalf("Failed to write test key file: %v", err)
	}

	jwtDirPath := filepath.Join(tempDir, "jwt-dir-path")
	if err := os.MkdirAll(jwtDirPath, 0755); err != nil {
		t.Fatalf("Failed to create jwt directory path: %v", err)
	}

	g := NewGeneratorService()
	g.SetOutputDir(tempDir)
	g.SetTemplatesFS(os.DirFS(templatesDir))

	cfg := &model.SetupConfig{
		Database: model.DatabaseConfig{
			ServiceType: "external",
			Host:        "127.0.0.1",
			Port:        5432,
			Name:        "baklab",
			AppUser:     "baklab",
			AppPassword: "Password123!",
		},
		Redis: model.RedisConfig{
			ServiceType: "external",
			Host:        "127.0.0.1",
			Port:        6379,
			Password:    "Password123!",
		},
		App: model.AppConfig{
			DomainName:     "app.example.com",
			StaticHostName: "static.example.com",
			BrandName:      "BakLab",
			DefaultLang:    "en",
			JWTKeyFromFile: true,
			JWTKeyFilePath: jwtDirPath,
		},
		SSL: model.SSLConfig{
			Enabled:  true,
			CertPath: certPath,
			KeyPath:  keyPath,
		},
		ReverseProxy: model.ReverseProxyConfig{
			Type: "caddy",
		},
	}

	if err := g.GenerateDockerConfig(cfg); err != nil {
		t.Fatalf("GenerateDockerConfig() failed: %v", err)
	}

	composePath := filepath.Join(tempDir, "docker-compose.production.yml")
	content, err := os.ReadFile(composePath)
	if err != nil {
		t.Fatalf("Failed to read generated docker-compose.production.yml: %v", err)
	}

	contentStr := string(content)
	if strings.Contains(contentStr, jwtDirPath+":/app/keys/jwt-private.pem") {
		t.Errorf("Compose should not use directory path as JWT file bind mount")
	}
	if !strings.Contains(contentStr, "- ./keys:/app/keys") {
		t.Errorf("Compose should fallback to keys directory mount")
	}
}

func TestGenerateDockerConfigCopiesJWTKeyFileToOutput(t *testing.T) {
	tempDir := t.TempDir()

	templatesDir, err := filepath.Abs("../../templates")
	if err != nil {
		t.Fatalf("Failed to get templates directory path: %v", err)
	}

	certPath := filepath.Join(tempDir, "input-fullchain.pem")
	keyPath := filepath.Join(tempDir, "input-privkey.pem")
	if err := os.WriteFile(certPath, []byte("dummy cert"), 0644); err != nil {
		t.Fatalf("Failed to write test cert file: %v", err)
	}
	if err := os.WriteFile(keyPath, []byte("dummy key"), 0644); err != nil {
		t.Fatalf("Failed to write test key file: %v", err)
	}

	externalJWTPath := filepath.Join(tempDir, "external-jwt.pem")
	jwtContent := []byte("jwt private key content")
	if err := os.WriteFile(externalJWTPath, jwtContent, 0600); err != nil {
		t.Fatalf("Failed to write external jwt file: %v", err)
	}

	g := NewGeneratorService()
	g.SetOutputDir(tempDir)
	g.SetTemplatesFS(os.DirFS(templatesDir))

	cfg := &model.SetupConfig{
		Database: model.DatabaseConfig{
			ServiceType: "external",
			Host:        "127.0.0.1",
			Port:        5432,
			Name:        "baklab",
			AppUser:     "baklab",
			AppPassword: "Password123!",
		},
		Redis: model.RedisConfig{
			ServiceType: "external",
			Host:        "127.0.0.1",
			Port:        6379,
			Password:    "Password123!",
		},
		App: model.AppConfig{
			DomainName:     "app.example.com",
			StaticHostName: "static.example.com",
			BrandName:      "BakLab",
			DefaultLang:    "en",
			JWTKeyFromFile: true,
			JWTKeyFilePath: externalJWTPath,
		},
		SSL: model.SSLConfig{
			Enabled:  true,
			CertPath: certPath,
			KeyPath:  keyPath,
		},
		ReverseProxy: model.ReverseProxyConfig{
			Type: "caddy",
		},
	}

	if err := g.HandleJWTKeyFile(cfg); err != nil {
		t.Fatalf("HandleJWTKeyFile() failed: %v", err)
	}

	if cfg.App.JWTKeyFromFile {
		t.Errorf("JWTKeyFromFile should be false after copying into output keys directory")
	}

	copiedJWTPath := filepath.Join(tempDir, "keys", "jwt-private.pem")
	copiedContent, err := os.ReadFile(copiedJWTPath)
	if err != nil {
		t.Fatalf("Failed to read copied jwt key file: %v", err)
	}
	if string(copiedContent) != string(jwtContent) {
		t.Errorf("Copied jwt key file content mismatch")
	}

	if err := g.GenerateDockerConfig(cfg); err != nil {
		t.Fatalf("GenerateDockerConfig() failed: %v", err)
	}

	composePath := filepath.Join(tempDir, "docker-compose.production.yml")
	content, err := os.ReadFile(composePath)
	if err != nil {
		t.Fatalf("Failed to read generated docker-compose.production.yml: %v", err)
	}

	contentStr := string(content)
	if strings.Contains(contentStr, externalJWTPath+":/app/keys/jwt-private.pem") {
		t.Errorf("Compose should not use external JWT file bind mount after copy")
	}
	if !strings.Contains(contentStr, "- ./keys:/app/keys") {
		t.Errorf("Compose should use keys directory mount after key copy")
	}
}
