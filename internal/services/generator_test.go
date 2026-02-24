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
			DomainName:      "app.example.com",
			RankingHostName: "ranking.example.com",
			HandleWWW:       true,
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
			DomainName:     "app.example.com",
			StaticHostName: "static.example.com",
			BrandName:      "BakLab",
			DefaultLang:    "en",
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
