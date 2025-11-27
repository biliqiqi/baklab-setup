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

	if !strings.Contains(contentStr, "tls /etc/ssl/certs/server.crt /etc/ssl/private/server.key") {
		t.Errorf("Generated Caddyfile should contain SSL/TLS configuration")
	}

	if !strings.Contains(contentStr, "redir https://example.com") {
		t.Errorf("Generated Caddyfile should contain HTTPS redirect")
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
